/**
 * 海外仓 us · 发货复核（出库单列表）PC 页
 * 列表状态实时取自 ShipCheckStore（最新一条复核档案的状态，无档案回退 mock 初始状态）
 */
(function ($) {
  'use strict';

  var STATUS_CLASS = {
    // 订单级四态
    '已达标': 's-done',
    '复核异常': 's-error',
    '部分复核': 's-partial',
    '未复核': 's-none',
    // 档案级状态（兼容保留）
    '复核中': 's-doing',
    '复核完成': 's-done'
  };

  function esc(s) {
    if (s == null) return '';
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function statusTag(st) {
    return '<span class="oor-status-tag ' + (STATUS_CLASS[st] || 's-none') + '">' + esc(st || '未复核') + '</span>';
  }

  /** 订单复核状态（四态）：已达标 / 复核异常 / 部分复核 / 未复核 */
  function orderStatus(order) {
    return ShipCheckStore.getOrderCheckStatus(order.orderNo, order.checkStatus);
  }

  /* ========== 当日指标看板 ========== */

  /** 当日已发货订单的四态指标统计（统计日期随所选时区变化） */
  function renderStats() {
    var today = WedoTime.today();
    $('#oorStatDate').text(today);
    var total = 0, met = 0, none = 0, partial = 0, abnormal = 0;
    $.each(MOCK_OUT_ORDER_LIST || [], function (i, o) {
      if (WedoTime.day(o.shipDate) !== today) return; // 仅统计当日已发货订单（发货日按所选时区换算）
      total++;
      var st = orderStatus(o);
      if (st === '已达标') met++;
      else if (st === '未复核') none++;
      else if (st === '部分复核') partial++;
      else if (st === '复核异常') abnormal++;
    });
    $('#statTotal').text(total);
    $('#statMet').text(met);
    $('#statNone').text(none);
    $('#statPartial').text(partial);
    $('#statError').text(abnormal);
    // 复核完成率 = 已合规复核订单量 / 总发货订单量，百分数保留两位小数
    $('#statRate').text(total ? (met / total * 100).toFixed(2) + '%' : '0.00%');
  }

  /* ========== 分页 ========== */

  var PAGE_SIZE = 10;
  var currentPage = 1;

  /* ========== 列表渲染 ========== */

  function getFiltered() {
    var qOrder = $.trim($('#q_order_no').val()).toUpperCase();
    var qTrack = $.trim($('#q_tracking_no').val()).toUpperCase();
    var qStatus = $('#q_check_status').val();
    var qFrom = $('#q_ship_from').val();   // YYYY-MM-DD
    var qTo = $('#q_ship_to').val();
    return $.grep(MOCK_OUT_ORDER_LIST || [], function (o) {
      if (qOrder && String(o.orderNo).toUpperCase().indexOf(qOrder) === -1) return false;
      if (qTrack && String(o.trackingNo).toUpperCase().indexOf(qTrack) === -1) return false;
      if (qStatus && orderStatus(o) !== qStatus) return false;
      var shipDay = WedoTime.day(o.shipDate);   // 发货日按所选时区换算
      if (qFrom && shipDay < qFrom) return false;
      if (qTo && shipDay > qTo) return false;
      return true;
    });
  }

  function renderPager(totalCount, totalPages) {
    var $p = $('#oorPager').empty();
    if (!totalCount) return;
    $p.append('<span class="oor-pager-info">共 ' + totalCount + ' 条 · 每页 ' + PAGE_SIZE + ' 条 · 第 ' + currentPage + '/' + totalPages + ' 页</span>');
    var $nav = $('<span class="oor-pager-nav"></span>');
    $nav.append('<button type="button" class="oor-pager-btn" data-page="' + (currentPage - 1) + '"' +
      (currentPage <= 1 ? ' disabled' : '') + '>上一页</button>');
    for (var i = 1; i <= totalPages; i++) {
      $nav.append('<button type="button" class="oor-pager-btn' + (i === currentPage ? ' active' : '') +
        '" data-page="' + i + '">' + i + '</button>');
    }
    $nav.append('<button type="button" class="oor-pager-btn" data-page="' + (currentPage + 1) + '"' +
      (currentPage >= totalPages ? ' disabled' : '') + '>下一页</button>');
    $p.append($nav);
  }

  function render() {
    renderStats();
    var list = getFiltered();
    var totalPages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
    if (currentPage > totalPages) currentPage = totalPages;
    if (currentPage < 1) currentPage = 1;
    var pageList = list.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

    var $body = $('#oorBody');
    $body.empty();
    $('#oorEmpty').toggle(!list.length);

    $.each(pageList, function (i, o) {
      var st = orderStatus(o);
      var doneTime = ShipCheckStore.getCompletionTime(o.orderNo) || '-';
      var $tr = $('<tr></tr>');
      $tr.append('<td>' + esc(o.orderNo) + '<br><span style="color:#8a97a5;font-size:12px;">' + esc(o.trackingNo) + '</span></td>');
      $tr.append('<td>' + OutOrderCommon.skuKinds(o) + '</td>');
      $tr.append('<td>' + OutOrderCommon.totalQty(o) + '</td>');
      $tr.append('<td>' + statusTag(st) + '</td>');
      $tr.append('<td>' + ShipCheckStore.countByOrder(o.orderNo) + '</td>');
      $tr.append('<td>' + esc(WedoTime.fmt(o.shipDate)) + '</td>');
      $tr.append('<td>' + (doneTime === '-' ? '-' : esc(WedoTime.fmt(doneTime))) + '</td>');
      $tr.append('<td><a href="outOrderDetail.html?orderNo=' + encodeURIComponent(o.orderNo) + '">查看详情</a></td>');
      $body.append($tr);
    });

    renderPager(list.length, totalPages);
  }

  /* ========== 导出 Excel（XML Spreadsheet，含两个工作表） ========== */

  function xmlEsc(s) {
    if (s == null) return '';
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function ssCell(v, isHead) {
    return '<Cell' + (isHead ? ' ss:StyleID="sHead"' : '') + '><Data ss:Type="String">' + xmlEsc(v) + '</Data></Cell>';
  }

  function ssRow(values, isHead) {
    var cells = '';
    for (var i = 0; i < values.length; i++) cells += ssCell(values[i], isHead);
    return '<Row>' + cells + '</Row>';
  }

  /** 按当前发货时间段条件取导出订单（不填则不限） */
  function getExportOrders() {
    var qFrom = $('#q_ship_from').val();
    var qTo = $('#q_ship_to').val();
    return $.grep(MOCK_OUT_ORDER_LIST || [], function (o) {
      var shipDay = WedoTime.day(o.shipDate);   // 发货日按所选时区换算
      if (qFrom && shipDay < qFrom) return false;
      if (qTo && shipDay > qTo) return false;
      return true;
    });
  }

  /** 生成 XML Spreadsheet 文档：分表一 订单列表 / 分表二 复核日志 */
  function buildExportXml(orders) {
    var rows1 = [ssRow(['出库单', '复核状态', '复核次数', '发货时间', '复核完成时间'], true)];
    var rows2 = [ssRow(['出库单', '复核编号', '复核状态', '操作人', '料号', '扫描时间', '异常类型'], true)];

    $.each(orders, function (i, o) {
      var doneTime = ShipCheckStore.getCompletionTime(o.orderNo);
      rows1.push(ssRow([
        o.orderNo,
        orderStatus(o),
        String(ShipCheckStore.countByOrder(o.orderNo)),
        WedoTime.fmt(o.shipDate),
        doneTime ? WedoTime.fmt(doneTime) : '-'
      ]));
      // 复核日志：该订单全部档案的逐条扫描记录（时间按所选时区）
      var records = ShipCheckStore.listByOrder(o.orderNo);
      $.each(records, function (j, rec) {
        $.each(rec.scanLogs || [], function (k, log) {
          rows2.push(ssRow([
            o.orderNo,
            rec.id,
            rec.status,
            log.operator || '-',
            log.itemNo,
            WedoTime.fmt(log.time),
            log.scanType || '-'
          ]));
        });
      });
    });

    return '<?xml version="1.0" encoding="UTF-8"?>\n' +
      '<?mso-application progid="Excel.Sheet"?>\n' +
      '<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"' +
      ' xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">\n' +
      '<Styles><Style ss:ID="sHead"><Font ss:Bold="1"/></Style></Styles>\n' +
      '<Worksheet ss:Name="订单列表"><Table>' + rows1.join('') + '</Table></Worksheet>\n' +
      '<Worksheet ss:Name="复核日志"><Table>' + rows2.join('') + '</Table></Worksheet>\n' +
      '</Workbook>';
  }

  function handleExport() {
    var orders = getExportOrders();
    if (!orders.length) {
      alert('所选发货时间范围内无订单可导出');
      return;
    }
    var qFrom = $('#q_ship_from').val() || '不限';
    var qTo = $('#q_ship_to').val() || '不限';
    var fileName = '发货复核导出_' + qFrom + '_' + qTo + '.xls';
    var blob = new Blob([buildExportXml(orders)], { type: 'application/vnd.ms-excel' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () {
      URL.revokeObjectURL(a.href);
      a.parentNode.removeChild(a);
    }, 0);
  }

  /* ========== 事件绑定 ========== */

  $(function () {
    $('#q_time_zone').val(WedoTime.get());
    render();

    $('#btn_oor_query').on('click', function () {
      currentPage = 1;
      render();
    });
    $('#btn_oor_reset').on('click', function () {
      $('#q_order_no').val('');
      $('#q_tracking_no').val('');
      $('#q_check_status').val('');
      $('#q_ship_from').val('');
      $('#q_ship_to').val('');
      currentPage = 1;
      render();
    });
    $('#btn_oor_export').on('click', handleExport);
    // 时区切换：立即重新统计与渲染（不清空其他搜索条件）
    $('#q_time_zone').on('change', function () {
      WedoTime.set($(this).val());
      currentPage = 1;
      render();
    });
    $('#oorPager').on('click', '.oor-pager-btn', function () {
      if (this.disabled) return;
      var p = parseInt($(this).attr('data-page'), 10);
      if (!p || p === currentPage) return;
      currentPage = p;
      render();
    });
  });
})(jQuery);
