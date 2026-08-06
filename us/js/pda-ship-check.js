/**
 * 海外仓 us · PDA 发货复核
 * 流程：扫订单面单号匹配出库单 → 扫 SKU 识别料号 → 录入数量 → 提交判定（复核完成/复核异常）
 * 复核中途中断（重置本轮/切换订单/关闭页面）→ 档案自动落「部分复核」
 */
(function () {
  'use strict';

  var OPERATOR = '郑剑锋';
  var SITE = 'LA';

  var state = {
    order: null,
    recordId: null,
    currentItem: null
  };

  /* ========== DOM ========== */

  function $(id) { return document.getElementById(id); }

  var pageOrder, pageScan, orderInput, orderStatus, orderDoneHint,
    skuInput, skuQtyInput, skuStatus, skuTbody, scOrderNo, scOrderStatus,
    alertModal, alertText, alertOk;

  /* ========== 弹窗 ========== */

  var alertCallback = null;
  var alertCancelCallback = null;
  var alertTimer = null;

  function showAlert(text, opts) {
    opts = opts || {};
    alertText.textContent = text;
    alertText.className = 'pda-alert-modal-body' +
      (opts.ok ? ' ok' : '') + (opts.left ? ' left' : '');
    alertCallback = opts.onOk || null;
    alertCancelCallback = opts.onCancel || null;
    alertModal.classList.remove('pda-hidden');
    alertModal.setAttribute('aria-hidden', 'false');
    alertOk.focus();
    // 倒计时自动关闭（确定按钮同步显示剩余秒数）
    if (alertTimer) { clearInterval(alertTimer); alertTimer = null; }
    if (opts.countdown) {
      var remain = opts.countdown;
      alertOk.textContent = '确定(' + remain + ')';
      alertTimer = setInterval(function () {
        remain--;
        if (remain <= 0) {
          hideAlert();
        } else {
          alertOk.textContent = '确定(' + remain + ')';
        }
      }, 1000);
    } else {
      alertOk.textContent = '确定';
    }
  }

  function hideAlert() {
    if (alertTimer) { clearInterval(alertTimer); alertTimer = null; }
    alertOk.textContent = '确定';
    alertModal.classList.add('pda-hidden');
    alertModal.setAttribute('aria-hidden', 'true');
    var cb = alertCallback;
    alertCallback = null;
    alertCancelCallback = null;
    if (typeof cb === 'function') cb();
  }

  function cancelAlert() {
    if (alertTimer) { clearInterval(alertTimer); alertTimer = null; }
    alertOk.textContent = '确定';
    alertModal.classList.add('pda-hidden');
    alertModal.setAttribute('aria-hidden', 'true');
    var cb = alertCancelCallback;
    alertCallback = null;
    alertCancelCallback = null;
    if (typeof cb === 'function') cb();
  }

  /* ========== 状态提示 ========== */

  function setOrderStatus(msg, cls) {
    orderStatus.textContent = msg || '';
    orderStatus.className = 'pda-ris-mstatus' + (cls ? ' ' + cls : '');
  }

  function setSkuStatus(msg, cls) {
    skuStatus.textContent = msg || '';
    skuStatus.className = 'pda-ris-mstatus' + (cls ? ' ' + cls : '');
  }

  /* ========== 页面切换 ========== */

  function showPage1() {
    pageScan.classList.add('pda-hidden');
    pageOrder.classList.remove('pda-hidden');
    orderInput.value = '';
    setOrderStatus('');
    orderInput.focus();
  }

  function enterPage2(order) {
    state.order = order;
    // 进入页二即建档：若已有进行中档案则复用，否则新建（未扫描刷新/离开也会落「部分复核」）
    var active = ShipCheckStore.getActiveRecord(order.orderNo);
    if (active) {
      state.recordId = active.id;
    } else {
      var recNew = ShipCheckStore.createRecord(order, OPERATOR, SITE);
      state.recordId = recNew.id;
    }
    state.currentItem = null;
    scOrderNo.textContent = order.orderNo;
    scOrderStatus.textContent = '状态：复核中';
    skuInput.value = '';
    skuQtyInput.value = '';
    skuQtyInput.disabled = true;
    setSkuStatus('');
    renderSkuTable(valuesFromStore());
    pageOrder.classList.add('pda-hidden');
    pageScan.classList.remove('pda-hidden');
    skuInput.focus();
  }

  /* ========== 计数与表格渲染 ========== */

  function valuesFromStore() {
    var values = {};
    if (state.recordId) {
      var rec = ShipCheckStore.getRecord(state.recordId);
      if (rec) {
        rec.scanDetail.forEach(function (d) {
          values[String(d.itemNo).toUpperCase()] = d.valueQty != null ? d.valueQty : (d.scanCount || 0);
        });
      }
    }
    return values;
  }

  /** 表格行定义：当前订单的 SKU 明细。 */
  function buildRowDefs() {
    return state.order.items.map(function (it) {
      return { itemNo: it.itemNo, orderQty: it.qty };
    });
  }

  function renderSkuTable(values) {
    var rows = buildRowDefs().map(function (def) {
      var valueQty = values[String(def.itemNo).toUpperCase()] || 0;
      var cls = '';
      if (valueQty > def.orderQty) cls = 'sc-over';
      else if (valueQty === def.orderQty && valueQty > 0) cls = 'sc-done';
      else if (valueQty > 0) cls = 'sc-active';
      return '<tr class="' + cls + '">' +
        '<td>' + def.itemNo + '</td>' +
        '<td class="pda-sc-count">' + valueQty + ' / ' + def.orderQty + '</td>' +
        '</tr>';
    });
    skuTbody.innerHTML = rows.join('');
  }

  /* ========== 中断保护：落部分复核 ========== */

  function closeOpenSession() {
    if (state.recordId) {
      ShipCheckStore.closeAsPartial(state.recordId);
      state.recordId = null;
    }
  }

  /* ========== 页一：扫描订单面单号 ========== */

  function handleOrderScan() {
    var code = orderInput.value.trim();
    setOrderStatus('');
    orderDoneHint.classList.add('pda-hidden');
    if (!code) {
      setOrderStatus('请扫描或输入订单面单单号', 'err');
      return;
    }
    var order = OutOrderCommon.find(code);
    if (!order) {
      setOrderStatus('未匹配到出库单，请核对单号', 'err');
      return;
    }
    // 切换到新订单前，将未终结复核落为「部分复核」
    if (state.recordId && state.order && state.order.orderNo !== order.orderNo) {
      closeOpenSession();
    }
    var st = ShipCheckStore.getOrderCheckStatus(order.orderNo, order.checkStatus);
    if (st === '已达标' || st === '已合规') {
      orderDoneHint.classList.remove('pda-hidden');
      return;
    }
    orderInput.value = '';
    enterPage2(order);
  }

  /* ========== 页二：扫描SKU料号 ========== */

  function findItem(code) {
    var normalized = String(code).trim().toUpperCase();
    for (var i = 0; i < state.order.items.length; i++) {
      if (String(state.order.items[i].itemNo).toUpperCase() === normalized) {
        return state.order.items[i];
      }
    }
    return null;
  }

  function handleSkuScan() {
    var code = skuInput.value.trim();
    skuQtyInput.value = '';
    skuQtyInput.disabled = true;
    state.currentItem = null;
    setSkuStatus('');
    if (!code) return;

    var item = findItem(code);
    if (!item) {
      skuInput.value = '';
      if (!ShipCheckStore.appendWrongScan(state.recordId, code, OPERATOR)) {
        setSkuStatus('复核档案状态异常，请重新开始', 'err');
        return;
      }
      setSkuStatus('该料号不属于当前订单，请检查！', 'err');
      showAlert('该料号不属于当前订单，请检查！', {
        onOk: function () { skuInput.focus(); },
        onCancel: function () { skuInput.focus(); }
      });
      return;
    }

    state.currentItem = item;
    skuQtyInput.disabled = false;
    setSkuStatus('料号 ' + item.itemNo + ' 识别成功，请录入本次数量', 'ok');
    skuQtyInput.focus();
  }

  function submitSkuValue() {
    var qty = Number(skuQtyInput.value);
    if (!state.currentItem) {
      setSkuStatus('请先扫描或输入 SKU 料号', 'err');
      skuInput.focus();
      return;
    }
    if (!isFinite(qty) || qty <= 0 || Math.floor(qty) !== qty) {
      setSkuStatus('请输入大于 0 的整数数量', 'err');
      skuQtyInput.focus();
      return;
    }

    var itemNo = state.currentItem.itemNo;
    var orderQty = state.currentItem.qty;
    var previousQty = valuesFromStore()[String(itemNo).toUpperCase()] || 0;
    function saveValue() {
      var result = ShipCheckStore.submitSkuValue(state.recordId, itemNo, qty, OPERATOR);
      if (!result) {
        setSkuStatus('复核档案状态异常，请重新开始', 'err');
        return;
      }
      renderSkuTable(valuesFromStore());
      var typeText = result.scanType === '正常' ? '数量匹配' : result.scanType;
      var isQtyMismatch = result.scanType === '少货' || result.scanType === '多货';
      setSkuStatus(itemNo + ' 已录入 ' + qty + '，' + typeText, result.scanType === '正常' ? 'ok' : 'err');
      state.currentItem = null;
      skuInput.value = '';
      skuQtyInput.value = '';
      skuQtyInput.disabled = true;
      if (isQtyMismatch) {
        var mismatchText = result.scanType === '多货'
          ? '该料号复核数量已超过订单发货数量，请检查！'
          : '该料号复核数量少于订单发货数量，请检查！';
        showAlert(mismatchText + '\n料号 ' + itemNo + ' 已 ' + qty + ' / 应 ' + orderQty, {
          left: true,
          onOk: function () { skuInput.focus(); },
          onCancel: function () { skuInput.focus(); }
        });
      } else {
        skuInput.focus();
      }
    }

    if (previousQty > 0) {
      showAlert('料号 ' + itemNo + ' 已录入 ' + previousQty + '，是否覆盖为 ' + qty + '？\n按 Enter 确认覆盖，按 Esc 取消。', {
        left: true,
        onOk: saveValue,
        onCancel: function () { skuQtyInput.focus(); }
      });
      return;
    }
    saveValue();
  }

  /* ========== 页二：提交 ========== */

  function handleSubmit() {
    if (!state.order) return;
    if (!state.recordId) {
      showAlert('请先扫描货品料号后再提交');
      return;
    }
    var result = ShipCheckStore.submitRecord(state.recordId);
    state.recordId = null;
    if (!result) {
      showAlert('复核档案状态异常，请重新开始');
      return;
    }
    if (result.status === '复核完成') {
      showAlert('复核完成\n订单 ' + state.order.orderNo + ' 已复核完成', {
        ok: true,
        onOk: function () { state.order = null; showPage1(); }
      });
    } else {
      var lines = ['不满足复核完成条件，本次复核已记录为复核异常。'];
      if (result.missing.length) {
        lines.push('少货料号：');
        result.missing.forEach(function (m) {
          lines.push('  ' + m.itemNo + '（已录 ' + m.valueQty + ' / 应录 ' + m.orderQty + '）');
        });
      }
      if (result.over.length) {
        lines.push('多货料号：');
        result.over.forEach(function (o) {
          lines.push('  ' + o.itemNo + '（已录 ' + o.valueQty + ' / 应录 ' + o.orderQty + '）');
        });
      }
      if (result.hasWrong) lines.push('存在错扫料号，请检查扫描记录。');
      showAlert(lines.join('\n'), {
        left: true,
        onOk: function () { state.order = null; showPage1(); }
      });
    }
  }

  /* ========== 重置 ========== */

  function handleOrderReset() {
    orderInput.value = '';
    setOrderStatus('');
    orderDoneHint.classList.add('pda-hidden');
    orderInput.focus();
  }

  /* ========== 初始化 ========== */

  function init() {
    pageOrder = $('pageOrder');
    pageScan = $('pageScan');
    orderInput = $('orderInput');
    orderStatus = $('orderStatus');
    orderDoneHint = $('orderDoneHint');
    skuInput = $('skuInput');
    skuQtyInput = $('skuQtyInput');
    skuStatus = $('skuStatus');
    skuTbody = $('skuTbody');
    scOrderNo = $('scOrderNo');
    scOrderStatus = $('scOrderStatus');
    alertModal = $('pdaAlertModal');
    alertText = $('pdaAlertModalText');
    alertOk = $('pdaAlertModalOk');

    orderInput.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.keyCode === 13) {
        e.preventDefault();
        e.stopPropagation();
        handleOrderScan();
      }
    });
    skuInput.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.keyCode === 13) {
        e.preventDefault();
        e.stopPropagation();
        handleSkuScan();
      }
    });
    skuQtyInput.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.keyCode === 13) {
        e.preventDefault();
        e.stopPropagation();
        submitSkuValue();
      }
    });
    document.addEventListener('keydown', function (e) {
      if (!alertModal.classList.contains('pda-hidden') && (e.key === 'Enter' || e.keyCode === 13)) {
        e.preventDefault();
        hideAlert();
      } else if (!alertModal.classList.contains('pda-hidden') && (e.key === 'Escape' || e.keyCode === 27)) {
        e.preventDefault();
        cancelAlert();
      }
    });

    $('btnOrderReset').addEventListener('click', handleOrderReset);
    $('btnSubmit').addEventListener('click', handleSubmit);
    alertOk.addEventListener('click', hideAlert);

    // 离开保护：页面关闭/刷新前，未终结复核落「部分复核」
    window.addEventListener('beforeunload', function () {
      if (state.recordId) {
        ShipCheckStore.closeAsPartial(state.recordId);
        state.recordId = null;
      }
    });

    orderInput.focus();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
