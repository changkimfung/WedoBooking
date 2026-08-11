(function () {
  var C = InventoryInstructionCommon;
  var params = new URLSearchParams(location.search);
  var MY_WH = params.get('wh') || 'US-LA';
  var ID = params.get('taskId');
  var SKU = params.get('sku');
  var OP = params.get('operator') || 'PDA操作员';
  var instruction;
  var task;

  function $(id) { return document.getElementById(id); }
  function set(message, type) { var el = $('countStatus'); el.textContent = message || ''; el.className = 'pda-ris-mstatus ' + (type || ''); }
  function backUrl() { return 'pda-inventory-claim.html?taskId=' + encodeURIComponent(ID) + '&wh=' + encodeURIComponent(MY_WH) + '&operator=' + encodeURIComponent(OP); }
  function skuItems() { return (task.items || []).filter(function (item) { return item.skuCode === SKU; }); }
  function pendingItems() { return skuItems().filter(function (item) { return item.lineStatus !== '已盘'; }); }
  function renderLocations() {
    var items = pendingItems().sort(function (a, b) { return String(a.locationCode).localeCompare(String(b.locationCode)); });
    if (!items.length) return finishSku();
    $('locationInput').innerHTML = items.map(function (item) { return '<option value="' + item.lineId + '">' + item.locationCode + '</option>'; }).join('');
    $('locationInput').onchange = updateExpectedQty;
    $('skuInput').value = SKU;
    updateExpectedQty();
  }
  function selectedItem() {
    var lineId = $('locationInput').value;
    return pendingItems().filter(function (item) { return item.lineId === lineId; })[0];
  }
  function isAutoWarehouseLocation(item) { return item && /^A/i.test(String(item.locationCode || '')); }
  function updateExpectedQty() {
    var item = selectedItem();
    $('expectedQty').textContent = item ? item.expectedQty : '-';
    $('btnCallAutoWarehouse').disabled = !isAutoWarehouseLocation(item);
    $('countInput').value = '';
  }
  function callAutoWarehouse() {
    var item = selectedItem();
    if (!isAutoWarehouseLocation(item)) return;
    set('已呼叫自动仓出库：' + item.locationCode, 'ok');
  }
  function releaseAndBack() {
    C.action({ action: 'releaseSku', instructionId: instruction.id, warehouseCode: MY_WH, skuCode: SKU, operator: OP }, function (err) {
      if (err) return set(err.message, 'err');
      location.href = backUrl();
    });
  }
  function finishSku() {
    set('该料号所有仓位已完成盘点，5 秒后返回料号认领列表', 'ok');
    setTimeout(function () { location.href = backUrl(); }, 5000);
  }
  function submit() {
    var item = selectedItem();
    var qty = $('countInput').value;
    if (!item) return set('请选择待盘点仓位', 'err');
    if (!/^\d+$/.test(qty)) return set('实际库存必须为非负整数', 'err');
    C.action({ action: 'complete', instructionId: instruction.id, warehouseCode: MY_WH, lineId: item.lineId, operator: OP, countedQty: qty }, function (err, data) {
      if (err) return set(err.message, 'err');
      instruction = C.find(data.list, instruction.id);
      task = C.findWarehouseTask(instruction, MY_WH);
      $('countInput').value = '';
      if (!pendingItems().length) return finishSku();
      set('盘点记录已提交', 'ok');
      renderLocations();
    });
  }
  function init() {
    $('btnConfirmLine').onclick = submit;
    $('btnExit').onclick = releaseAndBack;
    $('btnCallAutoWarehouse').onclick = callAutoWarehouse;
    C.load(function (err) {
      if (err) return set(err.message, 'err');
      instruction = C.find(C.getList(), ID);
      task = C.findWarehouseTask(instruction, MY_WH);
      if (!instruction || !task || !SKU) return set('未找到料号盘点任务', 'err');
      var locked = skuItems().filter(function (item) { return item.lineStatus === '盘点中' && item.claimedBy === OP; });
      if (!locked.length && pendingItems().length) return set('该料号未由当前操作员认领，不能继续盘点', 'err');
      renderLocations();
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();