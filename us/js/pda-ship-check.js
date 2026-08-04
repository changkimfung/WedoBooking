/**
 * 海外仓 us · PDA 发货复核
 * 流程：扫订单面单号匹配出库单 → 逐一扫SKU料号 → 提交判定（复核完成/复核异常）
 * 复核中途中断（重置本轮/切换订单/关闭页面）→ 档案自动落「部分复核」
 */
(function () {
  'use strict';

  var OPERATOR = '郑剑锋';
  var SITE = 'LA';

  var state = {
    order: null,       // 当前出库单
    recordId: null,    // 当前复核中档案 id（首扫建档）
    lastScanned: ''    // 最近扫描命中的料号（行高亮）
  };

  /* ========== DOM ========== */

  function $(id) { return document.getElementById(id); }

  var pageOrder, pageScan, orderInput, orderStatus, orderDoneHint,
    skuInput, skuStatus, skuTbody, scOrderNo, scOrderStatus,
    alertModal, alertText, alertOk;

  /* ========== 弹窗 ========== */

  var alertCallback = null;
  var alertTimer = null;

  function showAlert(text, opts) {
    opts = opts || {};
    alertText.textContent = text;
    alertText.className = 'pda-alert-modal-body' +
      (opts.ok ? ' ok' : '') + (opts.left ? ' left' : '');
    alertCallback = opts.onOk || null;
    alertModal.classList.remove('pda-hidden');
    alertModal.setAttribute('aria-hidden', 'false');
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
    if (typeof alertCallback === 'function') {
      var cb = alertCallback;
      alertCallback = null;
      cb();
    }
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
    state.lastScanned = '';
    scOrderNo.textContent = order.orderNo;
    scOrderStatus.textContent = '状态：复核中';
    skuInput.value = '';
    setSkuStatus('');
    renderSkuTable(countsFromStore());
    pageOrder.classList.add('pda-hidden');
    pageScan.classList.remove('pda-hidden');
    skuInput.focus();
  }

  /* ========== 计数与表格渲染 ========== */

  function countsFromStore() {
    var counts = {};
    if (state.recordId) {
      var rec = ShipCheckStore.getRecord(state.recordId);
      if (rec) {
        rec.scanDetail.forEach(function (d) {
          counts[String(d.itemNo).toUpperCase()] = d.scanCount;
        });
      }
    }
    return counts;
  }

  /** 表格行定义：订单清单 + 非当前订单但已扫描的料号（订单数量0） */
  function buildRowDefs() {
    var defs = state.order.items.map(function (it) {
      return { itemNo: it.itemNo, orderQty: it.qty };
    });
    if (state.recordId) {
      var rec = ShipCheckStore.getRecord(state.recordId);
      if (rec) {
        rec.scanDetail.forEach(function (d) {
          var exists = defs.some(function (x) {
            return String(x.itemNo).toUpperCase() === String(d.itemNo).toUpperCase();
          });
          if (!exists) defs.push({ itemNo: d.itemNo, orderQty: 0 });
        });
      }
    }
    return defs;
  }

  function renderSkuTable(counts) {
    var rows = buildRowDefs().map(function (def) {
      var c = counts[String(def.itemNo).toUpperCase()] || 0;
      var cls = '';
      if (c > def.orderQty) cls = 'sc-over';
      else if (c === def.orderQty && c > 0) cls = 'sc-done';
      else if (c > 0) cls = 'sc-active';
      return '<tr class="' + cls + '">' +
        '<td>' + def.itemNo + '</td>' +
        '<td class="pda-sc-count">' + c + ' / ' + def.orderQty + '</td>' +
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
    skuInput.value = '';
    setSkuStatus('');
    if (!code) return;

    var item = findItem(code);

    // 档案在 enterPage2 时已创建，此处直接追加扫描记录
    var rec = ShipCheckStore.appendScan(state.recordId, code, OPERATOR);
    if (!rec) {
      setSkuStatus('复核档案状态异常，请重新开始', 'err');
      return;
    }
    state.lastScanned = code;

    var normalized = code.toUpperCase();
    var count = 0;
    rec.scanDetail.forEach(function (d) {
      if (String(d.itemNo).toUpperCase() === normalized) count = d.scanCount;
    });
    renderSkuTable(countsFromStore());

    if (!item) {
      // 非当前订单料号：同样记录扫描次数，订单数量显示为 0，弹窗提示
      setSkuStatus('该料号不属于当前订单，请检查！', 'err');
      showAlert('该料号不属于当前订单，请检查！');
    } else if (count > item.qty) {
      // 超扫：同样记录扫描次数，弹窗提示
      setSkuStatus('该料号扫描次数已超过订单发货数量，请检查！', 'err');
      showAlert('该料号扫描次数已超过订单发货数量，请检查！\n' + item.itemNo +
        ' 已扫 ' + count + ' / 应扫 ' + item.qty);
    } else {
      setSkuStatus('匹配成功，' + item.itemNo + ' 扫描次数 +1', 'ok');
    }
    skuInput.focus();
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
        lines.push('少扫料号：');
        result.missing.forEach(function (m) {
          lines.push('  ' + m.itemNo + '（已扫 ' + m.scanCount + ' / 应扫 ' + m.orderQty + '）');
        });
      }
      if (result.over.length) {
        lines.push('超扫料号：');
        result.over.forEach(function (o) {
          lines.push('  ' + o.itemNo + '（已扫 ' + o.scanCount + ' / 应扫 ' + o.orderQty + '）');
        });
      }
      lines.push('5 秒后自动返回扫描订单页面');
      showAlert(lines.join('\n'), {
        left: true,
        countdown: 5,
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
        handleOrderScan();
      }
    });
    skuInput.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.keyCode === 13) {
        e.preventDefault();
        handleSkuScan();
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
