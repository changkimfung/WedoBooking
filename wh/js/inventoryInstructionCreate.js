(function () {
  var C = InventoryInstructionCommon;
  var WAREHOUSES = [
    { code: 'US-LA', name: '美西仓（LA）' },
    { code: 'US-NY', name: '美东仓（NY）' },
    { code: 'EU-DE', name: '欧洲仓（DE）' }
  ];
  var warehouseSkus = {};
  var activeWarehouseCode = '';
  var currentCustomerCode = '';

  function $(id) { return document.getElementById(id); }
  function e(s) { var d = document.createElement('div'); d.textContent = s == null ? '' : s; return d.innerHTML; }
  function now() { return C.now(); }

  function customerProducts(code) {
    return (typeof MOCK_PRODUCT_INFO_LIST === 'undefined' ? [] : MOCK_PRODUCT_INFO_LIST).filter(function (item) {
      return String(item.userCode || '').toLowerCase() === String(code || '').toLowerCase();
    });
  }

  function renderCustomers() {
    var map = {};
    (typeof MOCK_PRODUCT_INFO_LIST === 'undefined' ? [] : MOCK_PRODUCT_INFO_LIST).forEach(function (item) {
      var code = String(item.userCode || '').trim();
      if (code) map[code] = true;
    });
    $('formCustomer').innerHTML = '<option value="">请选择客户编码</option>' + Object.keys(map).sort().map(function (code) {
      return '<option value="' + e(code) + '">' + e(code) + '</option>';
    }).join('');
  }

  function renderWarehouses() {
    $('warehouseChecks').innerHTML = WAREHOUSES.map(function (warehouse) {
      return '<label class="inventory-wh-check"><input type="checkbox" value="' + e(warehouse.code) +
        '" data-name="' + e(warehouse.name) + '"> ' + e(warehouse.name) + '</label>';
    }).join('');
    document.querySelectorAll('#warehouseChecks input').forEach(function (input) {
      input.onchange = function () {
        if (!input.checked && activeWarehouseCode === input.value) activeWarehouseCode = '';
        renderWarehouseSections();
      };
    });
  }

  function selectedWarehouses() {
    var result = [];
    document.querySelectorAll('#warehouseChecks input:checked').forEach(function (input) {
      result.push({ code: input.value, name: input.getAttribute('data-name') });
    });
    return result;
  }

  function setMessage(id, message, isError) {
    var el = $(id);
    el.textContent = message || '';
    el.className = 'inventory-hint' + (isError ? ' inventory-error' : '');
  }

  function selectedModalWarehouses() {
    var result = [];
    document.querySelectorAll('#batchWarehouseChecks input:checked').forEach(function (input) {
      result.push({ code: input.value, name: input.getAttribute('data-name') });
    });
    return result;
  }

  function renderWarehouseSections() {
    var warehouses = selectedWarehouses();
    if (!activeWarehouseCode || !warehouses.some(function (warehouse) { return warehouse.code === activeWarehouseCode; })) {
      activeWarehouseCode = warehouses.filter(function (warehouse) { return (warehouseSkus[warehouse.code] || []).length; })[0] &&
        warehouses.filter(function (warehouse) { return (warehouseSkus[warehouse.code] || []).length; })[0].code || (warehouses[0] && warehouses[0].code) || '';
    }
    var tabs = warehouses.map(function (warehouse) {
      var count = (warehouseSkus[warehouse.code] || []).length;
      return '<button type="button" class="inventory-warehouse-tab' + (warehouse.code === activeWarehouseCode ? ' is-active' : '') +
        '" data-warehouse-tab="' + e(warehouse.code) + '">' + e(warehouse.name) + '（' + count + '）</button>';
    }).join('');
    var active = warehouses.filter(function (warehouse) { return warehouse.code === activeWarehouseCode; })[0];
    var rows = active ? (warehouseSkus[active.code] || []).map(function (item) {
      return '<tr><td>' + e(item.skuCode) + '</td><td>' + e(item.productName) + '</td><td>' + e(active.name) +
        '</td><td class="button"><a href="#" data-remove-sku="' + e(item.skuCode) + '" data-warehouse="' + e(active.code) + '">从当前仓移除</a></td></tr>';
    }).join('') : '';
    $('warehouseSkuSections').innerHTML = !warehouses.length ? '<p class="inventory-hint">请先勾选需要下发的海外仓。</p>' :
      '<div class="inventory-warehouse-tabs">' + tabs + '</div><div class="inventory-warehouse-sku">' +
      '<div class="inventory-warehouse-sku-title"><strong>' + e(active.name) + '货物清单</strong><span class="inventory-hint">共 ' +
      (warehouseSkus[active.code] || []).length + ' 条</span></div><table cellspacing="0" width="100%" class="inventory-item-table"><thead><tr>' +
      '<th>运德编号</th><th>产品名称</th><th>盘点仓库</th><th>操作</th></tr></thead><tbody>' +
      (rows || '<tr><td colspan="4">暂无运德编号，请通过“批量添加运德编号”录入。</td></tr>') + '</tbody></table></div>';

    document.querySelectorAll('[data-warehouse-tab]').forEach(function (tab) {
      tab.onclick = function () { activeWarehouseCode = tab.getAttribute('data-warehouse-tab'); renderWarehouseSections(); };
    });
    document.querySelectorAll('[data-remove-sku]').forEach(function (link) {
      link.onclick = function (event) {
        event.preventDefault();
        var warehouseCode = link.getAttribute('data-warehouse');
        var skuCode = link.getAttribute('data-remove-sku');
        if (!window.confirm('确认从当前仓库移除运德编号 ' + skuCode + ' 吗？')) return;
        warehouseSkus[warehouseCode] = (warehouseSkus[warehouseCode] || []).filter(function (item) {
          return item.skuCode !== skuCode;
        });
        renderWarehouseSections();
      };
    });
  }

  function matchedProducts(values) {
    var customerCode = $('formCustomer').value;
    if (!customerCode) { setMessage('batchSkuMessage', '请先选择客户编码后再校验运德编号', true); return null; }
    var productMap = {};
    customerProducts(customerCode).forEach(function (item) {
      var code = String(item.yundeNo || '').trim();
      if (code) productMap[code.toLowerCase()] = item;
    });
    var matched = [], failed = [], inputMap = {};
    values.forEach(function (skuCode) {
      var key = skuCode.toLowerCase();
      if (inputMap[key]) return;
      inputMap[key] = true;
      var product = productMap[key];
      if (!product) failed.push(skuCode);
      else matched.push({ skuCode: String(product.yundeNo), productName: product.productName || product.nameCn || product.nameEn || skuCode });
    });
    return { matched: matched, failed: failed };
  }

  function stockRecords(warehouseCode, skuCode) {
    return (typeof MOCK_INVENTORY_STOCK_SNAPSHOT === 'undefined' ? [] : MOCK_INVENTORY_STOCK_SNAPSHOT).filter(function (record) {
      return record.warehouseCode === warehouseCode && record.skuCode === skuCode;
    });
  }

  function addSkusToWarehouse(warehouseCode, products) {
    var list = warehouseSkus[warehouseCode] || (warehouseSkus[warehouseCode] = []);
    var existing = {};
    list.forEach(function (item) { existing[item.skuCode.toLowerCase()] = true; });
    var added = [], duplicate = [];
    products.forEach(function (product) {
      if (existing[product.skuCode.toLowerCase()]) duplicate.push(product.skuCode);
      else { list.push(product); existing[product.skuCode.toLowerCase()] = true; added.push(product.skuCode); }
    });
    return { added: added, duplicate: duplicate };
  }

  function openBatchModal() {
    var warehouses = selectedWarehouses();
    if (!warehouses.length) { setMessage('skuMessage', '请先选择至少一个下发仓库', true); return; }
    if (!$('formCustomer').value) { setMessage('skuMessage', '请先选择客户编码后再批量添加运德编号', true); return; }
    $('batchWarehouseChecks').innerHTML = warehouses.map(function (warehouse) {
      return '<label class="inventory-wh-check"><input type="checkbox" value="' + e(warehouse.code) + '" data-name="' +
        e(warehouse.name) + '" checked> ' + e(warehouse.name) + '</label>';
    }).join('');
    $('batchSkuInput').value = '';
    setMessage('batchSkuMessage', '请输入运德编号并勾选需同步加入的盘点仓库。');
    $('batchSkuModal').classList.remove('is-hidden');
    $('batchSkuModal').setAttribute('aria-hidden', 'false');
    $('batchSkuInput').focus();
  }

  function closeBatchModal() {
    $('batchSkuModal').classList.add('is-hidden');
    $('batchSkuModal').setAttribute('aria-hidden', 'true');
  }

  function confirmBatchAdd() {
    var values = $('batchSkuInput').value.split(/[\s,]+/).map(function (value) { return value.trim(); }).filter(Boolean);
    var warehouses = selectedModalWarehouses();
    if (!values.length) return setMessage('batchSkuMessage', '请先输入至少一个运德编号', true);
    if (!warehouses.length) return setMessage('batchSkuMessage', '请至少勾选一个盘点仓库', true);
    var result = matchedProducts(values);
    if (!result) return;
    var addedCount = 0, duplicates = [];
    warehouses.forEach(function (warehouse) {
      var applied = addSkusToWarehouse(warehouse.code, result.matched);
      addedCount += applied.added.length;
      if (applied.duplicate.length) duplicates.push(warehouse.name + '：' + applied.duplicate.join('、'));
    });
    if (addedCount) activeWarehouseCode = warehouses[0].code;
    renderWarehouseSections();
    var messages = [], noStock = [];
    warehouses.forEach(function (warehouse) {
      var unavailable = result.matched.filter(function (product) {
        return !stockRecords(warehouse.code, product.skuCode).length;
      }).map(function (product) { return product.skuCode; });
      if (unavailable.length) noStock.push(warehouse.name + ' 无库存：' + unavailable.join('、'));
    });
    if (addedCount) messages.push('成功加入 ' + addedCount + ' 条仓库货物清单记录');
    if (duplicates.length) messages.push('重复未加入：' + duplicates.join('；'));
    if (noStock.length) messages.push(noStock.join('；'));
    if (result.failed.length) messages.push('未匹配当前客户的运德编号：' + result.failed.join('、'));
    setMessage('skuMessage', messages.join('；'), result.failed.length > 0);
    if (addedCount) closeBatchModal();
    else setMessage('batchSkuMessage', messages.join('；') || '没有可加入的运德编号', true);
  }

  function changeCustomer() {
    var nextCustomerCode = $('formCustomer').value;
    var hasSkus = Object.keys(warehouseSkus).some(function (code) { return (warehouseSkus[code] || []).length; });
    if (hasSkus && !window.confirm('切换客户编码将清空当前货物清单，是否继续？')) {
      $('formCustomer').value = currentCustomerCode;
      return;
    }
    if (hasSkus) {
      warehouseSkus = {};
      activeWarehouseCode = '';
      setMessage('skuMessage', '客户编码已变更，已清空各仓货物清单');
      renderWarehouseSections();
    }
    currentCustomerCode = nextCustomerCode;
  }

  function submit() {
    var customerCode = $('formCustomer').value, reason = $('formReason').value, warehouses = selectedWarehouses();
    if (!customerCode) return window.alert('请选择客户编码');
    if (!reason) return window.alert('请选择盘点原因');
    if (!warehouses.length) return window.alert('请至少选择一个下发仓库');
    var empty = warehouses.filter(function (warehouse) { return !(warehouseSkus[warehouse.code] || []).length; });
    if (empty.length) return window.alert('请为以下仓库至少添加一个运德编号：' + empty.map(function (warehouse) { return warehouse.name; }).join('、'));

    var list = C.getList(), initiatedAt = $('formInitiatedAt').getAttribute('data-value') || now(), id = 'ii-' + Date.now();
    var groupNo = 'IP' + initiatedAt.slice(0, 10).replace(/-/g, '') + String(list.filter(function (item) {
      return item.recordType === 'group' || !item.groupId;
    }).length + 1).padStart(3, '0');
    var group = { id: id, recordType: 'group', groupNo: groupNo, instructionNo: groupNo, customerCode: customerCode,
      inventoryReason: reason, initiatedAt: initiatedAt, groupStatus: '待盘点', status: '待盘点', creator: '中台操作员',
      createdAt: initiatedAt, completedAt: '', remark: $('formRemark').value.trim(), childInstructionIds: [], operationLogs: [] };
    C.addLog(group, group.creator, '创建指令盘点组单，客户：' + customerCode + '，原因：' + reason + '，下发 ' + warehouses.map(function (warehouse) { return warehouse.name; }).join('、'));
    var children = warehouses.map(function (warehouse, index) {
      var childId = id + '-w' + index, suffix = warehouse.code.split('-').pop(), requestedSkus = warehouseSkus[warehouse.code].slice();
      var child = { id: childId, recordType: 'instruction', groupId: group.id, groupNo: groupNo, instructionNo: groupNo + '-' + suffix,
        customerCode: customerCode, inventoryReason: reason, initiatedAt: initiatedAt, status: '待盘点', creator: group.creator,
        createdAt: initiatedAt, completedAt: '', remark: group.remark, requestedSkus: requestedSkus, warehouseTasks: [{
          taskId: childId + '-task', warehouseCode: warehouse.code, warehouseName: warehouse.name, requestedSkus: requestedSkus,
          status: '待盘点', noStockSkus: [], items: [] }], operationLogs: [] };
      C.addLog(child, child.creator, '由组单 ' + groupNo + ' 拆分生成，向 ' + warehouse.name + ' 下发指令盘点');
      group.childInstructionIds.push(child.id);
      return child;
    });
    list.unshift.apply(list, [group].concat(children));
    $('btnSubmit').disabled = true;
    C.save(list, function (err) {
      $('btnSubmit').disabled = false;
      if (err) return window.alert(err.message);
      window.alert('指令盘点已提交并下发');
      window.location.href = 'inventoryInstruction.html';
    });
  }

  function init() {
    var initiatedAt = now();
    $('formInitiatedAt').textContent = initiatedAt;
    $('formInitiatedAt').setAttribute('data-value', initiatedAt);
    renderCustomers();
    renderWarehouses();
    renderWarehouseSections();
    $('formCustomer').onchange = changeCustomer;
    currentCustomerCode = $('formCustomer').value;
    $('btnBatchAddSku').onclick = openBatchModal;
    $('closeBatchSkuModal').onclick = closeBatchModal;
    $('btnBatchCancel').onclick = closeBatchModal;
    $('btnBatchConfirm').onclick = confirmBatchAdd;
    $('batchSkuModal').onclick = function (event) { if (event.target === this) closeBatchModal(); };
    $('btnCancel').onclick = function () { window.location.href = 'inventoryInstruction.html'; };
    $('btnSubmit').onclick = submit;
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();