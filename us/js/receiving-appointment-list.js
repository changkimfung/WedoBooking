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
  var selectedIds = {};

  var STATUS_WH_PENDING = '\u4ed3\u5e93\u5f85\u5ba1\u6838';
  var STATUS_CUSTOMER_PENDING = '\u5ba2\u6237\u5f85\u786e\u8ba4';
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
      inboundNo: val('q_inbound_no').trim(),
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
      if (f.inboundNo && !C.matchInboundDetailSearch(item, f.inboundNo)) return false;
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
    if (status === '\u4ed3\u5e93\u5f85\u5ba1\u6838') return 'color:#c00;font-weight:bold;';
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

  function buildOpsCell(item) {
    var parts = [];
    if (item.status === STATUS_WH_PENDING) {
      parts.push('<button type="button" class="btn btn-primary btn-mini btn-recv-audit" data-id="' +
        escapeHtml(item.id) + '" style="margin-right:6px;">\u5ba1\u6838</button>');
    }
    if (item.status === STATUS_CUSTOMER_PENDING) {
      parts.push('<button type="button" class="btn btn-primary btn-mini btn-recv-audit-update" data-id="' +
        escapeHtml(item.id) + '" style="margin-right:6px;">\u66f4\u65b0\u5ba1\u6838</button>');
    }
    parts.push('<a href="' + detailBase + '?id=' + encodeURIComponent(item.id) + '">\u67e5\u770b\u8be6\u60c5</a>');
    return parts.join(' ');
  }

  function isSelected(id) {
    return !!selectedIds[id];
  }

  function setSelected(id, checked) {
    if (!id) return;
    if (checked) selectedIds[id] = true;
    else delete selectedIds[id];
  }

  function syncRecvSelectAll(pageList) {
    var $all = $('#recv-select-all');
    if (!$all.length) return;
    var eligibleOnPage = pageList.filter(C.isEligibleForRecvListSelect);
    if (!eligibleOnPage.length) {
      $all.prop({ checked: false, indeterminate: false });
      return;
    }
    var selectedOnPage = eligibleOnPage.filter(function (item) { return isSelected(item.id); }).length;
    $all.prop('checked', selectedOnPage === eligibleOnPage.length);
    $all.prop('indeterminate', selectedOnPage > 0 && selectedOnPage < eligibleOnPage.length);
  }

  function getSelectedItems() {
    return Object.keys(selectedIds).map(function (id) {
      return C.getReceivingById(id);
    }).filter(Boolean);
  }

  function submitEmptyContainerReturn() {
    var items = getSelectedItems();
    if (!items.length) {
      window.alert('\u8bf7\u5148\u52fe\u9009\u9884\u7ea6\u5355');
      return;
    }
    var eligible = items.filter(C.isEligibleForEmptyContainerReturn);
    var skipped = items.length - eligible.length;
    if (!eligible.length) {
      window.alert('\u6240\u9009\u9884\u7ea6\u5355\u987b\u4e3a\u6574\u67dc\u6216\u5df2\u586b\u5199\u96c6\u88c5\u7bb1\u53f7');
      return;
    }
    var lines = eligible.map(function (it) {
      return (it.appointmentNo || '-') + ' / ' + (it.containerNo || '-') + ' \u2192 ' + C.formatContactEmailsDisplay(it);
    });
    var msg = '\u786e\u8ba4\u4e3a\u4ee5\u4e0b ' + eligible.length + ' \u6761\u9884\u7ea6\u5355\u53d1\u9001\u8fd8\u7a7a\u901a\u77e5\uff1f\n\n' + lines.join('\n');
    if (skipped) msg += '\n\n\uff08\u5df2\u8df3\u8fc7 ' + skipped + ' \u6761\u4e0d\u7b26\u5408\u6761\u4ef6\u7684\u9009\u4e2d\u9879\uff09';
    if (!window.confirm(msg)) return;
    var $btn = $('#btn_empty_container_return').prop('disabled', true);
    C.submitEmptyContainerReturnNotify(eligible, function (err, updated) {
      $btn.prop('disabled', false);
      if (err) {
        window.alert('\u63d0\u4ea4\u5931\u8d25\uff1a' + (err.message || err));
        return;
      }
      window.alert('\u5df2\u53d1\u9001\u8fd8\u7a7a\u901a\u77e5 ' + (updated ? updated.length : 0) + ' \u5c01');
      refresh(false);
    });
  }

  function bindListSelectBoxes() {
    $('#recv-select-all').off('change.recvSelectAll').on('change.recvSelectAll', function () {
      var checked = $(this).prop('checked');
      $('#recv-list-tbody .recv-row-select:not(:disabled)').each(function () {
        setSelected($(this).attr('data-id'), checked);
        $(this).prop('checked', checked);
      });
      syncRecvSelectAll(getCurrentPageList());
    });

    $('#recv-list-tbody').off('change.recvRowSelect').on('change.recvRowSelect', '.recv-row-select', function () {
      var id = $(this).attr('data-id');
      setSelected(id, $(this).prop('checked'));
      syncRecvSelectAll(getCurrentPageList());
    });
  }

  var lastFilteredRows = [];

  function getCurrentPageList() {
    var start = (currentPage - 1) * PAGE_SIZE;
    return lastFilteredRows.slice(start, start + PAGE_SIZE);
  }

  function bindListAuditButtons() {
    $('#recv-list-tbody').off('click.recvAudit').on('click.recvAudit', '.btn-recv-audit', function () {
      var id = $(this).attr('data-id');
      if (!id || !window.UsRecvAppointmentAudit) return;
      var item = C.getReceivingById(id);
      if (!item) {
        window.alert('\u9884\u7ea6\u5355\u4e0d\u5b58\u5728');
        return;
      }
      UsRecvAppointmentAudit.openForItem(item, 'initial');
    });
    $('#recv-list-tbody').off('click.recvAuditUpdate').on('click.recvAuditUpdate', '.btn-recv-audit-update', function () {
      var id = $(this).attr('data-id');
      if (!id || !window.UsRecvAppointmentAudit) return;
      var item = C.getReceivingById(id);
      if (!item) {
        window.alert('\u9884\u7ea6\u5355\u4e0d\u5b58\u5728');
        return;
      }
      UsRecvAppointmentAudit.openUpdateForItem(item);
    });
  }

  function renderTable(rows) {
    lastFilteredRows = rows;
    var tbody = document.getElementById('recv-list-tbody');
    var pageList = getCurrentPageList();
    if (!pageList.length) {
      tbody.innerHTML = '<tr><td colspan="17" style="text-align:center;color:#999;">\u6682\u65e0\u6570\u636e</td></tr>';
      syncRecvSelectAll([]);
      return;
    }
    tbody.innerHTML = pageList.map(function (item) {
      var wh = item.warehouse || '';
      var eligible = C.isEligibleForRecvListSelect(item);
      if (!eligible && isSelected(item.id)) delete selectedIds[item.id];
      var checked = eligible && isSelected(item.id) ? ' checked' : '';
      var selectTitle = '\u5f85\u9001\u4ed3/\u5df2\u9001\u4ed3\u53ef\u7b7e\u6536\u6216\u66f4\u65b0\uff1b\u6574\u67dc\u6216\u5df2\u586b\u7bb1\u53f7\u53ef\u8fd8\u67dc';
      var selectCell = eligible
        ? '<input type="checkbox" class="recv-row-select" data-id="' + escapeHtml(item.id) + '"' + checked +
          ' aria-label="\u9009\u62e9\u9884\u7ea6\u5355" />'
        : '<input type="checkbox" disabled title="' + selectTitle + '" />';
      return '<tr>' +
        '<td class="recv-col-select">' + selectCell + '</td>' +
        '<td>' + escapeHtml(item.appointmentNo || '-') + '</td>' +
        '<td>' + escapeHtml(item.deliveryCode || '-') + '</td>' +
        '<td>' + escapeHtml(C.getBookerParty(item)) + '</td>' +
        '<td style="' + statusStyle(item.status) + '">' + escapeHtml(item.status) + '</td>' +
        '<td>' + escapeHtml(item.deliveryType || '-') + '</td>' +
        '<td style="white-space:nowrap;font-size:11px;">' + escapeHtml(C.formatExpectedInboundDatesDisplay(item, wh)) + '</td>' +
        '<td style="white-space:nowrap;font-size:11px;">' + escapeHtml(C.formatUsWarehouseTime(item.warehouseConfirmedInboundTime, wh)) + '</td>' +
        '<td style="white-space:nowrap;font-size:11px;">' + escapeHtml(C.formatUsWarehouseTime(item.actualDeliveryTime, wh)) + '</td>' +
        '<td>' + escapeHtml(item.containerNo || '-') + '</td>' +
        '<td>' + escapeHtml(C.formatEstimatedCartons(item)) + '</td>' +
        '<td>' + escapeHtml(C.formatTotalVolume(item)) + '</td>' +
        '<td>' + escapeHtml(C.formatTotalWeight(item)) + '</td>' +
        '<td>' + escapeHtml(C.formatCell(item.receivedCartons)) + '</td>' +
        '<td>' + escapeHtml(C.formatTotalPallets(item)) + '</td>' +
        '<td>' + escapeHtml(item.submitTime || '-') + '</td>' +
        '<td class="recv-list-ops">' + buildOpsCell(item) + '</td>' +
        '</tr>';
    }).join('');
    bindListAuditButtons();
    bindListSelectBoxes();
    syncRecvSelectAll(pageList);
  }

  function renderPagination(total) {
    var totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    if (currentPage > totalPages) currentPage = totalPages;
    $('#result-total').text(total);
    var info = '\u7b2c ' + currentPage + ' / ' + totalPages + ' \u9875\uff0c\u5171 ' + total + ' \u6761';
    var selCount = Object.keys(selectedIds).length;
    if (selCount) info += '\uff0c\u5df2\u9009 ' + selCount + ' \u6761';
    $('#page-info').text(info);
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
    $('#btn_empty_container_return').on('click', submitEmptyContainerReturn);
    $('#btn_recv_reset').on('click', function () {
      $('#q_appointment_no,#q_inbound_no,#q_delivery_code,#q_booker,#q_warehouse,#q_delivery_type,#q_container_no,#q_submit_start,#q_submit_end').val('');
      activeTabStatus = '';
      clearReminderFilter();
      selectedIds = {};
      renderTabs();
      refresh(true);
    });
    bindListSelectBoxes();
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
    if (window.UsRecvAppointmentAudit) {
      UsRecvAppointmentAudit.init({
        onSuccess: function () {
          renderTabs();
          refresh(false);
          if (window.UsRecvAppointmentReminder) window.UsRecvAppointmentReminder.refresh();
        }
      });
    }
    if (window.UsRecvAppointmentSignOff) {
      UsRecvAppointmentSignOff.init({
        batchBtn: '#btn_batch_signoff',
        getSelectedItems: getSelectedItems,
        onSuccess: function () {
          selectedIds = {};
          renderTabs();
          refresh(false);
          if (window.UsRecvAppointmentReminder) window.UsRecvAppointmentReminder.refresh();
        }
      });
    }
    window.UsRecvAppointmentList = {
      applyReminderFilter: applyReminderFilter,
      refresh: function () { refresh(false); },
      getSelectedIds: function () { return Object.keys(selectedIds); }
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
