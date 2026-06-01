/**
 * 仓储中台 · 预约送仓管理列表
 */
(function () {
  var PAGE_SIZE = 10;
  var C = DeliveryAppointmentCommon;
  var currentPage = 1;

  function val(id) {
    var el = document.getElementById(id);
    return el ? el.value : '';
  }

  function norm(s) {
    return String(s == null ? '' : s).trim().toLowerCase();
  }

  function filtered() {
    var f = {
      customerCode: val('q_customer_code').trim(),
      appointmentNo: val('q_appointment_no').trim(),
      warehouse: val('q_warehouse'),
      deliveryType: val('q_delivery_type'),
      status: val('q_status')
    };
    return C.getAppointmentList(true).filter(function (item) {
      if (f.customerCode && norm(item.customerCode).indexOf(norm(f.customerCode)) === -1) return false;
      if (f.appointmentNo && norm(item.appointmentNo).indexOf(norm(f.appointmentNo)) === -1) return false;
      if (f.warehouse && item.warehouse !== f.warehouse) return false;
      if (f.deliveryType && item.deliveryType !== f.deliveryType) return false;
      if (f.status && item.status !== f.status) return false;
      return true;
    });
  }

  function escapeHtml(s) {
    if (s == null || s === '') return '';
    var d = document.createElement('div');
    d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
  }

  function initFilters() {
    if (typeof MOCK_IN_ORDER_WAREHOUSES !== 'undefined') {
      var wh = document.getElementById('q_warehouse');
      wh.innerHTML = '<option value="">全部</option>';
      MOCK_IN_ORDER_WAREHOUSES.forEach(function (name) {
        var opt = document.createElement('option');
        opt.value = name;
        opt.textContent = name;
        wh.appendChild(opt);
      });
    }
    var st = document.getElementById('q_status');
    st.innerHTML = '<option value="">全部</option>';
    var set = {};
    C.getAppointmentList(true).forEach(function (item) { set[item.status] = true; });
    Object.keys(set).forEach(function (name) {
      var opt = document.createElement('option');
      opt.value = name;
      opt.textContent = name;
      st.appendChild(opt);
    });
  }

  function renderTable(rows) {
    var tbody = document.getElementById('appt-list-tbody');
    var start = (currentPage - 1) * PAGE_SIZE;
    var pageList = rows.slice(start, start + PAGE_SIZE);
    if (!pageList.length) {
      tbody.innerHTML = '<tr><td colspan="15"><p style="color:red;text-align:center;margin:12px 0;">暂无数据</p></td></tr>';
      return;
    }
    tbody.innerHTML = pageList.map(function (item) {
      return '<tr>' +
        '<td>' + escapeHtml(C.getBookerParty(item)) + '</td>' +
        '<td>' + escapeHtml(item.warehouse) + '</td>' +
        '<td>' + escapeHtml(item.appointmentNo || '-') + '</td>' +
        '<td>' + escapeHtml(item.deliveryCode || '-') + '</td>' +
        '<td>' + escapeHtml(item.status) + '</td>' +
        '<td>' + escapeHtml(item.deliveryType) + '</td>' +
        '<td>' + escapeHtml(C.formatEstimatedCartons(item)) + '</td>' +
        '<td>' + escapeHtml(C.formatCell(item.receivedCartons)) + '</td>' +
        '<td>' + escapeHtml(C.formatPalletized(item)) + '</td>' +
        '<td>' + escapeHtml(C.formatTotalPallets(item)) + '</td>' +
        '<td>' + escapeHtml(C.formatUsWarehouseTime(item.expectedInboundTime, item.warehouse)) + '</td>' +
        '<td>' + escapeHtml(C.formatUsWarehouseTime(item.warehouseConfirmedInboundTime, item.warehouse)) + '</td>' +
        '<td>' + escapeHtml(C.formatUsWarehouseTime(item.actualDeliveryTime, item.warehouse)) + '</td>' +
        '<td>' + escapeHtml(item.submitTime || '-') + '</td>' +
        '<td class="button"><a href="deliveryAppointmentDetail.html?id=' + encodeURIComponent(item.id) +
        '" class="inorder-op-link">详情</a></td></tr>';
    }).join('');
  }

  function renderPagination(total) {
    var el = document.getElementById('appt-pagination');
    var totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    if (currentPage > totalPages) currentPage = totalPages;
    var html = '<span style="color:#878787;">共 ' + total + ' 条</span>';
    html += '<button type="button" data-page="prev"' + (currentPage <= 1 ? ' disabled' : '') + '>上一页</button>';
    for (var i = 1; i <= totalPages; i++) {
      html += '<button type="button" data-page="' + i + '"' +
        (i === currentPage ? ' style="background-color:#007fbf;"' : '') + '>' + i + '</button>';
    }
    html += '<button type="button" data-page="next"' +
      (currentPage >= totalPages ? ' disabled' : '') + '>下一页</button>';
    el.innerHTML = html;
    el.querySelectorAll('[data-page]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (btn.disabled) return;
        var p = btn.getAttribute('data-page');
        if (p === 'prev') currentPage--;
        else if (p === 'next') currentPage++;
        else currentPage = parseInt(p, 10);
        refresh(false);
      });
    });
  }

  function refresh(resetPage) {
    if (resetPage !== false) currentPage = 1;
    var rows = filtered();
    renderTable(rows);
    renderPagination(rows.length);
    var hint = document.getElementById('appt-result-hint');
    if (hint) {
      hint.textContent = '共 ' + rows.length + ' 条，当前第 ' + currentPage + ' / ' +
        Math.max(1, Math.ceil(rows.length / PAGE_SIZE)) + ' 页';
    }
  }

  function bind() {
    document.getElementById('btn_appt_query').addEventListener('click', function () { refresh(true); });
    document.getElementById('btn_appt_reset').addEventListener('click', function () {
      ['q_customer_code', 'q_appointment_no', 'q_warehouse', 'q_delivery_type', 'q_status'].forEach(function (id) {
        var el = document.getElementById(id);
        if (el) el.value = '';
      });
      refresh(true);
    });
  }

  function init() {
    initFilters();
    bind();
    C.bindAppointmentStorageSync(function () { refresh(false); });
    refresh(true);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
