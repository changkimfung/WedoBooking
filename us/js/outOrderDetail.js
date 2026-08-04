/**
 * 海外仓 us · 发货复核详情页（三段式：订单信息 / SKU详情 / 复核档案列表）
 * 复核档案列表点击「查看」→ 弹窗展示该档案 SKU 扫描明细与逐条扫描记录
 */
(function ($) {
  'use strict';

  var STATUS_CLASS = {
    // 订单级五态
    '已达标': 's-done',
    '已合规': 's-compliant',
    '复核异常': 's-error',
    '部分复核': 's-partial',
    '未复核': 's-none',
    // 档案级状态
    '复核中': 's-doing',
    '复核完成': 's-done'
  };

  var order = null;
  var openModalIdx = -1;   // 当前打开的档案明细弹窗索引，时区切换后同步刷新

  /** 时间展示：按所选时区（中国/美国）换算，空值返回 '-' */
  function fmtTime(s) {
    return s ? WedoTime.fmt(s) : '-';
  }
  var openModalIdx = -1;   // 当前打开的档案明细弹窗索引，时区切换后同步刷新

  /** 时间展示：按所选时区（中国/美国）换算，空值返回 '-' */
  function fmtTime(s) {
    return s ? WedoTime.fmt(s) : '-';
  }

  function esc(s) {
    if (s == null) return '';
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  var STATUS_TIP = {
    '已达标': '首次复核即完成，且复核次数为 1 次。',
    '已合规': '多次复核后完成，或由管理人员人工完结。',
    '复核异常': '已提交复核，但存在少扫、多扫或错扫。',
    '部分复核': '已开始复核但未完成提交，或作业中断。',
    '未复核': '尚未产生任何复核记录。',
    '复核中': '正在进行复核，尚未提交结果。',
    '复核完成': '本轮复核商品和数量均与订单一致。'
  };

  function statusTag(st) {
    st = st || '未复核';
    return '<span class="oor-status-tag oor-status-tip ' + (STATUS_CLASS[st] || 's-none') +
      '" data-tip="' + esc(STATUS_TIP[st] || '') + '" tabindex="0">' + esc(st) + '</span>';
  }

  function fmtDuration(sec) {
    if (!sec && sec !== 0) return '-';
    if (sec <= 0) return '0秒';
    var m = Math.floor(sec / 60), s = sec % 60;
    if (m <= 0) return s + '秒';
    return s > 0 ? m + '分' + s + '秒' : m + '分';
  }

  function getQueryParam(name) {
    var m = new RegExp('[?&]' + name + '=([^&]*)').exec(location.search);
    return m ? decodeURIComponent(m[1]) : '';
  }

  /* ========== 第一部分：订单信息 ========== */

  function renderOrderInfo() {
    var st = ShipCheckStore.getOrderCheckStatus(order.orderNo, order.checkStatus);
    var doneTime = ShipCheckStore.getCompletionTime(order.orderNo) || '-';
    var pairs = [
      ['出库单号', esc(order.orderNo)],
      ['订单面单号', esc(order.trackingNo)],
      ['用户编号', esc(order.userCode || '-')],
      ['运输方式', esc(order.shipChannel || '-')],
      ['是否一票多件', order.multiParcel ? '是' : '否'],
      ['发货时间', esc(fmtTime(order.shipDate))],
      ['SKU种类数', OutOrderCommon.skuKinds(order)],
      ['SKU总数(PCS)', OutOrderCommon.totalQty(order)],
      ['订单复核状态', statusTag(st)],
      ['复核次数', ShipCheckStore.countByOrder(order.orderNo)],
      ['复核完成时间', esc(fmtTime(doneTime === '-' ? '' : doneTime))]
    ];
    var html = '';
    for (var i = 0; i < pairs.length; i += 3) {
      html += '<tr>';
      for (var j = 0; j < 3; j++) {
        if (pairs[i + j]) {
          html += '<td class="ood-info-label">' + pairs[i + j][0] + '</td><td class="ood-info-value">' + pairs[i + j][1] + '</td>';
        } else {
          html += '<td class="ood-info-label"></td><td class="ood-info-value"></td>';
        }
      }
      html += '</tr>';
    }
    $('#oodInfoTable').html(html);
  }

  /* ========== 第二部分：SKU详情 ========== */

  function renderSkuDetail() {
    var $body = $('#oodSkuBody').empty();
    $.each(order.items, function (i, it) {
      $body.append('<tr><td>' + (i + 1) + '</td><td>' + esc(it.itemNo) + '</td><td>' + it.qty + '</td></tr>');
    });
    $body.append('<tr class="ood-sku-total"><td></td><td><strong>合计</strong></td><td><strong>' +
      OutOrderCommon.totalQty(order) + '</strong></td></tr>');
  }

  /* ========== 第三部分：复核档案列表 ========== */

  function renderRecords() {
    var records = ShipCheckStore.listByOrder(order.orderNo);
    var $body = $('#oodRecordBody').empty();
    $('#oodRecordEmpty').toggle(!records.length);

    $.each(records, function (i, rec) {
      var $tr = $('<tr></tr>');
      $tr.append('<td>' + esc(rec.id) + '</td>');
      $tr.append('<td>' + statusTag(rec.status) + '</td>');
      $tr.append('<td>' + esc(rec.finishType || '-') + '</td>');
      $tr.append('<td>' + esc(rec.operator) + '</td>');
      $tr.append('<td>' + esc(fmtTime(rec.startTime)) + '</td>');
      $tr.append('<td>' + esc(fmtTime(rec.endTime)) + '</td>');
      $tr.append('<td>' + (rec.status === '复核中' ? '进行中' : fmtDuration(rec.duration)) + '</td>');
      $tr.append('<td>' + (rec.totalScanCount || 0) + ' / ' + (rec.totalOrderQty || 0) + '</td>');
      var actions = '<a href="javascript:void(0);" class="ood-record-view" data-idx="' + i + '">查看</a>';
      if (rec.status !== '复核中') {
        actions += ' <a href="javascript:void(0);" class="ood-record-edit" data-idx="' + i + '">修改</a>';
      }
      $tr.append('<td>' + actions + '</td>');
      $body.append($tr);
    });

    $('#oodRecordBody').data('records', records);
  }

  /* ========== 档案明细弹窗 ========== */

  function renderDetailTable(rec) {
    var rows = $.map(rec.scanDetail || [], function (d) {
      var cls = d.scanCount > d.orderQty ? 'oor-over' : (d.scanCount < d.orderQty ? 'oor-lack' : 'oor-eq');
      var foreign = d.orderQty === 0 ? '<span style="color:#8a97a5;">（非本单料号）</span>' : '';
      return '<tr><td>' + esc(d.itemNo) + foreign + '</td>' +
        '<td class="' + cls + '">' + d.scanCount + ' / ' + d.orderQty + '</td></tr>';
    });
    return '<h4>SKU扫描明细（扫描次数 / 订单数量）</h4>' +
      '<table class="oor-sub-table"><thead><tr><th>料号</th><th style="width:160px;">扫描次数/订单数量</th></tr></thead>' +
      '<tbody>' + (rows.join('') || '<tr><td colspan="2">无</td></tr>') + '</tbody></table>';
  }

  function renderScanLogs(rec) {
    var rows = $.map(rec.scanLogs || [], function (log, idx) {
      var typeHtml = log.scanType === '错扫' ? '<span class="oor-scan-type t-wrong">错扫</span>'
        : log.scanType === '多扫' ? '<span class="oor-scan-type t-over">多扫</span>'
        : log.scanType ? esc(log.scanType) : '-';   // 旧档案无字段时显示 -
      return '<tr><td>' + (idx + 1) + '</td><td>' + esc(log.itemNo) + '</td>' +
        '<td>' + esc(fmtTime(log.time)) + '</td><td>' + esc(log.operator) + '</td>' +
        '<td>' + typeHtml + '</td></tr>';
    });
    return '<h4>逐条扫描记录</h4>' +
      '<table class="oor-sub-table"><thead><tr><th style="width:40px;">#</th><th>料号</th><th>扫描时间</th><th>操作人</th><th style="width:70px;">异常类型</th></tr></thead>' +
      '<tbody>' + (rows.join('') || '<tr><td colspan="5">无</td></tr>') + '</tbody></table>';
  }

  function openRecordModal(idx) {
    var records = $('#oodRecordBody').data('records') || [];
    var rec = records[idx];
    if (!rec) return;
    openModalIdx = idx;
    var $body = $('#oodModalBody').empty();
    $('#oodModalTitle').text('复核档案明细 - ' + rec.id);
    $body.append('<div class="ood-modal-meta">' +
      statusTag(rec.status) +
      '<span>完结类型：' + esc(rec.finishType || '-') + '</span>' +
      '<span>操作人：' + esc(rec.operator) + '</span>' +
      '<span>开始：' + esc(fmtTime(rec.startTime)) + '</span>' +
      '<span>结束：' + esc(fmtTime(rec.endTime)) + '</span>' +
      '<span>复核时长：' + (rec.status === '复核中' ? '进行中' : fmtDuration(rec.duration)) + '</span>' +
      '<span>扫描 ' + (rec.totalScanCount || 0) + ' / ' + (rec.totalOrderQty || 0) + '</span>' +
      '</div>');
    $body.append(renderDetailTable(rec));
    $body.append(renderScanLogs(rec));
    $('#oodModalBackdrop').show();
  }

  function closeModal() {
    $('#oodModalBackdrop').hide();
    openModalIdx = -1;
  }

  /* ========== 档案修改弹窗 ========== */

  function openEditModal(idx) {
    var records = $('#oodRecordBody').data('records') || [];
    var rec = records[idx];
    if (!rec || rec.status === '复核中') return;
    $('#oodEditRecId').text(rec.id).data('recId', rec.id);
    $('#oodEditStatus').val(rec.status);
    $('#oodEditFinishType').val(rec.finishType || '主动提交');
    $('#oodEditBackdrop').show();
  }

  function closeEditModal() {
    $('#oodEditBackdrop').hide();
  }

  function saveEdit() {
    var recId = $('#oodEditRecId').data('recId');
    if (!recId) return;
    ShipCheckStore.updateRecord(recId, {
      status: $('#oodEditStatus').val(),
      finishType: $('#oodEditFinishType').val()
    });
    closeEditModal();
    renderOrderInfo();   // 订单复核状态/完成时间可能变化
    renderRecords();
  }

  /* ========== 初始化 ========== */

  $(function () {
    var orderNo = getQueryParam('orderNo');
    order = OutOrderCommon.find(orderNo);

    if (!order) {
      $('#oodMain').hide();
      $('#oodEmpty').show();
      return;
    }

    renderOrderInfo();
    renderSkuDetail();
    renderRecords();

    $('#oodRecordBody').on('click', '.ood-record-view', function () {
      openRecordModal(parseInt($(this).attr('data-idx'), 10));
    });
    $('#oodRecordBody').on('click', '.ood-record-edit', function () {
      openEditModal(parseInt($(this).attr('data-idx'), 10));
    });
    // 时区切换：重新渲染订单信息与档案列表，弹窗打开中则同步刷新
    $('#oodTimeZone').val(WedoTime.get());
    $('#oodTimeZone').on('change', function () {
      WedoTime.set($(this).val());
      renderOrderInfo();
      renderRecords();
      if (openModalIdx > -1) openRecordModal(openModalIdx);
    });
    // 时区切换：重新渲染订单信息与档案列表，弹窗打开中则同步刷新
    $('#oodTimeZone').val(WedoTime.get());
    $('#oodTimeZone').on('change', function () {
      WedoTime.set($(this).val());
      renderOrderInfo();
      renderRecords();
      if (openModalIdx > -1) openRecordModal(openModalIdx);
    });
    $('#oodModalClose').on('click', closeModal);
    $('#oodModalBackdrop').on('click', function (e) {
      if (e.target === this) closeModal();
    });
    $('#oodEditSave').on('click', saveEdit);
    $('#oodEditCancel').on('click', closeEditModal);
    $('#oodEditClose').on('click', closeEditModal);
    $('#oodEditBackdrop').on('click', function (e) {
      if (e.target === this) closeEditModal();
    });
  });
})(jQuery);
