/**
 * 海外仓 us · 发货复核（出库单列表）PC 页
 * 列表状态实时取自 ShipCheckStore（最新一条复核档案的状态，无档案回退 mock 初始状态）
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
    // 档案级状态（兼容保留）
    '复核中': 's-doing',
    '复核完成': 's-done'
  };

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

  /** 订单复核状态（五态）：已达标 / 已合规 / 复核异常 / 部分复核 / 未复核 */
  function orderStatus(order) {
    return ShipCheckStore.getOrderCheckStatus(order.orderNo, order.checkStatus);
  }

  /* ========== 数据指标看板 ========== */

  /** 按发货时间段统计订单状态；时间均按所选时区换算 */
  function renderStats() {
    var qFrom = $('#q_ship_from').val();
    var qTo = $('#q_ship_to').val();
    var rangeText = qFrom || qTo ? (qFrom || '开始') + ' ~ ' + (qTo || '结束') : '全部发货时间';
    $('#oorStatDate').text(rangeText);
    var total = 0, met = 0, compliant = 0, none = 0, partial = 0, abnormal = 0;
    $.each(MOCK_OUT_ORDER_LIST || [], function (i, o) {
      var shipDay = WedoTime.day(o.shipDate);
      if (qFrom && shipDay < qFrom) return;
      if (qTo && shipDay > qTo) return;
      total++;
      var st = orderStatus(o);
      if (st === '已达标') met++;
      else if (st === '已合规') compliant++;
      else if (st === '未复核') none++;
      else if (st === '部分复核') partial++;
      else if (st === '复核异常') abnormal++;
    });
    $('#statTotal').text(total);
    $('#statCompliant').text(compliant);
    $('#statMet').text(met);
    $('#statNone').text(none);
    $('#statPartial').text(partial);
    $('#statError').text(abnormal);
    // 复核完成率 = 已达标订单量 + 已合规订单量 / 发货订单量，百分数保留两位小数
    $('#statRate').text(total ? ((met + compliant) / total * 100).toFixed(2) + '%' : '0.00%');
  }

  /* ========== 分页 ========== */

  var PAGE_SIZE = 10;
  var currentPage = 1;

  /* ========== 列表渲染 ========== */

  function orderKeywords() {
    var input = $.trim($('#q_order_no').val()).toUpperCase();
    if (!input) return [];
    return $.grep(input.split(/[，,;；\s]+/), function (keyword) {
      return !!keyword;
    });
  }

  function getFiltered() {
    var qOrders = orderKeywords();
    var qTrack = $.trim($('#q_tracking_no').val()).toUpperCase();
    var qStatuses = $('#q_check_status').val() || [];
    var qFrom = $('#q_ship_from').val();   // YYYY-MM-DD
    var qTo = $('#q_ship_to').val();
    return $.grep(MOCK_OUT_ORDER_LIST || [], function (o) {
      if (qOrders.length) {
        var orderNo = String(o.orderNo).toUpperCase();
        var matched = false;
        $.each(qOrders, function (i, keyword) {
          if (orderNo.indexOf(keyword) !== -1) {
            matched = true;
            return false;
          }
        });
        if (!matched) return false;
      }
      if (qTrack && String(o.trackingNo).toUpperCase().indexOf(qTrack) === -1) return false;
      if (qStatuses.length && $.inArray(orderStatus(o), qStatuses) === -1) return false;
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
      var opHtml = '<a href="outOrderDetail.html?orderNo=' + encodeURIComponent(o.orderNo) + '">查看详情</a>';
      if (st !== '已达标' && st !== '已合规') {
        opHtml += ' <a href="javascript:;" class="oor-finish-link" data-order="' + esc(o.orderNo) + '">完结</a>';
      }
      $tr.append('<td>' + opHtml + '</td>');
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

  /** 归集单条复核档案的少扫、错扫、多扫异常类型（按首次出现顺序去重） */
  function recordExceptionTypes(rec) {
    var types = [];
    function add(type) {
      if ($.inArray(type, types) === -1) types.push(type);
    }
    $.each(rec.scanDetail || [], function (i, detail) {
      // 非本单料号（订单数量为 0）由扫描日志中的错扫体现，避免同时误判为多扫
      if (detail.orderQty > 0 && detail.scanCount < detail.orderQty) add('少扫');
      if (detail.orderQty > 0 && detail.scanCount > detail.orderQty) add('多扫');
    });
    $.each(rec.scanLogs || [], function (i, log) {
      if (log.scanType === '错扫') add('错扫');
      else if (log.scanType === '多扫') add('多扫');
    });
    return types;
  }

  /** 分表一异常分析：按订单最终状态和合规前档案生成可追溯的异常说明 */
  function exportExceptionAnalysis(order, status, records) {
    if (status === '已达标') return '';

    var types = [];
    function merge(rec) {
      $.each(recordExceptionTypes(rec), function (i, type) {
        if ($.inArray(type, types) === -1) types.push(type);
      });
    }
    function analysisText(submitType) {
      return submitType + '：' + (types.join('，') || '无异常记录');
    }

    if (status === '已合规') {
      var hasManualComplete = false;
      $.each(records, function (i, rec) {
        if (rec.finishType === '人工完结') hasManualComplete = true;
      });
      if (hasManualComplete) return '人工强制完结';

      var hasAbnormalSubmit = false;
      $.each(records, function (i, rec) {
        if (rec.status === '复核异常' && rec.finishType === '主动提交') {
          hasAbnormalSubmit = true;
          merge(rec);
        }
      });
      if (hasAbnormalSubmit) return analysisText('主动提交');

      $.each(records, function (i, rec) {
        if (rec.status === '部分复核') merge(rec);
      });
      return analysisText('中断提交');
    }

    if (status === '部分复核') {
      $.each(records, function (i, rec) {
        if (rec.finishType !== '主动提交') merge(rec);
      });
      return analysisText('中断提交');
    }
    if (status === '复核异常') {
      $.each(records, function (i, rec) {
        if (rec.status === '复核异常' && rec.finishType === '主动提交') merge(rec);
      });
      return analysisText('主动提交');
    }
    return '';
  }

  /** 生成 XML Spreadsheet 文档：按类型单独导出订单列表或复核日志 */
  function buildExportXml(orders, sheetType) {
    var rows = [];
    var sheetName = sheetType === 'logs' ? '复核日志' : '订单列表';
    if (sheetType === 'logs') {
      rows.push(ssRow(['出库单', '复核编号', '复核状态', '操作人', '料号', '扫描时间', '异常类型'], true));
    } else {
      rows.push(ssRow(['出库单', 'SKU种类数', 'SKU总数（PCS）', '复核状态', '复核次数', '发货时间', '复核完成时间', '异常分析'], true));
    }

    $.each(orders, function (i, o) {
      var status = orderStatus(o);
      var records = ShipCheckStore.listByOrder(o.orderNo);
      var doneTime = ShipCheckStore.getCompletionTime(o.orderNo);
      if (sheetType === 'logs') {
        // 复核日志：该订单全部档案的逐条扫描记录（时间按所选时区）
        $.each(records, function (j, rec) {
          $.each(rec.scanLogs || [], function (k, log) {
            rows.push(ssRow([
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
      } else {
        rows.push(ssRow([
          o.orderNo,
          String(OutOrderCommon.skuKinds(o)),
          String(OutOrderCommon.totalQty(o)),
          status,
          String(ShipCheckStore.countByOrder(o.orderNo)),
          WedoTime.fmt(o.shipDate),
          doneTime ? WedoTime.fmt(doneTime) : '-',
          exportExceptionAnalysis(o, status, records)
        ]));
      }
    });

    return '<?xml version="1.0" encoding="UTF-8"?>\n' +
      '<?mso-application progid="Excel.Sheet"?>\n' +
      '<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"' +
      ' xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">\n' +
      '<Styles><Style ss:ID="sHead"><Font ss:Bold="1"/></Style></Styles>\n' +
      '<Worksheet ss:Name="' + sheetName + '"><Table>' + rows.join('') + '</Table></Worksheet>\n' +
      '</Workbook>';
  }

  function handleExport(sheetType) {
    var orders = getExportOrders();
    var exportName = sheetType === 'logs' ? '复核日志' : '订单列表';
    if (!orders.length) {
      alert('所选发货时间范围内无订单可导出');
      return;
    }
    var qFrom = $('#q_ship_from').val() || '不限';
    var qTo = $('#q_ship_to').val() || '不限';
    var fileName = '发货复核' + exportName + '_' + qFrom + '_' + qTo + '.xls';
    var blob = new Blob([buildExportXml(orders, sheetType)], { type: 'application/vnd.ms-excel' });
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
      $('#q_check_status option').prop('selected', false);
      $('#q_ship_from').val('');
      $('#q_ship_to').val('');
      currentPage = 1;
      render();
    });
    $('#btn_oor_export_orders').on('click', function () { handleExport('orders'); });
    $('#btn_oor_export_logs').on('click', function () { handleExport('logs'); });
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
    // 人工完结：生成一条「复核完成 / 人工完结」档案，订单状态变为已合规
    $('#oorBody').on('click', '.oor-finish-link', function () {
      var orderNo = $(this).attr('data-order');
      var order = null;
      $.each(MOCK_OUT_ORDER_LIST || [], function (i, o) {
        if (o.orderNo === orderNo) { order = o; return false; }
      });
      if (!order) return;
      if (!confirm('确认将出库单 ' + orderNo + ' 人工完结为「已合规」吗？')) return;
      ShipCheckStore.completeOrder(order, '演示用户');
      render();
    });
  });
})(jQuery);
