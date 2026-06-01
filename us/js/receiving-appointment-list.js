/**
 * 海外仓 us · 收货预约管理
 */
(function ($) {
  'use strict';

  var PAGE_SIZE = 10;
  var C = DeliveryAppointmentCommon;
  var currentPage = 1;
  var activeTabStatus = '';
  var activeReminderFilter = '';
  var detailBase = 'receiving-appointment-detail.html';

  var STATUS_WH_PENDING = '\u4ed3\u5e93\u5f85\u786e\u8ba4';
  var STATUS_TIMEOUT = '\u5df2\u8d85\u65f6';
  var STATUS_PENDING_DELIVERY = '\u5f85\u9001\u4ed3';

  function parseReminderFromQuery() {
    var params = new URLSearchParams(window.location.search);
    var reminder = params.get('reminder') || '';
    if (reminder === 'wh_pending') {
      activeTabStatus = STATUS_WH_PENDING;
      activeReminderFilter = '';
    } else if (reminder === 'timeout') {
      activeTabStatus = STATUS_TIMEOUT;
      activeReminderFilter = '';
    } else if (reminder === 'week_pending') {
      activeTabStatus = STATUS_PENDING_DELIVERY;
      activeReminderFilter = 'week_pending';
    }
    var status = params.get('status') || '';
    if (status && !reminder) activeTabStatus = status;
  }

  function applyReminderFilter(key) {
    if (key === 'wh_pending') {
      activeTabStatus = STATUS_WH_PENDING;
      activeReminderFilter = '';
    } else if (key === 'timeout') {
      activeTabStatus = STATUS_TIMEOUT;
      activeReminderFilter = '';
    } else if (key === 'week_pending') {
      activeTabStatus = STATUS_PENDING_DELIVERY;
      activeReminderFilter = 'week_pending';
    } else {
      return;
    }
    currentPage = 1;
    renderTabs();
    refresh(true);
    scrollToListArea();
  }

  function scrollToListArea() {
    var el = document.getElementById('recv-tab-subnav') || document.getElementById('recv-wrap');
    if (el && el.scrollIntoView) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  function clearReminderFilter() {
    activeReminderFilter = '';
  }

  function val(id) {
    var el = document.getElementById(id);
    return el ? el.value : '';
  }

  function norm(s) {
    return String(s == null ? '' : s).trim().toLowerCase();
  }

  function parseDateOnly(str) {
    if (!str) return null;
    var d = new Date(str.replace(/-/g, '/'));
    return isNaN(d.getTime()) ? null : d;
  }

  function inSubmitRange(submitTime, start, end) {
    if (!start && !end) return true;
    if (!submitTime) return false;
    var d = parseDateOnly(String(submitTime).slice(0, 10));
    if (!d) return false;
    if (start) {
      var s = parseDateOnly(start);
      if (s && d < s) return false;
    }
    if (end) {
      var e = parseDateOnly(end);
      if (e && d > e) return false;
    }
    return true;
  }

  function filtered() {
    var f = {
      appointmentNo: val('q_appointment_no').trim(),
      deliveryCode: val('q_delivery_code').trim(),
      booker: val('q_booker').trim(),
      warehouse: val('q_warehouse'),
      deliveryType: val('q_delivery_type'),
      containerNo: val('q_container_no').trim(),
      submitStart: val('q_submit_start'),
      submitEnd: val('q_submit_end')
    };
    return C.getReceivingAppointmentList().filter(function (item) {
      if (activeTabStatus && item.status !== activeTabStatus) return false;
      if (activeReminderFilter === 'week_pending' && !C.isPendingDeliveryThisWeek(item)) return false;
      if (f.appointmentNo && norm(item.appointmentNo).indexOf(norm(f.appointmentNo)) === -1) return false;
      if (f.deliveryCode && norm(item.deliveryCode).indexOf(norm(f.deliveryCode)) === -1) return false;
      if (f.booker) {
        var party = C.getBookerParty(item);
        if (norm(party).indexOf(norm(f.booker)) === -1) return false;
      }
      if (f.warehouse && item.warehouse !== f.warehouse) return false;
      if (f.deliveryType && item.deliveryType !== f.deliveryType) return false;
      if (f.containerNo && norm(item.containerNo || '').indexOf(norm(f.containerNo)) === -1) return false;
      if (!inSubmitRange(item.submitTime, f.submitStart, f.submitEnd)) return false;
      return true;
    });
  }

  function escapeHtml(s) {
    if (s == null || s === '') return '';
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function statusStyle(status) {
    if (status === '\u4ed3\u5e93\u5f85\u786e\u8ba4') return 'color:#c00;font-weight:bold;';
    if (status === '\u5ba2\u6237\u5f85\u786e\u8ba4') return 'color:#e68000;font-weight:bold;';
    if (status === '\u5df2\u9001\u4ed3') return 'color:#0e7b3c;font-weight:bold;';
    if (status === '\u5df2\u8d85\u65f6') return 'color:#888;font-weight:bold;';
    if (status === '\u9884\u7ea6\u5931\u8d25') return 'color:#999;font-weight:bold;';
    return '';
  }

  function initWarehouseFilter() {
    var wh = document.getElementById('q_warehouse');
    if (!wh) return;
    var set = {};
    C.getReceivingAppointmentList().forEach(function (item) {
      if (item.warehouse) set[item.warehouse] = true;
    });
    Object.keys(set).forEach(function (name) {
      var opt = document.createElement('option');
      opt.value = name;
      opt.textContent = name;
      wh.appendChild(opt);
    });
  }

  function countByStatus(status) {
    return C.getReceivingAppointmentList().filter(function (item) {
      return item.status === status;
    }).length;
  }

  function renderTabs() {
    var ul = document.getElementById('statusTabs');
    if (!ul) return;
    var tabs = typeof MOCK_RECEIVING_APPOINTMENT_STATUS_TABS !== 'undefined'
      ? MOCK_RECEIVING_APPOINTMENT_STATUS_TABS
      : [];

    var allCount = C.getReceivingAppointmentList().length;
    var html = '<li' + (activeTabStatus === '' ? ' class="active"' : '') + '>' +
      '<a href="#" class="brand tab-pill" data-status="">\u5168\u90e8<span>(<span class="count" style="color:#FF0000">' +
      allCount + '</span>)</span></a></li>';

    tabs.forEach(function (tab) {
      var cnt = countByStatus(tab.key);
      var active = activeTabStatus === tab.key ? ' class="active"' : '';
      html += '<li' + active + '><a href="#" class="brand tab-pill" data-status="' + escapeHtml(tab.key) + '">' +
        escapeHtml(tab.label) + '<span>(<span class="count" style="color:#FF0000">' + cnt + '</span>)</span></a></li>';
    });
    ul.innerHTML = html;
    $(ul).find('a.tab-pill').on('click', function (e) {
      e.preventDefault();
      activeTabStatus = $(this).attr('data-status') || '';
      clearReminderFilter();
      renderTabs();
      refresh(true);
    });
  }

  function renderTable(rows) {
    var tbody = document.getElementById('recv-list-tbody');
    var start = (currentPage - 1) * PAGE_SIZE;
    var pageList = rows.slice(start, start + PAGE_SIZE);
    if (!pageList.length) {
      tbody.innerHTML = '<tr><td colspan="15" style="text-align:center;color:#999;">\u6682\u65e0\u6570\u636e</td></tr>';
      return;
    }
    tbody.innerHTML = pageList.map(function (item) {
      var wh = item.warehouse || '';
      return '<tr>' +
        '<td>' + escapeHtml(item.appointmentNo || '-') + '</td>' +
        '<td>' + escapeHtml(item.deliveryCode || '-') + '</td>' +
        '<td>' + escapeHtml(C.getBookerParty(item)) + '</td>' +
        '<td style="' + statusStyle(item.status) + '">' + escapeHtml(item.status) + '</td>' +
        '<td>' + escapeHtml(item.deliveryType || '-') + '</td>' +
        '<td style="white-space:nowrap;font-size:11px;">' + escapeHtml(C.formatUsWarehouseTime(item.expectedInboundTime, wh)) + '</td>' +
        '<td style="white-space:nowrap;font-size:11px;">' + escapeHtml(C.formatUsWarehouseTime(item.warehouseConfirmedInboundTime, wh)) + '</td>' +
        '<td style="white-space:nowrap;font-size:11px;">' + escapeHtml(C.formatUsWarehouseTime(item.actualDeliveryTime, wh)) + '</td>' +
        '<td>' + escapeHtml(item.containerNo || '-') + '</td>' +
        '<td>' + escapeHtml(C.formatEstimatedCartons(item)) + '</td>' +
        '<td>' + escapeHtml(C.formatCell(item.receivedCartons)) + '</td>' +
        '<td>' + escapeHtml(C.formatPalletized(item)) + '</td>' +
        '<td>' + escapeHtml(C.formatTotalPallets(item)) + '</td>' +
        '<td>' + escapeHtml(item.submitTime || '-') + '</td>' +
        '<td><a href="' + detailBase + '?id=' + encodeURIComponent(item.id) + '">\u67e5\u770b\u8be6\u60c5</a></td>' +
        '</tr>';
    }).join('');
  }

  function renderPagination(total) {
    var totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    if (currentPage > totalPages) currentPage = totalPages;
    $('#result-total').text(total);
    $('#page-info').text('\u7b2c ' + currentPage + ' / ' + totalPages + ' \u9875\uff0c\u5171 ' + total + ' \u6761');
    $('#btn_prev_page').prop('disabled', currentPage <= 1);
    $('#btn_next_page').prop('disabled', currentPage >= totalPages);
  }

  function refresh(resetPage) {
    if (resetPage !== false) currentPage = 1;
    var rows = filtered();
    renderTable(rows);
    renderPagination(rows.length);
  }

  function bind() {
    $('#btn_recv_query').on('click', function () { refresh(true); });
    $('#btn_recv_reset').on('click', function () {
      $('#q_appointment_no,#q_delivery_code,#q_booker,#q_warehouse,#q_delivery_type,#q_container_no,#q_submit_start,#q_submit_end').val('');
      activeTabStatus = '';
      clearReminderFilter();
      renderTabs();
      refresh(true);
    });
    $('#btn_prev_page').on('click', function () {
      if (currentPage > 1) { currentPage--; refresh(false); }
    });
    $('#btn_next_page').on('click', function () {
      var total = filtered().length;
      var totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
      if (currentPage < totalPages) { currentPage++; refresh(false); }
    });
  }

  $(function () {
    if (typeof DeliveryAppointmentCommon === 'undefined') {
      window.alert('\u672a\u52a0\u8f7d\u9884\u7ea6\u9001\u4ed3\u6a21\u62df\u6570\u636e\u3002');
      return;
    }
    initWarehouseFilter();
    parseReminderFromQuery();
    renderTabs();
    bind();
    window.UsRecvAppointmentList = {
      applyReminderFilter: applyReminderFilter,
      refresh: function () { refresh(false); }
    };
    C.bindAppointmentStorageSync(function () {
      renderTabs();
      refresh(false);
      if (window.UsRecvAppointmentReminder) window.UsRecvAppointmentReminder.refresh();
    });
    refresh(true);
    if (activeReminderFilter || activeTabStatus) scrollToListArea();
  });
})(jQuery);
