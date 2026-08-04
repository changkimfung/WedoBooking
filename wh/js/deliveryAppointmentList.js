/**
 * 仓储中台 · 预约送仓管理列表
 */
(function () {
  var PAGE_SIZE = 10;
  var C = DeliveryAppointmentCommon;
  var currentPage = 1;
  var visibleCols = {};
  var activeTabKey = '';
  var selectedIds = {};
  var lastFilteredRows = [];

  var TABLE_COLUMNS = [
    { key: 'bookerParty', label: '预约方', defaultVisible: true },
    { key: 'warehouse', label: '预约仓库', defaultVisible: true },
    { key: 'appointmentNo', label: '预约单号', defaultVisible: true },
    { key: 'deliveryCode', label: '送仓码', defaultVisible: true },
    { key: 'inboundDetail', label: '货物明细', defaultVisible: true },
    { key: 'status', label: '状态', defaultVisible: true },
    { key: 'deliveryType', label: '送仓类型', defaultVisible: true },
    { key: 'estimatedCartons', label: '送仓总箱数', defaultVisible: true },
    { key: 'containerNo', label: '集装箱号', defaultVisible: true },
    { key: 'totalVolume', label: '总体积（m³）', defaultVisible: false },
    { key: 'totalWeight', label: '总重量（kg）', defaultVisible: false },
    { key: 'receivedCartons', label: '收货总箱数', defaultVisible: true },
    { key: 'isPalletized', label: '是否打托', defaultVisible: false },
    { key: 'totalPallets', label: '送仓总托数', defaultVisible: false },
    { key: 'expectedInboundTime', label: '期望送仓日期', defaultVisible: true },
    { key: 'warehouseConfirmedInboundTime', label: '仓库确认时段', defaultVisible: false },
    { key: 'actualDeliveryTime', label: '实际送仓时间', defaultVisible: true },
    { key: 'submitTime', label: '提交时间', defaultVisible: false }
  ];

  function getDefaultVisibleCols() {
    var defaults = {};
    TABLE_COLUMNS.forEach(function (col) {
      defaults[col.key] = col.defaultVisible;
    });
    return defaults;
  }

  function isColVisible(key) {
    return visibleCols[key] !== false;
  }

  function countVisibleCols() {
    return 2 + TABLE_COLUMNS.filter(function (col) { return isColVisible(col.key); }).length;
  }

  function colClass(key) {
    return 'col-toggleable' + (isColVisible(key) ? '' : ' is-col-hidden');
  }

  function applyColumnVisibility() {
    var table = document.getElementById('appt-list-table');
    if (!table) return;
    table.querySelectorAll('[data-col-key]').forEach(function (cell) {
      var key = cell.getAttribute('data-col-key');
      if (key === 'ops' || key === 'select') return;
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
      inp.checked = isColVisible(inp.getAttribute('data-col'));
    });
  }

  function val(id) {
    var el = document.getElementById(id);
    return el ? String(el.value || '').trim() : '';
  }

  function getFilters() {
    return {
      tabKey: activeTabKey || val('q_status'),
      customerCode: val('q_customer_code'),
      appointmentNo: val('q_appointment_no'),
      deliveryCode: val('q_delivery_code'),
      warehouse: val('q_warehouse'),
      deliveryType: val('q_delivery_type'),
      status: val('q_status'),
      inboundDetail: val('q_inbound_detail'),
      palletized: val('q_palletized'),
      estimatedCartons: val('q_estimated_cartons'),
      containerNo: val('q_container_no'),
      totalVolume: val('q_total_volume'),
      totalWeight: val('q_total_weight'),
      email: val('q_email'),
      submitTimeStart: val('q_submit_time_start'),
      submitTimeEnd: val('q_submit_time_end'),
      expectedTimeStart: val('q_expected_time_start'),
      expectedTimeEnd: val('q_expected_time_end'),
      actualTimeStart: val('q_actual_time_start'),
      actualTimeEnd: val('q_actual_time_end')
    };
  }

  function hasActiveFilters(f) {
    return !!(f.customerCode || f.appointmentNo || f.deliveryCode || f.warehouse || f.deliveryType ||
      f.status || f.inboundDetail || f.palletized || f.estimatedCartons || f.containerNo ||
      f.totalVolume || f.totalWeight || f.email ||
      f.submitTimeStart || f.submitTimeEnd || f.expectedTimeStart || f.expectedTimeEnd ||
      f.actualTimeStart || f.actualTimeEnd);
  }

  function getStatusTabs() {
    return typeof MOCK_DELIVERY_APPOINTMENT_STATUS_TABS !== 'undefined'
      ? MOCK_DELIVERY_APPOINTMENT_STATUS_TABS
      : [{ key: '', label: '全部' }];
  }

  function syncTabUiFromKey(tabKey) {
    activeTabKey = tabKey || '';
    var statusSel = document.getElementById('q_status');
    if (statusSel) statusSel.value = activeTabKey;
    var tabsEl = document.getElementById('apptStatusTabs');
    if (!tabsEl) return;
    tabsEl.querySelectorAll('.wh-appt-tab').forEach(function (tab) {
      tab.classList.toggle('active', (tab.dataset.key || '') === activeTabKey);
    });
  }

  function renderTabs() {
    var tabsEl = document.getElementById('apptStatusTabs');
    if (!tabsEl) return;
    tabsEl.innerHTML = '';
    getStatusTabs().forEach(function (tab) {
      var el = document.createElement('div');
      el.className = 'wh-appt-tab' + ((tab.key || '') === activeTabKey ? ' active' : '');
      el.dataset.key = tab.key || '';
      el.setAttribute('role', 'tab');
      el.setAttribute('aria-selected', (tab.key || '') === activeTabKey ? 'true' : 'false');
      el.textContent = tab.label;
      tabsEl.appendChild(el);
    });
    tabsEl.querySelectorAll('.wh-appt-tab').forEach(function (tab) {
      tab.addEventListener('click', function () {
        syncTabUiFromKey(tab.dataset.key || '');
        refresh(true);
      });
    });
  }

  function filtered() {
    return C.filterWhAppointmentList(C.getAppointmentList(true), getFilters());
  }

  function escapeHtml(s) {
    if (s == null || s === '') return '';
    var d = document.createElement('div');
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
    if (st) {
      st.innerHTML = '<option value="">全部</option>';
      getStatusTabs().forEach(function (tab) {
        if (!tab.key) return;
        var opt = document.createElement('option');
        opt.value = tab.key;
        opt.textContent = tab.label;
        st.appendChild(opt);
      });
    }
  }

  function isSelected(id) {
    return !!selectedIds[id];
  }

  function setSelected(id, checked) {
    if (!id) return;
    if (checked) selectedIds[id] = true;
    else delete selectedIds[id];
  }

  function getCurrentPageList() {
    var start = (currentPage - 1) * PAGE_SIZE;
    return lastFilteredRows.slice(start, start + PAGE_SIZE);
  }

  function syncApptSelectAll(pageList) {
    var all = document.getElementById('appt-select-all');
    if (!all) return;
    if (!pageList.length) {
      all.checked = false;
      all.indeterminate = false;
      return;
    }
    var selectedOnPage = pageList.filter(function (item) { return isSelected(item.id); }).length;
    all.checked = selectedOnPage === pageList.length;
    all.indeterminate = selectedOnPage > 0 && selectedOnPage < pageList.length;
  }

  function bindListSelectBoxes() {
    var selectAll = document.getElementById('appt-select-all');
    if (selectAll) {
      selectAll.onchange = function () {
        var checked = selectAll.checked;
        var pageList = getCurrentPageList();
        pageList.forEach(function (item) {
          setSelected(item.id, checked);
        });
        document.querySelectorAll('#appt-list-tbody .appt-row-select').forEach(function (inp) {
          inp.checked = checked;
        });
        syncApptSelectAll(pageList);
      };
    }

    var tbody = document.getElementById('appt-list-tbody');
    if (tbody && !tbody.getAttribute('data-select-bound')) {
      tbody.setAttribute('data-select-bound', '1');
      tbody.addEventListener('change', function (e) {
        var target = e.target;
        if (!target || !target.classList || !target.classList.contains('appt-row-select')) return;
        setSelected(target.getAttribute('data-id'), target.checked);
        syncApptSelectAll(getCurrentPageList());
      });
    }
  }

  function renderTable(rows) {
    lastFilteredRows = rows;
    var tbody = document.getElementById('appt-list-tbody');
    var pageList = getCurrentPageList();
    var colCount = countVisibleCols();

    if (!pageList.length) {
      tbody.innerHTML = '<tr><td colspan="' + colCount +
        '"><p style="color:red;text-align:center;margin:12px 0;">暂无数据</p></td></tr>';
      syncApptSelectAll([]);
      return;
    }

    tbody.innerHTML = pageList.map(function (item) {
      var wh = item.warehouse;
      var checkedAttr = isSelected(item.id) ? ' checked' : '';
      return '<tr>' +
        '<td data-col-key="select" class="appt-col-select">' +
          '<input type="checkbox" class="appt-row-select" data-id="' + escapeHtml(item.id) + '"' +
          checkedAttr + ' aria-label="\u9009\u62e9\u9884\u7ea6\u5355" /></td>' +
        '<td data-col-key="bookerParty" class="' + colClass('bookerParty') + '">' +
          escapeHtml(C.getBookerParty(item)) + '</td>' +
        '<td data-col-key="warehouse" class="' + colClass('warehouse') + '">' +
          escapeHtml(item.warehouse) + '</td>' +
        '<td data-col-key="appointmentNo" class="' + colClass('appointmentNo') + '">' +
          escapeHtml(item.appointmentNo || '-') + '</td>' +
        '<td data-col-key="deliveryCode" class="' + colClass('deliveryCode') + '">' +
          escapeHtml(C.formatDeliveryCodeCell(item)) + '</td>' +
        '<td data-col-key="inboundDetail" class="col-inbound-detail ' + colClass('inboundDetail') + '">' +
          C.buildInboundDetailListCell(item) + '</td>' +
        '<td data-col-key="status" class="' + colClass('status') + '">' +
          escapeHtml(item.status) + '</td>' +
        '<td data-col-key="deliveryType" class="' + colClass('deliveryType') + '">' +
          escapeHtml(item.deliveryType) + '</td>' +
        '<td data-col-key="estimatedCartons" class="' + colClass('estimatedCartons') + '">' +
          escapeHtml(C.formatEstimatedCartons(item)) + '</td>' +
        '<td data-col-key="containerNo" class="' + colClass('containerNo') + '">' +
          escapeHtml(C.formatCell(item.containerNo)) + '</td>' +
        '<td data-col-key="totalVolume" class="' + colClass('totalVolume') + '">' +
          escapeHtml(C.formatTotalVolume(item)) + '</td>' +
        '<td data-col-key="totalWeight" class="' + colClass('totalWeight') + '">' +
          escapeHtml(C.formatTotalWeight(item)) + '</td>' +
        '<td data-col-key="receivedCartons" class="' + colClass('receivedCartons') + '">' +
          escapeHtml(C.formatCell(item.receivedCartons)) + '</td>' +
        '<td data-col-key="isPalletized" class="' + colClass('isPalletized') + '">' +
          escapeHtml(C.formatPalletized(item)) + '</td>' +
        '<td data-col-key="totalPallets" class="' + colClass('totalPallets') + '">' +
          escapeHtml(C.formatTotalPallets(item)) + '</td>' +
        '<td data-col-key="expectedInboundTime" class="' + colClass('expectedInboundTime') + '">' +
          escapeHtml(C.formatExpectedInboundDatesDisplay(item, wh)) + '</td>' +
        '<td data-col-key="warehouseConfirmedInboundTime" class="' + colClass('warehouseConfirmedInboundTime') + '">' +
          escapeHtml(C.formatUsWarehouseTime(item.warehouseConfirmedInboundTime, wh)) + '</td>' +
        '<td data-col-key="actualDeliveryTime" class="' + colClass('actualDeliveryTime') + '">' +
          escapeHtml(C.formatUsWarehouseTime(item.actualDeliveryTime, wh)) + '</td>' +
        '<td data-col-key="submitTime" class="' + colClass('submitTime') + '">' +
          escapeHtml(item.submitTime || '-') + '</td>' +
        '<td data-col-key="ops" class="button"><a href="deliveryAppointmentDetail.html?id=' +
          encodeURIComponent(item.id) + '" class="inorder-op-link">详情</a></td></tr>';
    }).join('');

    tbody.querySelectorAll('.js-inbound-detail-link').forEach(function (a) {
      a.addEventListener('click', function (e) {
        e.preventDefault();
        var id = decodeURIComponent(a.getAttribute('data-appt-id') || '');
        openInboundDetailModal(C.getById(id, true));
      });
    });

    applyColumnVisibility();
    syncApptSelectAll(pageList);
  }

  function openInboundDetailModal(item) {
    if (!item) return;
    var backdrop = document.getElementById('whInboundDetailModalBackdrop');
    var tbody = document.getElementById('whInboundDetailBody');
    var subtitle = document.getElementById('whInboundDetailSubtitle');
    if (!backdrop || !tbody) return;

    if (subtitle) {
      subtitle.textContent = '预约单号：' + (item.appointmentNo || '-') +
        '　送仓码：' + C.formatDeliveryCodeCell(item);
    }

    var orders = C.buildInboundDetailRows(item);
    if (!orders.length) {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:#999;padding:12px 0;">无关联入库单</td></tr>';
    } else {
      tbody.innerHTML = orders.map(function (row) {
        return '<tr><td>' + escapeHtml(row.orderNo) + '</td><td>' + escapeHtml(row.status) +
          '</td><td>' + escapeHtml(row.warehouse) + '</td><td>' + escapeHtml(row.shippingMethod) +
          '</td><td>' + escapeHtml(row.cartons != null ? row.cartons : '-') + '</td><td>' +
          escapeHtml(row.deliveryCartons != null ? row.deliveryCartons : '-') + '</td><td>' +
          escapeHtml(row.createDate) + '</td></tr>';
      }).join('');
    }

    backdrop.style.display = 'flex';
  }

  function closeInboundDetailModal() {
    var backdrop = document.getElementById('whInboundDetailModalBackdrop');
    if (backdrop) backdrop.style.display = 'none';
  }

  function bindInboundDetailModal() {
    ['whInboundDetailModalClose', 'whInboundDetailModalOk'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.addEventListener('click', closeInboundDetailModal);
    });
    var backdrop = document.getElementById('whInboundDetailModalBackdrop');
    if (backdrop) {
      backdrop.addEventListener('click', function (e) {
        if (e.target === backdrop) closeInboundDetailModal();
      });
    }
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
    syncColPickerUi();
    applyColumnVisibility();
    renderTable(rows);
    renderPagination(rows.length);
    var hint = document.getElementById('appt-result-hint');
    if (hint) {
      var f = getFilters();
      var parts = ['共 ' + rows.length + ' 条'];
      if (activeTabKey) {
        var tabLabel = activeTabKey;
        getStatusTabs().forEach(function (tab) {
          if (tab.key === activeTabKey) tabLabel = tab.label;
        });
        parts.push('状态：' + tabLabel);
      } else if (hasActiveFilters(f)) {
        parts.push('已应用筛选条件');
      }
      parts.push('第 ' + currentPage + ' / ' + Math.max(1, Math.ceil(rows.length / PAGE_SIZE)) + ' 页');
      var selCount = Object.keys(selectedIds).length;
      if (selCount) parts.push('已选 ' + selCount + ' 条');
      hint.textContent = parts.join(' · ');
    }
  }

  function resetFilters() {
    [
      'q_customer_code', 'q_appointment_no', 'q_delivery_code', 'q_inbound_detail',
      'q_estimated_cartons', 'q_container_no', 'q_total_volume', 'q_total_weight', 'q_email',
      'q_submit_time_start', 'q_submit_time_end',
      'q_expected_time_start', 'q_expected_time_end',
      'q_actual_time_start', 'q_actual_time_end'
    ].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.value = '';
    });
    ['q_warehouse', 'q_delivery_type', 'q_status', 'q_palletized'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.value = '';
    });
    syncTabUiFromKey('');
    selectedIds = {};
    refresh(true);
  }

  function bindFilterSearch() {
    var panel = document.getElementById('whApptFilterPanel');
    if (panel) {
      panel.querySelectorAll('.wh-filter-input').forEach(function (inp) {
        inp.addEventListener('keydown', function (e) {
          if (e.key === 'Enter') {
            e.preventDefault();
            syncTabUiFromKey(val('q_status'));
            refresh(true);
          }
        });
      });
    }
    var statusSel = document.getElementById('q_status');
    if (statusSel) {
      statusSel.addEventListener('change', function () {
        syncTabUiFromKey(val('q_status'));
        refresh(true);
      });
    }
    ['q_warehouse', 'q_delivery_type', 'q_palletized'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.addEventListener('change', function () { refresh(true); });
    });
  }

  function initColPicker() {
    visibleCols = getDefaultVisibleCols();
    renderColPickerOptions();
    syncColPickerUi();
    applyColumnVisibility();

    var btn = document.getElementById('btnColSettings');
    var dropdown = document.getElementById('colPickerDropdown');
    if (!btn || !dropdown) return;

    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      if (dropdown.hasAttribute('hidden')) {
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
      visibleCols[key] = inp.checked;
      applyColumnVisibility();
      renderTable(filtered());
    });

    document.addEventListener('click', function (e) {
      var wrap = document.getElementById('colPickerWrap');
      if (!wrap || wrap.contains(e.target)) return;
      dropdown.setAttribute('hidden', '');
      btn.setAttribute('aria-expanded', 'false');
    });
  }

  function getSelectedItems() {
    return Object.keys(selectedIds).map(function (id) {
      return C.getReceivingById(id);
    }).filter(Boolean);
  }

  function showWhForceSignError(msg) {
    var el = document.getElementById('whForceSignError');
    if (!el) return;
    if (msg) {
      el.textContent = msg;
      el.style.display = 'block';
    } else {
      el.textContent = '';
      el.style.display = 'none';
    }
  }

  function closeWhForceSignModal() {
    var backdrop = document.getElementById('whForceSignModalBackdrop');
    if (backdrop) backdrop.style.display = 'none';
    showWhForceSignError('');
  }

  function openWhForceSignModal() {
    var items = getSelectedItems();
    if (!items.length) {
      window.alert('\u8bf7\u5148\u52fe\u9009\u9884\u7ea6\u5355');
      return;
    }
    var eligible = items.filter(C.isWhForceSignOffEligible);
    if (!eligible.length) {
      window.alert('\u6240\u9009\u9884\u7ea6\u5355\u987b\u4e3a\u5f85\u9001\u4ed3\u3001\u5ba2\u6237\u5f85\u786e\u8ba4\u6216\u5df2\u8d85\u65f6\u72b6\u6001');
      return;
    }
    var skipped = items.length - eligible.length;
    var summary = eligible.map(function (it) {
      return (it.appointmentNo || '-') + ' / ' + (it.status || '-');
    }).join('\n');
    if (skipped) summary += '\n\n\uff08\u5df2\u8df3\u8fc7 ' + skipped + ' \u6761\u4e0d\u7b26\u5408\u6761\u4ef6\u7684\u9009\u4e2d\u9879\uff09';
    document.getElementById('whForceSignSummary').textContent = summary;
    document.getElementById('whForceActualTime').value = C.toDatetimeLocalInputValue(C.formatNow());
    document.getElementById('whForceRemark').value = '';
    showWhForceSignError('');
    document.getElementById('whForceSignModalBackdrop').style.display = 'flex';
  }

  function submitWhForceSign() {
    var items = getSelectedItems().filter(C.isWhForceSignOffEligible);
    if (!items.length) {
      showWhForceSignError('\u65e0\u53ef\u7b7e\u6536\u7684\u9884\u7ea6\u5355');
      return;
    }
    var atVal = document.getElementById('whForceActualTime').value;
    if (!atVal) {
      showWhForceSignError('\u8bf7\u9009\u62e9\u5b9e\u9645\u9001\u4ed3\u65f6\u95f4');
      return;
    }
    var remark = document.getElementById('whForceRemark').value.trim();
    var $btn = document.getElementById('whForceSignModalSubmit');
    $btn.disabled = true;
    C.submitWhForceSignOff(items, {
      actualDeliveryTime: atVal,
      remark: remark
    }, function (err, updated) {
      $btn.disabled = false;
      if (err) {
        showWhForceSignError(err.message || String(err));
        return;
      }
      closeWhForceSignModal();
      window.alert('\u5df2\u5f3a\u5236\u7b7e\u6536 ' + (updated ? updated.length : 0) + ' \u6761\uff0c\u5df2\u540c\u6b65\u81f3\u5ba2\u6237\u4e0e\u6d77\u5916\u4ed3');
      refresh(false);
    });
  }

  function bindWhForceSignOff() {
    var btn = document.getElementById('btn_wh_force_signoff');
    if (btn) btn.addEventListener('click', openWhForceSignModal);
    var closeIds = ['whForceSignModalClose', 'whForceSignModalCancel'];
    closeIds.forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.addEventListener('click', closeWhForceSignModal);
    });
    var backdrop = document.getElementById('whForceSignModalBackdrop');
    if (backdrop) {
      backdrop.addEventListener('click', function (e) {
        if (e.target === backdrop) closeWhForceSignModal();
      });
    }
    var submitBtn = document.getElementById('whForceSignModalSubmit');
    if (submitBtn) submitBtn.addEventListener('click', submitWhForceSign);
  }

  function bind() {
    document.getElementById('btn_appt_query').addEventListener('click', function () {
      syncTabUiFromKey(val('q_status'));
      refresh(true);
    });
    document.getElementById('btn_appt_reset').addEventListener('click', resetFilters);
  }

  function init() {
    initFilters();
    renderTabs();
    syncTabUiFromKey('');
    initColPicker();
    bind();
    bindFilterSearch();
    bindInboundDetailModal();
    bindWhForceSignOff();
    bindListSelectBoxes();
    C.bindAppointmentStorageSync(function () { refresh(false); });
    refresh(true);
    window.WhDeliveryAppointmentList = {
      getSelectedIds: function () { return Object.keys(selectedIds); }
    };
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
