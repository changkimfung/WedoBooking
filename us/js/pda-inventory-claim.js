(function () {
  var C = InventoryInstructionCommon;
  var MY_WH = new URLSearchParams(location.search).get('wh') || 'US-LA';
  var ID = new URLSearchParams(location.search).get('taskId');
  var OP = new URLSearchParams(location.search).get('operator') || 'PDA操作员';
  var instruction;
  var task;

  function esc(value) { var d = document.createElement('div'); d.textContent = value == null ? '' : value; return d.innerHTML; }
  function setStatus(message, type) { var el = document.getElementById('claimStatus'); el.textContent = message || ''; el.className = 'pda-ris-mstatus ' + (type || ''); }
  function isAutoWarehouseLocation(item) { return /^A/i.test(String(item.locationCode || '')); }
  function skuRows() {
    var groups = {};
    (task.items || []).forEach(function (item) { if (item.lineStatus !== '已盘') (groups[item.skuCode] || (groups[item.skuCode] = [])).push(item); });
    return Object.keys(groups).map(function (sku) {
      var items = groups[sku];
      var active = items.filter(function (item) { return item.lineStatus === '盘点中'; });
      return {
        skuCode: sku,
        pendingCount: items.length,
        owner: active.length ? active[0].claimedBy : '',
        active: active.length > 0,
        hasAutoWarehouse: items.some(isAutoWarehouseLocation)
      };
    }).sort(function (a, b) {
      if (a.active !== b.active) return a.active ? 1 : -1;
      return a.pendingCount - b.pendingCount || a.skuCode.localeCompare(b.skuCode);
    });
  }
  function render() {
    var keyword = document.getElementById('skuSearchInput').value.trim().toLowerCase();
    var rows = skuRows().filter(function (row) {
      return !keyword || row.skuCode.toLowerCase().indexOf(keyword) >= 0;
    });
    if (!rows.length && !keyword) {
      setStatus('当前指令盘点已全部完成，即将返回指令单列表', 'ok');
      document.getElementById('skuBody').innerHTML = '<tr><td colspan="4">暂无未完结料号</td></tr>';
      setTimeout(function () { location.href = 'pda-inventory-count.html?wh=' + encodeURIComponent(MY_WH); }, 500);
      return;
    }
    if (!rows.length) {
      setStatus('未查询到对应的待盘点料号', 'err');
      document.getElementById('skuBody').innerHTML = '<tr><td colspan="4">暂无匹配的待盘点料号</td></tr>';
      return;
    }
    setStatus('', '');
    document.getElementById('skuBody').innerHTML = rows.map(function (row) {
      var status = row.active ? '盘点中' : '待认领';
      var operation = row.active ? (row.owner === OP ? '<button class="pda-claim-btn" data-sku="' + esc(row.skuCode) + '">继续盘点</button>' : '-') : '<button class="pda-claim-btn" data-sku="' + esc(row.skuCode) + '">认领盘点</button>';
      return '<tr><td class="' + (!row.active && row.hasAutoWarehouse ? 'pda-claim-auto-sku' : '') + '">' + esc(row.skuCode) + '</td><td>' + row.pendingCount + '</td><td>' + status + '</td><td>' + operation + '</td></tr>';
    }).join('') || '<tr><td colspan="4">暂无未完结料号</td></tr>';
    document.querySelectorAll('.pda-claim-btn').forEach(function (button) { button.onclick = function () { claim(button.getAttribute('data-sku')); }; });
  }
  function claim(skuCode) {
    C.action({ action: 'claimSku', instructionId: instruction.id, warehouseCode: MY_WH, skuCode: skuCode, operator: OP }, function (err, data) {
      if (err) return setStatus(err.message, 'err');
      location.href = 'pda-inventory-location.html?taskId=' + encodeURIComponent(instruction.id) + '&wh=' + encodeURIComponent(MY_WH) + '&sku=' + encodeURIComponent(skuCode) + '&operator=' + encodeURIComponent(OP);
    });
  }
  function init() {
    document.getElementById('btnSkuSearch').onclick = render;
    document.getElementById('skuSearchInput').onsearch = render;
    document.getElementById('skuSearchInput').onkeydown = function (event) {
      if (event.key === 'Enter') render();
    };
    C.load(function (err) {
      if (err) return setStatus(err.message, 'err');
      instruction = C.find(C.getList(), ID);
      task = C.findWarehouseTask(instruction, MY_WH);
      if (!instruction || !task) return setStatus('未找到本仓指令盘点任务', 'err');
      if (C.normalizedStatus(instruction.status) === '已废弃') return setStatus('该仓库子单已废弃，不能继续盘点', 'err');
      render();
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();