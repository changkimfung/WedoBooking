(function () {
  var C = DeliveryAppointmentCommon;
  var selectedOrders = [];
  var editingItem = null;
  var CONTAINER_TYPE_OPTIONS = ['20-GP', '40-gp', '40hq', '45-hq'];

  function getQueryId() {
    var m = window.location.search.match(/[?&]id=([^&]+)/);
    return m ? decodeURIComponent(m[1]) : '';
  }

  function getWarehouse() {
    return document.getElementById('warehouse').value;
  }

  function getDeliveryType() {
    var r = document.querySelector('input[name="deliveryType"]:checked');
    return r ? r.value : '散货';
  }

  function getContainerType() {
    var el = document.getElementById('containerType');
    return el ? el.value.trim() : '';
  }

  function normalizeContainerTypeValue(raw) {
    var val = String(raw || '').trim();
    if (!val) return '';
    for (var i = 0; i < CONTAINER_TYPE_OPTIONS.length; i++) {
      if (CONTAINER_TYPE_OPTIONS[i].toLowerCase() === val.toLowerCase()) {
        return CONTAINER_TYPE_OPTIONS[i];
      }
    }
    return val;
  }

  function isAllowedContainerType(val) {
    return CONTAINER_TYPE_OPTIONS.indexOf(val) !== -1;
  }

  function setContainerTypeValue(raw) {
    var input = document.getElementById('containerType');
    if (!input) return;
    input.value = normalizeContainerTypeValue(raw);
  }

  function renderContainerTypeDropdown(filterText) {
    var dropdown = document.getElementById('containerTypeDropdown');
    if (!dropdown) return;
    var kw = String(filterText || '').trim().toLowerCase();
    var matched = CONTAINER_TYPE_OPTIONS.filter(function (opt) {
      return !kw || opt.toLowerCase().indexOf(kw) !== -1;
    });
    if (!matched.length) {
      dropdown.innerHTML = '<li class="is-empty">无匹配项</li>';
      return;
    }
    dropdown.innerHTML = matched.map(function (opt) {
      return '<li data-value="' + opt + '">' + opt + '</li>';
    }).join('');
  }

  function openContainerTypeDropdown() {
    var dropdown = document.getElementById('containerTypeDropdown');
    var input = document.getElementById('containerType');
    if (!dropdown || !input) return;
    renderContainerTypeDropdown(input.value);
    dropdown.removeAttribute('hidden');
  }

  function closeContainerTypeDropdown() {
    var dropdown = document.getElementById('containerTypeDropdown');
    if (!dropdown) return;
    dropdown.setAttribute('hidden', '');
  }

  function initContainerTypeCombo() {
    var wrap = document.getElementById('containerTypeCombo');
    var input = document.getElementById('containerType');
    var dropdown = document.getElementById('containerTypeDropdown');
    var toggle = document.getElementById('containerTypeToggle');
    if (!wrap || !input || !dropdown) return;

    function pickOption(value) {
      input.value = value;
      closeContainerTypeDropdown();
      input.blur();
    }

    toggle.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      if (dropdown.hasAttribute('hidden')) openContainerTypeDropdown();
      else closeContainerTypeDropdown();
    });

    input.addEventListener('focus', function () {
      openContainerTypeDropdown();
    });

    input.addEventListener('input', function () {
      openContainerTypeDropdown();
    });

    dropdown.addEventListener('mousedown', function (e) {
      var li = e.target.closest('li[data-value]');
      if (!li) return;
      e.preventDefault();
      pickOption(li.getAttribute('data-value'));
    });

    input.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        closeContainerTypeDropdown();
        return;
      }
      if (e.key === 'Enter') {
        var first = dropdown.querySelector('li[data-value]');
        if (first) {
          e.preventDefault();
          pickOption(first.getAttribute('data-value'));
        }
      }
    });

    input.addEventListener('blur', function () {
      window.setTimeout(function () {
        var normalized = normalizeContainerTypeValue(input.value);
        if (normalized && isAllowedContainerType(normalized)) input.value = normalized;
        else if (input.value.trim()) input.value = '';
        closeContainerTypeDropdown();
      }, 120);
    });

    document.addEventListener('click', function (e) {
      if (!wrap.contains(e.target)) closeContainerTypeDropdown();
    });
  }

  function getIsPalletized() {
    var r = document.querySelector('input[name="isPalletized"]:checked');
    return r ? r.value === 'yes' : false;
  }

  function getTotalPallets() {
    var el = document.getElementById('totalPallets');
    return el ? el.value.trim() : '';
  }

  function getEstimatedCartons() {
    var el = document.getElementById('estimatedCartons');
    return el ? el.value.trim() : '';
  }

  function getTotalVolumeInput() {
    var el = document.getElementById('totalVolume');
    return el ? el.value.trim() : '';
  }

  function getTotalWeightInput() {
    var el = document.getElementById('totalWeight');
    return el ? el.value.trim() : '';
  }

  function isPositiveDecimal(val) {
    if (!val) return false;
    if (!/^\d+(\.\d+)?$/.test(val)) return false;
    return Number(val) > 0;
  }

  function setRadioValue(name, value) {
    var el = document.querySelector('input[name="' + name + '"][value="' + value + '"]');
    if (el) el.checked = true;
  }

  function toggleFclFields() {
    var isFcl = getDeliveryType() === '整柜';
    var block = document.getElementById('fclFields');
    if (isFcl) block.classList.add('show');
    else block.classList.remove('show');
  }

  function togglePalletFields() {
    var block = document.getElementById('palletFields');
    var input = document.getElementById('totalPallets');
    if (!block) return;
    if (getIsPalletized()) {
      block.classList.add('show');
    } else {
      block.classList.remove('show');
      if (input) input.value = '';
    }
  }

  function renderSelectedTable() {
    var tbody = document.getElementById('selectedInOrders');
    if (!selectedOrders.length) {
      tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;color:#9aacbf;">请添加入库单</td></tr>';
      return;
    }
    tbody.innerHTML = selectedOrders.map(function (row, idx) {
      var enriched = C.enrichInboundRow(row);
      var orderCartons = Number(enriched.cartons) || 0;
      var deliveryCartons = Number(row.deliveryCartons);
      if (!(deliveryCartons > 0)) deliveryCartons = orderCartons;
      return '<tr>' +
        '<td>' + enriched.orderNo + '</td>' +
        '<td>' + enriched.status + '</td>' +
        '<td>' + enriched.warehouse + '</td>' +
        '<td>' + enriched.shippingMethod + '</td>' +
        '<td>' + orderCartons + '</td>' +
        '<td><input type="number" min="1" max="' + orderCartons +
          '" step="1" class="input delivery-cartons-input" ' +
          'data-delivery-idx="' + idx + '" ' +
          'style="width:80px;" value="' + deliveryCartons + '" /></td>' +
        '<td>' + enriched.createDate + '</td>' +
        '<td><a href="javascript:void(0)" class="op-btn" data-idx="' + idx + '">取消</a></td></tr>';
    }).join('');
    tbody.querySelectorAll('[data-idx]').forEach(function (a) {
      a.addEventListener('click', function (e) {
        e.preventDefault();
        selectedOrders.splice(parseInt(a.getAttribute('data-idx'), 10), 1);
        renderSelectedTable();
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

  function orderNoMatches(orderNo, keyword) {
    return C.normSearchText(orderNo).indexOf(C.normSearchText(keyword)) !== -1;
  }

  function validateAndFindInOrder(keyword, silent) {
    var kw = keyword.trim();
    if (!kw) {
      if (!silent) window.alert('请输入入库单号');
      return { ok: false, error: '请输入入库单号' };
    }
    var warehouse = getWarehouse();
    if (!warehouse) {
      if (!silent) window.alert('请先选择预约仓');
      return { ok: false, error: '请先选择预约仓' };
    }
    var eligible = C.getEligibleInOrders(warehouse);
    var found = null;
    var exactFound = null;
    for (var i = 0; i < eligible.length; i++) {
      if (orderNoMatches(eligible[i].orderNo, kw)) {
        if (C.normSearchText(eligible[i].orderNo) === C.normSearchText(kw)) exactFound = eligible[i];
        if (!found) found = eligible[i];
      }
    }
    if (exactFound) found = exactFound;
    if (!found) {
      var inList = typeof MOCK_IN_ORDER_LIST !== 'undefined' ? MOCK_IN_ORDER_LIST : [];
      for (var j = 0; j < inList.length; j++) {
        if (orderNoMatches(inList[j].orderNo, kw)) {
          var o = inList[j];
          if (o.status !== '运输在途') {
            if (!silent) window.alert('仅可添加状态为「运输在途」的入库单');
            return { ok: false, error: '「' + kw + '」状态非运输在途' };
          }
          if (o.shippingMethod !== '客户自发头程') {
            if (!silent) window.alert('仅可添加发货方式为「客户自发头程」的入库单');
            return { ok: false, error: '「' + kw + '」发货方式不符' };
          }
          if (!C.isSameWarehouse(o.warehouse, warehouse)) {
            if (!silent) window.alert('入库单收货仓须与预约仓一致');
            return { ok: false, error: '「' + kw + '」收货仓与预约仓不一致' };
          }
          found = o;
          break;
        }
      }
    }
    if (!found) {
      if (!silent) window.alert('未找到符合条件的入库单');
      return { ok: false, error: '「' + kw + '」未找到或不符合条件' };
    }
    for (var k = 0; k < selectedOrders.length; k++) {
      if (selectedOrders[k].inOrderId === found.id) {
        if (!silent) window.alert('该入库单已添加');
        return { ok: false, error: '「' + kw + '」已添加' };
      }
    }
    return { ok: true, found: found };
  }

  function addInOrderByKeyword(keyword) {
    var result = validateAndFindInOrder(keyword, true);
    if (!result.ok) return result;
    selectedOrders.push(C.snapshotInOrder(result.found));
    return { ok: true };
  }

  function addInOrders() {
    if (!getWarehouse()) {
      window.alert('请先选择预约仓');
      return;
    }
    var raw = document.getElementById('inOrderSearch').value;
    var keys = raw.split(/[,，]/).map(function (s) { return s.trim(); }).filter(Boolean);
    if (!keys.length) {
      window.alert('请输入入库单号');
      return;
    }
    var added = 0;
    var errors = [];
    keys.forEach(function (kw) {
      var result = addInOrderByKeyword(kw);
      if (result.ok) added++;
      else if (result.error) errors.push(result.error);
    });
    document.getElementById('inOrderSearch').value = '';
    renderSelectedTable();
    if (errors.length) {
      var msg = '成功添加 ' + added + ' 条';
      if (added < keys.length) msg += '，以下未添加：\n' + errors.join('\n');
      window.alert(msg);
    } else if (added > 1) {
      window.alert('已成功添加 ' + added + ' 条入库单');
    }
  }

  function validateForm(isSubmit) {
    if (!getWarehouse()) {
      window.alert('请选择预约仓');
      return false;
    }
    if (getDeliveryType() === '整柜') {
      if (!document.getElementById('containerNo').value.trim()) {
        window.alert('请填写集装箱号');
        return false;
      }
      var containerType = getContainerType();
      if (!containerType) {
        window.alert('请选择柜型');
        return false;
      }
      if (!isAllowedContainerType(normalizeContainerTypeValue(containerType))) {
        window.alert('请从下拉列表中选择柜型');
        return false;
      }
    }
    var cartons = getEstimatedCartons();
    if (!cartons) {
      window.alert('请填写送仓总箱数');
      return false;
    }
    if (!/^[1-9]\d*$/.test(cartons)) {
      window.alert('送仓总箱数必须为正整数');
      return false;
    }
    if (getIsPalletized()) {
      var pallets = getTotalPallets();
      if (!pallets) {
        window.alert('请填写送仓总托数');
        return false;
      }
      if (!/^[1-9]\d*$/.test(pallets)) {
        window.alert('送仓总托数必须为正整数');
        return false;
      }
    }
    var volume = getTotalVolumeInput();
    if (volume && !isPositiveDecimal(volume)) {
      window.alert('总体积须为大于 0 的数字');
      return false;
    }
    var weight = getTotalWeightInput();
    if (weight && !isPositiveDecimal(weight)) {
      window.alert('总重量须为大于 0 的数字');
      return false;
    }
    if (isSubmit && !selectedOrders.length) {
      window.alert('请至少添加一条入库单');
      return false;
    }
    return true;
  }

  function buildPayload(status) {
    var isPalletized = getIsPalletized();
    var original = editingItem ? JSON.parse(JSON.stringify(editingItem)) : {};
    var record = original;
    record.id = original.id || C.genId();
    record.customerCode = original.customerCode || C.getCurrentCustomerCode();
    record.appointmentNo = status === '待预约' ? (original.appointmentNo || C.genAppointmentNo()) : (original.appointmentNo || '');
    if (status === '待预约') {
      record.deliveryCode = original.deliveryCode || C.genDeliveryCode();
      record.bookingLink = original.bookingLink ||
        ('/fg/index.html?code=' + encodeURIComponent(record.deliveryCode));
    } else {
      record.deliveryCode = '';
      record.bookingLink = '';
    }
    record.warehouse = C.normalizeWarehouseName(getWarehouse());
    record.status = status;
    record.deliveryType = getDeliveryType();
    record.expectedInboundTime = original.expectedInboundTime || '';
    record.warehouseConfirmedInboundTime = original.warehouseConfirmedInboundTime || '';
    record.actualDeliveryTime = original.actualDeliveryTime || '';
    record.arrivalPhotos = original.arrivalPhotos || [];
    record.isPalletized = isPalletized;
    record.totalPallets = isPalletized ? Number(getTotalPallets()) : '';
    record.estimatedCartons = Number(getEstimatedCartons());
    var volumeVal = getTotalVolumeInput();
    var weightVal = getTotalWeightInput();
    record.totalVolume = volumeVal ? Number(volumeVal) : '';
    record.totalWeight = weightVal ? Number(weightVal) : '';
    record.submitTime = status === '待预约' ? (original.submitTime || C.formatNow()) : (original.submitTime || '');
    record.containerNo = document.getElementById('containerNo').value.trim();
    record.containerType = normalizeContainerTypeValue(getContainerType());
    record.containerSeq = record.containerType;
    record.primaryEmail = original.primaryEmail || '';
    record.emails = Array.isArray(original.emails) ? original.emails.slice() : [];
    record.inboundOrders = selectedOrders.slice();
    return record;
  }

  function openCartonsMismatchModal(message) {
    var overlay = document.getElementById('modalCartonsMismatch');
    if (!overlay) {
      window.alert(message);
      return;
    }
    document.getElementById('modalCartonsMismatchBody').textContent = message;
    overlay.setAttribute('aria-hidden', 'false');
    overlay.style.display = 'flex';
    var okBtn = document.getElementById('modalCartonsMismatchOk');
    okBtn.onclick = function () {
      overlay.setAttribute('aria-hidden', 'true');
      overlay.style.display = 'none';
      okBtn.onclick = null;
    };
  }

  function runCartonsConsistencyCheck(item) {
    if (typeof C.validateDeliveryCartonsConsistency !== 'function') return true;
    var result = C.validateDeliveryCartonsConsistency({
      bookChannel: item.bookChannel || 'customer',
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

  function save(status) {
    var isSubmit = status === '待预约';
    if (!validateForm(isSubmit)) return;
    var item = buildPayload(status);
    if (isSubmit && !runCartonsConsistencyCheck(item)) return;
    if (editingItem && editingItem.status === status) {
      C.addOrUpdateInMockAndPersist(item, null, function (err) {
        window.alert(C.persistSuccessMessage(err, '修改已保存'));
        window.location.href = 'deliveryAppointment.html';
      });
      return;
    }
    if (isSubmit) {
      C.submitAppointmentRecord(item, function (err) {
        window.alert(C.submitSuccessMessage(err));
        window.location.href = 'deliveryAppointment.html';
      });
      return;
    }
    item.status = '待提交';
    if (!item.id) item.id = C.genId();
    C.addOrUpdateInMock(item, { prepend: true });
    window.alert('草稿已保存（原型）');
    window.location.href = 'deliveryAppointment.html';
  }

  function fillForm(item) {
    document.title = '编辑预约送仓';
    var breadcrumb = document.querySelector('.breadcrumb');
    if (breadcrumb) breadcrumb.innerHTML = '单据管理 &gt;&gt; 预约送仓 &gt;&gt; 编辑';
    var title = document.querySelector('.form-section-title');
    if (title) title.textContent = '预约信息（编辑）';
    document.getElementById('warehouse').value = C.normalizeWarehouseName(item.warehouse || '');
    setRadioValue('deliveryType', item.deliveryType || '散货');
    setRadioValue('isPalletized', C.isPalletized(item) ? 'yes' : 'no');
    document.getElementById('totalPallets').value = C.isPalletized(item) && item.totalPallets ? item.totalPallets : '';
    document.getElementById('estimatedCartons').value = C.formatEstimatedCartons(item) === '-' ? '' : C.formatEstimatedCartons(item);
    document.getElementById('totalVolume').value =
      item.totalVolume != null && item.totalVolume !== '' ? item.totalVolume : '';
    document.getElementById('totalWeight').value =
      item.totalWeight != null && item.totalWeight !== '' ? item.totalWeight : '';
    document.getElementById('containerNo').value = item.containerNo || '';
    setContainerTypeValue(item.containerType || item.containerSeq || '');
    selectedOrders = (item.inboundOrders || []).slice();
    document.getElementById('btnSaveDraft').textContent = '保存修改';
    document.getElementById('btnSubmit').style.display = item.status === '待预约' ? 'none' : '';
    renderSelectedTable();
    toggleFclFields();
    togglePalletFields();
  }

  function initEditMode() {
    var id = getQueryId();
    if (!id) return;
    var item = C.getById(id, false);
    if (!item) {
      window.alert('预约单不存在');
      window.location.href = 'deliveryAppointment.html';
      return;
    }
    if (item.status !== '待提交' && item.status !== '待预约') {
      window.alert('仅待提交、待预约状态可修改');
      window.location.href = 'deliveryAppointmentDetail.html?id=' + encodeURIComponent(item.id);
      return;
    }
    editingItem = JSON.parse(JSON.stringify(item));
    fillForm(editingItem);
  }

  function onWarehouseChange() {
    if (!selectedOrders.length) return;
    var wh = getWarehouse();
    var bad = selectedOrders.some(function (o) { return !C.isSameWarehouse(o.warehouse, wh); });
    if (bad) {
      window.alert('预约仓已变更，已清空货物明细');
      selectedOrders = [];
      renderSelectedTable();
    }
  }

  function initWarehouseSelect() {
    var sel = document.getElementById('warehouse');
    if (typeof MOCK_IN_ORDER_WAREHOUSES === 'undefined') return;
    MOCK_IN_ORDER_WAREHOUSES.forEach(function (name) {
      var opt = document.createElement('option');
      opt.value = name;
      opt.textContent = name;
      sel.appendChild(opt);
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
    initWarehouseSelect();
    initContainerTypeCombo();
    renderSelectedTable();
    document.querySelectorAll('input[name="deliveryType"]').forEach(function (r) {
      r.addEventListener('change', toggleFclFields);
    });
    document.querySelectorAll('input[name="isPalletized"]').forEach(function (r) {
      r.addEventListener('change', togglePalletFields);
    });
    document.getElementById('warehouse').addEventListener('change', onWarehouseChange);
    document.getElementById('btnAddInOrder').addEventListener('click', addInOrders);
    document.getElementById('inOrderSearch').addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); addInOrders(); }
    });
    document.getElementById('btnSaveDraft').addEventListener('click', function () {
      save(editingItem && editingItem.status === '待预约' ? '待预约' : '待提交');
    });
    document.getElementById('btnSubmit').addEventListener('click', function () { save('待预约'); });
    document.getElementById('btnCancel').addEventListener('click', function () {
      window.location.href = 'deliveryAppointment.html';
    });
    toggleFclFields();
    togglePalletFields();
    initEditMode();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
