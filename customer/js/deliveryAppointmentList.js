(function () {
  var PAGE_SIZE = 10;
  var C = DeliveryAppointmentCommon;
  var state = { activeTabKey: '', currentPage: 1, filteredList: [] };

  function getFilters() {
    return {
      appointmentNo: document.getElementById('filterAppointmentNo').value.trim(),
      warehouse: document.getElementById('filterWarehouse').value,
      deliveryType: document.getElementById('filterDeliveryType').value,
      status: document.getElementById('filterStatus').value
    };
  }

  function applyFilters() {
    var f = getFilters();
    var tabKey = state.activeTabKey;
    state.filteredList = C.getAppointmentList(false).filter(function (item) {
      if (tabKey && item.status !== tabKey) return false;
      if (f.appointmentNo && item.appointmentNo.indexOf(f.appointmentNo) === -1) return false;
      if (f.warehouse && item.warehouse !== f.warehouse) return false;
      if (f.deliveryType && item.deliveryType !== f.deliveryType) return false;
      if (f.status && item.status !== f.status) return false;
      return true;
    });
    state.currentPage = 1;
    renderTable();
    renderPagination();
  }

  function renderFilterOptions() {
    var wh = document.getElementById('filterWarehouse');
    if (typeof MOCK_IN_ORDER_WAREHOUSES !== 'undefined') {
      MOCK_IN_ORDER_WAREHOUSES.forEach(function (name) {
        var opt = document.createElement('option');
        opt.value = name;
        opt.textContent = name;
        wh.appendChild(opt);
      });
    }
    var st = document.getElementById('filterStatus');
    var set = {};
    C.getAppointmentList(false).forEach(function (item) { set[item.status] = true; });
    Object.keys(set).forEach(function (name) {
      var opt = document.createElement('option');
      opt.value = name;
      opt.textContent = name;
      st.appendChild(opt);
    });
  }

  function renderTabs() {
    var tabsEl = document.getElementById('tabs');
    tabsEl.innerHTML = '';
    var tabs = typeof MOCK_DELIVERY_APPOINTMENT_STATUS_TABS !== 'undefined'
      ? MOCK_DELIVERY_APPOINTMENT_STATUS_TABS : [];
    tabs.forEach(function (tab, index) {
      var el = document.createElement('div');
      el.className = 'tab' + (index === 0 ? ' active' : '');
      el.dataset.key = tab.key;
      el.textContent = tab.label;
      tabsEl.appendChild(el);
    });
    tabsEl.querySelectorAll('.tab').forEach(function (tab) {
      tab.addEventListener('click', function () {
        tabsEl.querySelectorAll('.tab').forEach(function (t) { t.classList.remove('active'); });
        tab.classList.add('active');
        state.activeTabKey = tab.dataset.key;
        applyFilters();
      });
    });
  }

  function buildOps(item) {
    var ops = C.getOperationsByStatus(item.status);
    return ops.map(function (action) {
      if (action === 'detail') {
        return '<a href="deliveryAppointmentDetail.html?id=' + encodeURIComponent(item.id) + '" class="op-btn">' + C.getOpLabel(action) + '</a>';
      }
      if (action === 'edit') {
        return '<a href="deliveryAppointmentCreate.html?id=' + encodeURIComponent(item.id) + '" class="op-btn">' + C.getOpLabel(action) + '</a>';
      }
      return '<a href="javascript:void(0)" class="op-btn" data-action="' + action + '" data-id="' + item.id + '">' + C.getOpLabel(action) + '</a>';
    }).join('');
  }

  function handleAction(id, action) {
    var item = C.getById(id, false);
    if (!item) return;
    if (action === 'submit' && !window.confirm('确认提交该预约单？')) return;
    if (action === 'discard' && !window.confirm('确认废弃该预约单？')) return;
    if (action === 'cancel' && !window.confirm('确认取消预约？')) return;
    var updated = C.applyStatusAction(item, action);
    if (!updated) return;
    if (action === 'submit' && updated.status === '待预约') {
      C.submitAppointmentRecord(updated, function (err) {
        applyFilters();
        window.alert(C.submitSuccessMessage(err));
      });
      return;
    }
    C.updateAppointment(updated, false);
    applyFilters();
    if (action !== 'detail') {
      window.alert('操作成功（原型）');
    }
  }

  function renderTable() {
    var tbody = document.getElementById('tableBody');
    var start = (state.currentPage - 1) * PAGE_SIZE;
    var pageList = state.filteredList.slice(start, start + PAGE_SIZE);
    if (!pageList.length) {
      tbody.innerHTML = '<tr class="empty-row"><td colspan="15">暂无数据</td></tr>';
      return;
    }
    tbody.innerHTML = pageList.map(function (item) {
      var sc = C.getStatusClass(item.status);
      return '<tr>' +
        '<td>' + item.warehouse + '</td>' +
        '<td>' + C.formatCell(item.appointmentNo) + '</td>' +
        '<td>' + C.formatCell(item.deliveryCode) + '</td>' +
        '<td><span class="status ' + sc + '">' + item.status + '</span></td>' +
        '<td>' + item.deliveryType + '</td>' +
        '<td>' + C.formatEstimatedCartons(item) + '</td>' +
        '<td>' + C.formatCell(item.receivedCartons) + '</td>' +
        '<td>' + C.formatPalletized(item) + '</td>' +
        '<td>' + C.formatTotalPallets(item) + '</td>' +
        '<td>' + C.formatCell(item.expectedInboundTime) + '</td>' +
        '<td>' + C.formatCell(item.warehouseConfirmedInboundTime) + '</td>' +
        '<td>' + C.formatCell(item.actualDeliveryTime) + '</td>' +
        '<td>' + C.formatCell(item.submitTime) + '</td>' +
        '<td>' + buildOps(item) + '</td></tr>';
    }).join('');
    tbody.querySelectorAll('[data-action]').forEach(function (a) {
      a.addEventListener('click', function (e) {
        e.preventDefault();
        handleAction(a.getAttribute('data-id'), a.getAttribute('data-action'));
      });
    });
  }

  function renderPagination() {
    var total = state.filteredList.length;
    var totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    if (state.currentPage > totalPages) state.currentPage = totalPages;
    var el = document.getElementById('pagination');
    var html = '<span class="muted">共 ' + total + ' 条</span>';
    html += '<div class="page-btn' + (state.currentPage <= 1 ? ' disabled' : '') + '" data-page="prev">上一页</div>';
    for (var i = 1; i <= totalPages; i++) {
      html += '<div class="page-num' + (i === state.currentPage ? ' active' : '') + '" data-page="' + i + '">' + i + '</div>';
    }
    html += '<div class="page-btn' + (state.currentPage >= totalPages ? ' disabled' : '') + '" data-page="next">下一页</div>';
    el.innerHTML = html;
    el.querySelectorAll('[data-page]').forEach(function (btn) {
      if (btn.classList.contains('disabled')) return;
      btn.addEventListener('click', function () {
        var page = btn.dataset.page;
        if (page === 'prev') state.currentPage--;
        else if (page === 'next') state.currentPage++;
        else state.currentPage = parseInt(page, 10);
        renderTable();
        renderPagination();
      });
    });
  }

  function resetForm() {
    document.getElementById('filterAppointmentNo').value = '';
    document.getElementById('filterWarehouse').value = '';
    document.getElementById('filterDeliveryType').value = '';
    document.getElementById('filterStatus').value = '';
    applyFilters();
  }

  function initMenu() {
    document.getElementById('docManageBtn').addEventListener('click', function () {
      document.getElementById('docManageSubmenu').classList.toggle('show');
    });
  }

  function init() {
    initMenu();
    renderFilterOptions();
    renderTabs();
    state.filteredList = C.getAppointmentList(false);
    document.getElementById('searchBtn').addEventListener('click', applyFilters);
    document.getElementById('resetBtn').addEventListener('click', resetForm);
    C.bindAppointmentStorageSync(applyFilters);
    renderTable();
    renderPagination();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
