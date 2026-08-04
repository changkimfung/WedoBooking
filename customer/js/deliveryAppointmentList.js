(function () {
  var PAGE_SIZE = 10;
  var C = DeliveryAppointmentCommon;

  var TABLE_COLUMNS = [
    { key: 'warehouse', label: '预约仓库', defaultVisible: true },
    { key: 'appointmentNo', label: '预约单号', defaultVisible: true },
    { key: 'status', label: '状态', defaultVisible: true },
    { key: 'deliveryCode', label: '送仓码', defaultVisible: true },
    { key: 'bookingLink', label: '预约链接', defaultVisible: true },
    { key: 'inboundDetail', label: '货物明细', defaultVisible: true },
    { key: 'estimatedCartons', label: '送仓总箱数', defaultVisible: true },
    { key: 'containerNo', label: '集装箱号', defaultVisible: true },
    { key: 'expectedInboundTime', label: '期望送仓时间', defaultVisible: true },
    { key: 'actualDeliveryTime', label: '实际到仓时间', defaultVisible: true },
    { key: 'deliveryType', label: '送仓类型', defaultVisible: false },
    { key: 'totalPallets', label: '送仓总托数', defaultVisible: false },
    { key: 'totalVolume', label: '总体积（m³）', defaultVisible: false },
    { key: 'totalWeight', label: '总重量（kg）', defaultVisible: false },
    { key: 'isPalletized', label: '是否打托', defaultVisible: false },
    { key: 'submitTime', label: '提交时间', defaultVisible: false }
  ];

  var state = { activeTabKey: '', currentPage: 1, filteredList: [], visibleCols: {} };

  function getDefaultVisibleCols() {
    var defaults = {};
    TABLE_COLUMNS.forEach(function (col) {
      defaults[col.key] = col.defaultVisible;
    });
    return defaults;
  }

  function syncTabUiFromTabKey(tabKey) {
    state.activeTabKey = tabKey || '';
    var statusSel = document.getElementById('filterStatus');
    if (statusSel) statusSel.value = state.activeTabKey;
    var tabsEl = document.getElementById('tabs');
    if (tabsEl) {
      tabsEl.querySelectorAll('.tab').forEach(function (t) {
        t.classList.toggle('active', (t.dataset.key || '') === state.activeTabKey);
      });
    }
  }

  function isColVisible(key) {
    return state.visibleCols[key] !== false;
  }

  function countVisibleCols() {
    return 1 + TABLE_COLUMNS.filter(function (col) { return isColVisible(col.key); }).length;
  }

  function colClass(key) {
    return 'col-toggleable' + (isColVisible(key) ? '' : ' is-col-hidden');
  }

  function applyColumnVisibility() {
    var table = document.getElementById('appointmentTable');
    if (!table) return;
    table.querySelectorAll('[data-col-key]').forEach(function (cell) {
      var key = cell.getAttribute('data-col-key');
      if (key === 'ops') return;
      if (isColVisible(key)) cell.classList.remove('is-col-hidden');
      else cell.classList.add('is-col-hidden');
    });
  }

  function renderColPickerOptions() {
    var dropdown = document.getElementById('colPickerDropdown');
    if (!dropdown) return;
    dropdown.innerHTML = TABLE_COLUMNS.map(function (col) {
      return '<label><input type="checkbox" data-col="' + col.key + '" /> ' + col.label + '</label>';
    }).join('');
  }

  function syncColPickerUi() {
    var dropdown = document.getElementById('colPickerDropdown');
    if (!dropdown) return;
    dropdown.querySelectorAll('input[data-col]').forEach(function (inp) {
      var key = inp.getAttribute('data-col');
      inp.checked = isColVisible(key);
    });
  }

  function val(id) {
    var el = document.getElementById(id);
    return el ? el.value.trim() : '';
  }

  function getFilters() {
    return {
      tabKey: state.activeTabKey,
      appointmentNo: val('filterAppointmentNo'),
      deliveryCode: val('filterDeliveryCode'),
      warehouse: document.getElementById('filterWarehouse').value,
      deliveryType: document.getElementById('filterDeliveryType').value,
      status: document.getElementById('filterStatus').value,
      inboundDetail: val('filterInboundDetail'),
      palletized: document.getElementById('filterPalletized').value,
      estimatedCartons: val('filterEstimatedCartons'),
      containerNo: val('filterContainerNo'),
      totalVolume: val('filterTotalVolume'),
      totalWeight: val('filterTotalWeight'),
      email: val('filterEmail'),
      submitTimeStart: val('filterSubmitTimeStart'),
      submitTimeEnd: val('filterSubmitTimeEnd'),
      expectedTimeStart: val('filterExpectedTimeStart'),
      expectedTimeEnd: val('filterExpectedTimeEnd'),
      actualTimeStart: val('filterActualTimeStart'),
      actualTimeEnd: val('filterActualTimeEnd')
    };
  }

  function hasActiveFilters(f) {
    return !!(f.appointmentNo || f.deliveryCode || f.warehouse || f.deliveryType || f.status ||
      f.inboundDetail || f.palletized || f.estimatedCartons || f.containerNo ||
      f.totalVolume || f.totalWeight || f.email ||
      f.submitTimeStart || f.submitTimeEnd || f.expectedTimeStart || f.expectedTimeEnd ||
      f.actualTimeStart || f.actualTimeEnd);
  }

  function renderFilterHint(total, f) {
    var el = document.getElementById('filterResultHint');
    if (!el) return;
    var parts = ['共 ' + total + ' 条'];
    if (f.tabKey) parts.push('Tab：' + f.tabKey);
    if (hasActiveFilters(f)) parts.push('已应用筛选条件');
    else if (!f.tabKey) parts.push('显示全部预约单');
    el.textContent = parts.join(' · ');
  }

  function applyFilters() {
    var f = getFilters();
    var all = C.getAppointmentList(false);
    state.filteredList = C.filterCustomerAppointmentList(all, f);
    state.currentPage = 1;
    renderFilterHint(state.filteredList.length, f);
    syncColPickerUi();
    applyColumnVisibility();
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
    var tabs = typeof MOCK_DELIVERY_APPOINTMENT_STATUS_TABS !== 'undefined'
      ? MOCK_DELIVERY_APPOINTMENT_STATUS_TABS : [];
    tabs.forEach(function (tab) {
      if (!tab.key) return;
      var opt = document.createElement('option');
      opt.value = tab.key;
      opt.textContent = tab.label;
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
        state.activeTabKey = tab.dataset.key || '';
        var statusSel = document.getElementById('filterStatus');
        if (statusSel) statusSel.value = state.activeTabKey;
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

  function openInboundDetailModal(item) {
    if (!item) return;
    var overlay = document.getElementById('modalInboundDetail');
    var tbody = document.getElementById('modalInboundDetailBody');
    var subtitle = document.getElementById('modalInboundDetailSubtitle');
    if (!overlay || !tbody) return;

    if (subtitle) {
      subtitle.textContent = '预约单号：' + (item.appointmentNo || '-') +
        '　送仓码：' + C.formatDeliveryCodeCell(item);
    }

    var orders = C.buildInboundDetailRows(item);
    if (!orders.length) {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:#9aacbf;">无关联入库单</td></tr>';
    } else {
      tbody.innerHTML = orders.map(function (row) {
        return '<tr><td>' + row.orderNo + '</td><td>' + row.status + '</td><td>' +
          row.warehouse + '</td><td>' + row.shippingMethod + '</td><td>' +
          (row.cartons != null ? row.cartons : '-') + '</td><td>' +
          (row.deliveryCartons != null ? row.deliveryCartons : '-') + '</td><td>' +
          row.createDate + '</td></tr>';
      }).join('');
    }

    overlay.setAttribute('aria-hidden', 'false');
    overlay.style.display = 'flex';
  }

  function closeInboundDetailModal() {
    var overlay = document.getElementById('modalInboundDetail');
    if (!overlay) return;
    overlay.setAttribute('aria-hidden', 'true');
    overlay.style.display = 'none';
  }

  function initInboundDetailModal() {
    var closeBtn = document.getElementById('modalInboundDetailClose');
    var overlay = document.getElementById('modalInboundDetail');
    if (closeBtn) closeBtn.addEventListener('click', closeInboundDetailModal);
    if (overlay) {
      overlay.addEventListener('click', function (e) {
        if (e.target === overlay) closeInboundDetailModal();
      });
    }
  }

  function initColPicker() {
    state.visibleCols = getDefaultVisibleCols();
    renderColPickerOptions();
    syncColPickerUi();
    applyColumnVisibility();

    var btn = document.getElementById('btnColSettings');
    var dropdown = document.getElementById('colPickerDropdown');
    if (!btn || !dropdown) return;

    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      var open = dropdown.hasAttribute('hidden');
      if (open) {
        dropdown.removeAttribute('hidden');
        btn.setAttribute('aria-expanded', 'true');
      } else {
        dropdown.setAttribute('hidden', '');
        btn.setAttribute('aria-expanded', 'false');
      }
    });

    dropdown.addEventListener('change', function (e) {
      var inp = e.target;
      if (!inp || inp.tagName !== 'INPUT' || !inp.getAttribute('data-col')) return;
      var key = inp.getAttribute('data-col');
      state.visibleCols[key] = inp.checked;
      applyColumnVisibility();
      renderTable();
      renderPagination();
    });

    document.addEventListener('click', function (e) {
      var wrap = document.getElementById('colPickerWrap');
      if (!wrap || wrap.contains(e.target)) return;
      dropdown.setAttribute('hidden', '');
      btn.setAttribute('aria-expanded', 'false');
    });
  }

  function handleAction(id, action) {
    var item = C.getById(id, false);
    if (!item) return;
    if (action === 'submit' && !window.confirm('确认提交该预约单？')) return;
    if (action === 'discard' && !window.confirm('确认废弃该预约单？')) return;
    if (action === 'cancel' && !window.confirm('确认取消预约？')) return;
    var updated = C.applyStatusAction(item, action, { customerPortal: true });
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
    var colCount = countVisibleCols();

    if (!pageList.length) {
      tbody.innerHTML = '<tr class="empty-row"><td colspan="' + colCount + '">暂无数据</td></tr>';
      return;
    }

    tbody.innerHTML = pageList.map(function (item) {
      var sc = C.getStatusClass(item.status);
      return '<tr>' +
        '<td data-col-key="warehouse" class="' + colClass('warehouse') + '">' + item.warehouse + '</td>' +
        '<td data-col-key="appointmentNo" class="' + colClass('appointmentNo') + '">' + C.formatCell(item.appointmentNo) + '</td>' +
        '<td data-col-key="status" class="' + colClass('status') + '"><span class="status ' + sc + '">' + item.status + '</span></td>' +
        '<td data-col-key="deliveryCode" class="' + colClass('deliveryCode') + '">' + C.formatDeliveryCodeCell(item) + '</td>' +
        '<td data-col-key="bookingLink" class="' + colClass('bookingLink') + '">' + C.buildBookingLinkListCell(item) + '</td>' +
        '<td data-col-key="inboundDetail" class="col-inbound-detail ' + colClass('inboundDetail') + '">' +
          C.buildInboundDetailListCell(item) + '</td>' +
        '<td data-col-key="estimatedCartons" class="' + colClass('estimatedCartons') + '">' + C.formatEstimatedCartons(item) + '</td>' +
        '<td data-col-key="containerNo" class="' + colClass('containerNo') + '">' + C.formatCell(item.containerNo) + '</td>' +
        '<td data-col-key="expectedInboundTime" class="' + colClass('expectedInboundTime') + '">' +
          C.formatExpectedInboundDatesDisplay(item, item.warehouse) + '</td>' +
        '<td data-col-key="actualDeliveryTime" class="' + colClass('actualDeliveryTime') + '">' +
          C.formatUsWarehouseTime(item.actualDeliveryTime, item.warehouse) + '</td>' +
        '<td data-col-key="deliveryType" class="' + colClass('deliveryType') + '">' + item.deliveryType + '</td>' +
        '<td data-col-key="totalPallets" class="' + colClass('totalPallets') + '">' + C.formatTotalPallets(item) + '</td>' +
        '<td data-col-key="totalVolume" class="' + colClass('totalVolume') + '">' + C.formatTotalVolume(item) + '</td>' +
        '<td data-col-key="totalWeight" class="' + colClass('totalWeight') + '">' + C.formatTotalWeight(item) + '</td>' +
        '<td data-col-key="isPalletized" class="' + colClass('isPalletized') + '">' + C.formatPalletized(item) + '</td>' +
        '<td data-col-key="submitTime" class="' + colClass('submitTime') + '">' + C.formatCell(item.submitTime) + '</td>' +
        '<td data-col-key="ops">' + buildOps(item) + '</td></tr>';
    }).join('');

    tbody.querySelectorAll('[data-action]').forEach(function (a) {
      a.addEventListener('click', function (e) {
        e.preventDefault();
        handleAction(a.getAttribute('data-id'), a.getAttribute('data-action'));
      });
    });

    tbody.querySelectorAll('.js-inbound-detail-link').forEach(function (a) {
      a.addEventListener('click', function (e) {
        e.preventDefault();
        var id = decodeURIComponent(a.getAttribute('data-appt-id') || '');
        openInboundDetailModal(C.getById(id, false));
      });
    });

    applyColumnVisibility();
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
    [
      'filterAppointmentNo', 'filterDeliveryCode', 'filterInboundDetail',
      'filterEstimatedCartons', 'filterContainerNo', 'filterTotalVolume',
      'filterTotalWeight', 'filterEmail',
      'filterSubmitTimeStart', 'filterSubmitTimeEnd',
      'filterExpectedTimeStart', 'filterExpectedTimeEnd',
      'filterActualTimeStart', 'filterActualTimeEnd'
    ].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.value = '';
    });
    document.getElementById('filterWarehouse').value = '';
    document.getElementById('filterDeliveryType').value = '';
    var palletEl = document.getElementById('filterPalletized');
    if (palletEl) palletEl.value = '';
    document.getElementById('filterStatus').value = '';
    var tabsEl = document.getElementById('tabs');
    if (tabsEl) {
      tabsEl.querySelectorAll('.tab').forEach(function (t, i) {
        t.classList.toggle('active', i === 0);
      });
      var first = tabsEl.querySelector('.tab');
      state.activeTabKey = first ? (first.dataset.key || '') : '';
    }
    applyFilters();
  }

  function bindFilterSearch() {
    var panel = document.getElementById('appointmentFilterPanel');
    if (!panel) return;
    panel.querySelectorAll('.filter-input').forEach(function (inp) {
      inp.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') {
          e.preventDefault();
          applyFilters();
        }
      });
    });
    var statusSel = document.getElementById('filterStatus');
    if (statusSel) {
      statusSel.addEventListener('change', function () {
        var tabsEl = document.getElementById('tabs');
        if (!tabsEl) return;
        tabsEl.querySelectorAll('.tab').forEach(function (t) {
          t.classList.toggle('active', (t.dataset.key || '') === statusSel.value);
        });
        state.activeTabKey = statusSel.value;
        applyFilters();
      });
    }
    ['filterWarehouse', 'filterDeliveryType', 'filterPalletized'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.addEventListener('change', applyFilters);
    });
  }

  function initMenu() {
    if (typeof ProductCommon !== 'undefined') {
      ProductCommon.initSidebarMenus();
      return;
    }
    document.getElementById('docManageBtn').addEventListener('click', function () {
      document.getElementById('docManageSubmenu').classList.toggle('show');
    });
  }

  function init() {
    initMenu();
    renderFilterOptions();
    renderTabs();
    initColPicker();
    initInboundDetailModal();
    bindFilterSearch();
    syncTabUiFromTabKey('');
    state.filteredList = C.getAppointmentList(false);
    document.getElementById('searchBtn').addEventListener('click', applyFilters);
    document.getElementById('resetBtn').addEventListener('click', resetForm);
    C.bindAppointmentStorageSync(applyFilters);
    applyFilters();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
