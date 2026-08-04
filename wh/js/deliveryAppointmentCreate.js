/**
 * 仓储中台 · 新建入库单预约
 */
(function () {
  var C = DeliveryAppointmentCommon;
  var selectedOrders = [];
  var prefillLoadingItem = null;
  var pickerRows = [];
  var pickerChecked = {};
  var CONTAINER_TYPE_OPTIONS = ['20-GP', '40-gp', '40hq', '45-hq'];

  function val(id) {
    var el = document.getElementById(id);
    return el ? String(el.value || '').trim() : '';
  }

  function isPositiveInt(v) {
    return /^[1-9]\d*$/.test(String(v || '').trim());
  }

  function isPositiveDecimal(v) {
    if (!v) return false;
    if (!/^\d+(\.\d+)?$/.test(String(v).trim())) return false;
    return Number(v) > 0;
  }

  function normalizeContainerTypeValue(raw) {
    var val = String(raw || '').trim();
    if (!val) return '';
    for (var i = 0; i < CONTAINER_TYPE_OPTIONS.length; i++) {
      if (CONTAINER_TYPE_OPTIONS[i].toLowerCase() === val.toLowerCase()) {
        return CONTAINER_TYPE_OPTIONS[i];
      }
    }
    return '';
  }

  function setContainerTypeValue(raw) {
    var sel = document.getElementById('create_container_type');
    if (!sel) return;
    var normalized = normalizeContainerTypeValue(raw);
    if (normalized) {
      sel.value = normalized;
      return;
    }
    if (raw) {
      ensureSelectOption('create_container_type', String(raw).trim());
      sel.value = String(raw).trim();
    } else {
      sel.value = '';
    }
  }

  function escapeHtml(s) {
    if (s == null || s === '') return '';
    var d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
  }

  function getQueryParams() {
    var params = {};
    var search = window.location.search ? window.location.search.slice(1) : '';
    if (!search) return params;
    search.split('&').forEach(function (pair) {
      if (!pair) return;
      var parts = pair.split('=');
      var key = decodeURIComponent(parts[0] || '');
      var value = decodeURIComponent((parts[1] || '').replace(/\+/g, ' '));
      if (key) params[key] = value;
    });
    return params;
  }

  function ensureSelectOption(id, value) {
    var sel = document.getElementById(id);
    if (!sel || !value) return;
    for (var i = 0; i < sel.options.length; i++) {
      if (sel.options[i].value === value) return;
    }
    var opt = document.createElement('option');
    opt.value = value;
    opt.textContent = value;
    sel.appendChild(opt);
  }

  function resolveDestinationWarehouse(raw) {
    var value = String(raw || '').trim();
    if (!value) return 'FBA';
    if (value.toLowerCase().indexOf('cn') === 0) return 'FBA';
    return C.normalizeWarehouseName(value);
  }

  function findLoadingByContainerNo(containerNo) {
    if (typeof MOCK_CONTAINER_LOADING_LIST === 'undefined') return null;
    var target = String(containerNo || '').trim().toLowerCase();
    if (!target) return null;
    for (var i = 0; i < MOCK_CONTAINER_LOADING_LIST.length; i++) {
      if (String(MOCK_CONTAINER_LOADING_LIST[i].containerNo || '').trim().toLowerCase() === target) {
        return MOCK_CONTAINER_LOADING_LIST[i];
      }
    }
    return null;
  }

  function resolveAppointmentWarehouse(item) {
    var tickets = (item && item.tickets) || [];
    if (tickets.length) {
      return resolveDestinationWarehouse(tickets[0].rawDestinationWarehouse);
    }
    if (item && item.destinationPort && (
      item.destinationPort.indexOf('SAVANNAH') >= 0 ||
      item.destinationPort.indexOf('NEW YORK') >= 0
    )) return C.normalizeWarehouseName('美东仓');
    return '深圳A仓';
  }

  function buildLoadingOrderSnapshot(item, ticket, idx) {
    return {
      inOrderId: 'loading-' + item.containerNo + '-' + idx,
      orderNo: ticket.ticketNo || ticket.customerOrderNo || ticket.trackingNo,
      status: '运输在途',
      warehouse: resolveDestinationWarehouse(ticket.rawDestinationWarehouse),
      shippingMethod: ticket.shippingMethod || '运德头程-海运',
      createDate: ticket.uploadedAt || '',
      cartons: Number(ticket.cartons) || 0,
      grossWeight: Number(ticket.weight) || 0,
      volume: Number(ticket.volume) || 0,
      destinationPort: ticket.destinationPort || item.destinationPort || '',
      trackingNo: ticket.trackingNo || ''
    };
  }

  function getSelectedOrderKey(row) {
    return row && (row.inOrderId || row.orderNo) ? String(row.inOrderId || row.orderNo) : '';
  }

  function isSelected(row) {
    var key = getSelectedOrderKey(row);
    if (!key) return false;
    for (var i = 0; i < selectedOrders.length; i++) {
      if (getSelectedOrderKey(selectedOrders[i]) === key || selectedOrders[i].orderNo === row.orderNo) {
        return true;
      }
    }
    return false;
  }

  function buildInOrderPickerRow(item) {
    var snap = C.snapshotInOrder(item);
    return {
      key: getSelectedOrderKey(snap),
      orderNo: snap.orderNo,
      warehouse: snap.warehouse,
      cartons: snap.cartons,
      snapshot: snap
    };
  }

  function buildLoadingPickerRow(containerItem, ticket, idx) {
    var snap = buildLoadingOrderSnapshot(containerItem, ticket, idx);
    return {
      key: getSelectedOrderKey(snap),
      orderNo: snap.orderNo,
      warehouse: snap.warehouse,
      cartons: snap.cartons,
      containerNo: containerItem.containerNo,
      snapshot: snap
    };
  }

  function syncTotalCartonsFromSelected() {
    var cartons = selectedOrders.reduce(function (sum, row) {
      return sum + (Number(row.cartons) || 0);
    }, 0);
    document.getElementById('create_total_cartons').value = cartons || '';
  }

  function applyContainerLoadingPrefill() {
    var params = getQueryParams();
    if (params.source !== 'containerLoading' || !params.containerNo) return;
    var item = findLoadingByContainerNo(params.containerNo);
    if (!item) {
      window.alert('未找到集装箱号对应的装柜清单');
      return;
    }
    prefillLoadingItem = item;
    var warehouse = resolveAppointmentWarehouse(item);
    ensureSelectOption('create_warehouse', warehouse);
    document.getElementById('create_warehouse').value = warehouse;
    document.getElementById('create_delivery_type').value = '整柜';
    document.getElementById('create_total_cartons').value = item.actualCartons || item.preloadedCartons || '';
    document.getElementById('create_is_palletized').value = 'no';
    document.getElementById('create_container_no').value = item.containerNo || '';
    setContainerTypeValue(item.containerType || '');
    selectedOrders = (item.tickets || []).map(function (ticket, idx) {
      return buildLoadingOrderSnapshot(item, ticket, idx + 1);
    });
    var hint = document.getElementById('create_inorder_hint');
    if (hint) {
      hint.textContent = '已按装柜清单集装箱号 ' + item.containerNo +
        ' 带入实装票号；目的仓 cn 开头的票号统一展示为 FBA。';
    }
  }

  function initWarehouseSelect() {
    var sel = document.getElementById('create_warehouse');
    if (!sel || typeof MOCK_IN_ORDER_WAREHOUSES === 'undefined') return;
    MOCK_IN_ORDER_WAREHOUSES.forEach(function (name) {
      var opt = document.createElement('option');
      opt.value = name;
      opt.textContent = name;
      sel.appendChild(opt);
    });
  }

  function initPickerWarehouseSelect() {
    var sel = document.getElementById('picker_warehouse');
    if (!sel) return;
    var values = {};
    if (typeof MOCK_IN_ORDER_WAREHOUSES !== 'undefined') {
      MOCK_IN_ORDER_WAREHOUSES.forEach(function (name) { values[name] = true; });
    }
    values.FBA = true;
    Object.keys(values).forEach(function (name) {
      var opt = document.createElement('option');
      opt.value = name;
      opt.textContent = name;
      sel.appendChild(opt);
    });
  }

  function renderWarehouseAddressTip() {
    C.renderWarehouseAddressTip(document.getElementById('warehouseAddressTip'), val('create_warehouse'));
  }

  function syncFields() {
    var isFcl = val('create_delivery_type') === '整柜';
    var isPalletized = val('create_is_palletized') === 'yes';
    var customerCode = document.getElementById('create_customer_code');
    if (customerCode) {
      customerCode.disabled = false;
      if (!customerCode.value || customerCode.value === '运德船务') {
        customerCode.value = C.getCurrentCustomerCode();
      }
    }
    document.getElementById('create_pallet_row').style.display = isPalletized ? '' : 'none';
    if (!isPalletized) document.getElementById('create_total_pallets').value = '';
    document.getElementById('create_fcl_row').style.display = isFcl ? '' : 'none';
    var hint = document.getElementById('create_inorder_hint');
    if (hint) {
      hint.textContent = prefillLoadingItem
        ? ('已按装柜清单集装箱号 ' + prefillLoadingItem.containerNo +
          ' 带入实装票号；目的仓 cn 开头的票号统一展示为 FBA。')
        : '仅可添加：状态=运输在途、发货方式=客户自发头程、收货仓=预约仓';
    }
    renderWarehouseAddressTip();
  }

  function renderSelectedInOrders() {
    var tbody = document.getElementById('create_selected_inorders');
    if (!selectedOrders.length) {
      tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;color:#999;">请添加入库单</td></tr>';
      return;
    }
    tbody.innerHTML = selectedOrders.map(function (row, idx) {
      var enriched = C.enrichInboundRow(row);
      var orderCartons = Number(enriched.cartons) || 0;
      var deliveryCartons = Number(row.deliveryCartons);
      if (!(deliveryCartons > 0)) deliveryCartons = orderCartons;
      return '<tr>' +
        '<td>' + escapeHtml(enriched.orderNo) + '</td>' +
        '<td>' + escapeHtml(enriched.status) + '</td>' +
        '<td>' + escapeHtml(enriched.warehouse) + '</td>' +
        '<td>' + escapeHtml(enriched.shippingMethod) + '</td>' +
        '<td>' + orderCartons + '</td>' +
        '<td><input type="number" min="1" max="' + orderCartons +
          '" step="1" class="wh-delivery-cartons-input" data-delivery-idx="' + idx +
          '" style="width:80px;padding:4px 8px;font-size:13px;" value="' + deliveryCartons + '" /></td>' +
        '<td>' + escapeHtml(enriched.createDate) + '</td>' +
        '<td><a href="javascript:void(0)" class="inorder-op-link" data-remove="' + idx + '">移除</a></td>' +
        '</tr>';
    }).join('');
    tbody.querySelectorAll('[data-remove]').forEach(function (link) {
      link.addEventListener('click', function (e) {
        e.preventDefault();
        selectedOrders.splice(parseInt(link.getAttribute('data-remove'), 10), 1);
        syncTotalCartonsFromSelected();
        renderSelectedInOrders();
      });
    });
    tbody.querySelectorAll('[data-delivery-idx]').forEach(function (inp) {
      inp.addEventListener('input', function () {
        var idx = parseInt(inp.getAttribute('data-delivery-idx'), 10);
        if (!selectedOrders[idx]) return;
        var v = inp.value.replace(/[^0-9]/g, '');
        inp.value = v;
        selectedOrders[idx].deliveryCartons = v === '' ? '' : Number(v);
      });
    });
  }

  function getPickerWarehouse() {
    return val('picker_warehouse') || val('create_warehouse');
  }

  function canUseInOrder(item) {
    var warehouse = val('create_warehouse');
    if (!item || item.status !== '运输在途') return false;
    if (warehouse && !C.isSameWarehouse(item.warehouse, warehouse)) return false;
    if (item.shippingMethod !== '客户自发头程') return false;
    return true;
  }

  function buildPickerRows() {
    var orderNo = val('picker_order_no').toLowerCase();
    var containerNo = val('picker_container_no').toLowerCase();
    var warehouse = getPickerWarehouse();
    var rows = [];
    var seen = {};

    if (containerNo && typeof MOCK_CONTAINER_LOADING_LIST !== 'undefined') {
      MOCK_CONTAINER_LOADING_LIST.forEach(function (containerItem) {
        if (String(containerItem.containerNo || '').toLowerCase().indexOf(containerNo) === -1) return;
        (containerItem.tickets || []).forEach(function (ticket, idx) {
          var row = buildLoadingPickerRow(containerItem, ticket, idx + 1);
          if (orderNo && String(row.orderNo || '').toLowerCase().indexOf(orderNo) === -1) return;
          if (warehouse && !C.isSameWarehouse(row.warehouse, warehouse)) return;
          if (seen[row.key]) return;
          seen[row.key] = true;
          rows.push(row);
        });
      });
      return rows;
    }

    if (typeof MOCK_IN_ORDER_LIST !== 'undefined') {
      MOCK_IN_ORDER_LIST.forEach(function (item) {
        if (!canUseInOrder(item)) return;
        var row = buildInOrderPickerRow(item);
        if (orderNo && String(row.orderNo || '').toLowerCase().indexOf(orderNo) === -1) return;
        if (warehouse && !C.isSameWarehouse(row.warehouse, warehouse)) return;
        if (seen[row.key]) return;
        seen[row.key] = true;
        rows.push(row);
      });
    }
    return rows;
  }

  function updatePickerHint() {
    var count = Object.keys(pickerChecked).filter(function (key) { return pickerChecked[key]; }).length;
    var hint = document.getElementById('picker_selected_hint');
    if (hint) hint.textContent = '已勾选 ' + count + ' 条';
  }

  function renderPickerRows() {
    var tbody = document.getElementById('picker_inorder_tbody');
    pickerRows = buildPickerRows();
    if (!pickerRows.length) {
      tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:#999;">暂无可选入库单</td></tr>';
      updatePickerHint();
      return;
    }
    tbody.innerHTML = pickerRows.map(function (row) {
      var disabled = isSelected(row.snapshot);
      var checked = pickerChecked[row.key] || disabled;
      return '<tr>' +
        '<td><input type="checkbox" data-key="' + escapeHtml(row.key) + '"' +
          (checked ? ' checked' : '') + (disabled ? ' disabled' : '') + '></td>' +
        '<td>' + escapeHtml(row.orderNo) + '</td>' +
        '<td>' + escapeHtml(row.warehouse) + '</td>' +
        '<td>' + escapeHtml(row.cartons) + '</td>' +
        '</tr>';
    }).join('');
    tbody.querySelectorAll('input[type="checkbox"][data-key]').forEach(function (box) {
      box.addEventListener('change', function () {
        pickerChecked[box.getAttribute('data-key')] = box.checked;
        updatePickerHint();
      });
    });
    updatePickerHint();
  }

  function openInOrderPicker() {
    var pickerWarehouse = document.getElementById('picker_warehouse');
    if (pickerWarehouse) pickerWarehouse.value = val('create_warehouse');
    pickerChecked = {};
    renderPickerRows();
    var modal = document.getElementById('inorder_picker_modal');
    modal.className = 'wh-picker-mask show';
    modal.setAttribute('aria-hidden', 'false');
  }

  function closeInOrderPicker() {
    var modal = document.getElementById('inorder_picker_modal');
    modal.className = 'wh-picker-mask';
    modal.setAttribute('aria-hidden', 'true');
  }

  function submitPickedInOrders() {
    var picked = pickerRows.filter(function (row) {
      return pickerChecked[row.key] && !isSelected(row.snapshot);
    });
    if (!picked.length) {
      window.alert('请至少勾选一条入库单');
      return;
    }
    var targetWarehouse = val('create_warehouse') || picked[0].warehouse;
    for (var i = 1; i < picked.length; i++) {
      if (!C.isSameWarehouse(picked[i].warehouse, targetWarehouse)) {
        window.alert('所选入库单目的仓不一致，请按同一目的仓勾选');
        return;
      }
    }
    ensureSelectOption('create_warehouse', targetWarehouse);
    document.getElementById('create_warehouse').value = targetWarehouse;
    picked.forEach(function (row) {
      selectedOrders.push(row.snapshot);
    });
    var containers = {};
    picked.forEach(function (row) {
      if (row.containerNo) containers[row.containerNo] = true;
    });
    var containerNos = Object.keys(containers);
    if (containerNos.length === 1 && !val('create_container_no')) {
      document.getElementById('create_container_no').value = containerNos[0];
    }
    syncTotalCartonsFromSelected();
    renderSelectedInOrders();
    syncFields();
    closeInOrderPicker();
  }

  function validateForm() {
    if (!val('create_warehouse')) return window.alert('请选择预约仓'), false;
    if (!val('create_customer_code')) {
      window.alert('请填写用户编号');
      return false;
    }
    if (!isPositiveInt(val('create_total_cartons'))) return window.alert('送仓总箱数必须为正整数'), false;
    var volume = val('create_total_volume');
    if (volume && !isPositiveDecimal(volume)) {
      window.alert('总体积须为大于 0 的数字');
      return false;
    }
    var weight = val('create_total_weight');
    if (weight && !isPositiveDecimal(weight)) {
      window.alert('总重量须为大于 0 的数字');
      return false;
    }
    if (val('create_is_palletized') === 'yes' && !isPositiveInt(val('create_total_pallets'))) {
      window.alert('送仓总托数必须为正整数');
      return false;
    }
    if (val('create_delivery_type') === '整柜') {
      if (!val('create_container_no')) return window.alert('请填写集装箱号'), false;
      var containerType = normalizeContainerTypeValue(val('create_container_type'));
      if (!containerType) return window.alert('请选择柜型'), false;
    }
    if (!selectedOrders.length) return window.alert('请至少添加一条入库单'), false;
    return true;
  }

  function buildPayload() {
    var isPalletized = val('create_is_palletized') === 'yes';
    var containerType = normalizeContainerTypeValue(val('create_container_type'));
    var volume = val('create_total_volume');
    var weight = val('create_total_weight');
    return {
      id: C.genId(),
      customerCode: val('create_customer_code'),
      bookChannel: 'customer',
      appointmentNo: C.genAppointmentNo(),
      deliveryCode: C.genDeliveryCode(),
      warehouse: C.normalizeWarehouseName(val('create_warehouse')),
      status: '仓库待审核',
      deliveryType: val('create_delivery_type') || '散货',
      expectedInboundTime: '',
      warehouseConfirmedInboundTime: '',
      actualDeliveryTime: '',
      arrivalPhotos: [],
      isPalletized: isPalletized,
      totalPallets: isPalletized ? Number(val('create_total_pallets')) : '',
      estimatedCartons: Number(val('create_total_cartons')),
      totalVolume: volume ? Number(volume) : '',
      totalWeight: weight ? Number(weight) : '',
      submitTime: C.formatNow(),
      containerNo: val('create_container_no'),
      containerType: containerType,
      containerSeq: containerType,
      emails: [],
      sourceType: prefillLoadingItem ? 'containerLoading' : '',
      sourceContainerNo: prefillLoadingItem ? prefillLoadingItem.containerNo : '',
      sourceBillOfLadingNo: prefillLoadingItem ? prefillLoadingItem.billOfLadingNo : '',
      inboundOrders: selectedOrders.slice()
    };
  }

  function openCartonsMismatchModal(message) {
    var overlay = document.getElementById('wh_cartons_mismatch_modal');
    if (!overlay) {
      window.alert(message);
      return;
    }
    document.getElementById('wh_cartons_mismatch_body').textContent = message;
    overlay.setAttribute('aria-hidden', 'false');
    overlay.style.display = 'flex';
    var okBtn = document.getElementById('btn_wh_cartons_mismatch_ok');
    okBtn.onclick = function () {
      overlay.setAttribute('aria-hidden', 'true');
      overlay.style.display = 'none';
      okBtn.onclick = null;
    };
  }

  function runCartonsConsistencyCheck(item) {
    if (typeof C.validateDeliveryCartonsConsistency !== 'function') return true;
    var result = C.validateDeliveryCartonsConsistency({
      bookChannel: item.bookChannel,
      estimatedCartons: item.estimatedCartons,
      inboundOrders: item.inboundOrders
    });
    if (result.ok) return true;
    if (result.error) {
      window.alert(result.error);
      return false;
    }
    openCartonsMismatchModal(
      '\u5f53\u524d\u9001\u4ed3\u603b\u7bb1\u6570 \u4e0e \u660e\u7ec6\u4e0d\u4e00\u81f4\uff0c\u8bf7\u786e\u8ba4\u3002\n\n' +
      (result.summary || '')
    );
    return false;
  }

  function submitForm() {
    if (!validateForm()) return;
    var item = buildPayload();
    if (!runCartonsConsistencyCheck(item)) return;
    C.addOrUpdateInMockAndPersist(item, { prepend: true }, function (err) {
      window.alert(C.persistSuccessMessage(err, '预约单已创建，状态为仓库待审核'));
      window.location.href = 'deliveryAppointment.html';
    });
  }

  function bind() {
    document.getElementById('btn_create_add_inorder').addEventListener('click', openInOrderPicker);
    document.getElementById('btn_picker_query').addEventListener('click', function () {
      pickerChecked = {};
      renderPickerRows();
    });
    document.getElementById('btn_picker_reset').addEventListener('click', function () {
      ['picker_order_no', 'picker_container_no', 'picker_warehouse'].forEach(function (id) {
        var el = document.getElementById(id);
        if (el) el.value = '';
      });
      pickerChecked = {};
      renderPickerRows();
    });
    ['picker_order_no', 'picker_container_no'].forEach(function (id) {
      document.getElementById(id).addEventListener('keydown', function (e) {
        if (e.key === 'Enter') {
          e.preventDefault();
          pickerChecked = {};
          renderPickerRows();
        }
      });
    });
    document.getElementById('btn_picker_submit').addEventListener('click', submitPickedInOrders);
    document.getElementById('btn_picker_cancel').addEventListener('click', closeInOrderPicker);
    document.getElementById('btn_picker_close').addEventListener('click', closeInOrderPicker);
    document.getElementById('inorder_picker_modal').addEventListener('click', function (e) {
      if (e.target && e.target.id === 'inorder_picker_modal') closeInOrderPicker();
    });
    document.addEventListener('keydown', function (e) {
      var modal = document.getElementById('inorder_picker_modal');
      if (e.key === 'Escape' && modal && modal.className.indexOf('show') >= 0) closeInOrderPicker();
    });
    ['create_delivery_type', 'create_is_palletized'].forEach(function (id) {
      document.getElementById(id).addEventListener('change', syncFields);
    });
    document.getElementById('create_warehouse').addEventListener('change', function () {
      renderWarehouseAddressTip();
      if (selectedOrders.length) {
        prefillLoadingItem = null;
        selectedOrders = [];
        renderSelectedInOrders();
        syncFields();
      }
    });
    document.getElementById('btn_create_submit').addEventListener('click', submitForm);
    document.getElementById('btn_create_cancel').addEventListener('click', function () {
      window.location.href = 'deliveryAppointment.html';
    });
  }

  function init() {
    initWarehouseSelect();
    initPickerWarehouseSelect();
    var bookerType = document.getElementById('create_booker_type');
    if (bookerType) {
      bookerType.value = 'customer';
      bookerType.disabled = true;
    }
    document.getElementById('create_customer_code').value = C.getCurrentCustomerCode();
    applyContainerLoadingPrefill();
    syncFields();
    renderSelectedInOrders();
    renderWarehouseAddressTip();
    bind();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
