(function () {
  var C = InventoryInstructionCommon;
  var MY_WH = 'US-LA';

  function e(s) {
    var d = document.createElement('div');
    d.textContent = s == null ? '' : s;
    return d.innerHTML;
  }

  function issuedAt(instruction) {
    return instruction.initiatedAt || instruction.createdAt || '';
  }

  function priority(index) {
    return index === 0 ? '新' : '旧';
  }

  function skuProgress(instruction, task) {
    var requestedSkus = task.requestedSkus || instruction.requestedSkus || [];
    var itemsBySku = {};
    var autoCompleted = {};
    (task.items || []).forEach(function (item) {
      (itemsBySku[item.skuCode] || (itemsBySku[item.skuCode] = [])).push(item);
    });
    (task.autoCompletedSkus || []).forEach(function (item) { autoCompleted[item.skuCode] = true; });
    var completedCount = requestedSkus.filter(function (sku) {
      var items = itemsBySku[sku.skuCode] || [];
      return autoCompleted[sku.skuCode] || (items.length && items.every(function (item) { return item.lineStatus === '已盘'; }));
    }).length;
    return { completed: completedCount, total: requestedSkus.length };
  }

  function render() {
    var st = document.getElementById('qStatus').value;
    var rows = [];
    C.executableInstructions(C.getList()).forEach(function (instruction) {
      var task = C.findWarehouseTask(instruction, MY_WH);
      if (task && (!st || C.normalizedStatus(task.status) === st)) {
        rows.push({ instruction: instruction, task: task });
      }
    });
    rows.sort(function (a, b) { return issuedAt(b.instruction).localeCompare(issuedAt(a.instruction)); });

    document.getElementById('empty').style.display = rows.length ? 'none' : '';
    document.getElementById('taskBody').innerHTML = rows.map(function (row, index) {
      var progress = skuProgress(row.instruction, row.task);
      var taskStatus = C.normalizedStatus(row.task.status);
      return '<tr><td>' + e(row.instruction.instructionNo) + '</td><td><span class="ii-priority ii-priority-' + priority(index) + '">' +
        priority(index) + '</span></td><td>' + e(row.instruction.customerCode || '-') +
        '</td><td>' + progress.completed + ' / ' + progress.total + '</td><td>' +
        e(issuedAt(row.instruction) || '-') + '</td><td><span class="ii-status ii-status-' +
        e(taskStatus) + '">' + e(taskStatus) + '</span></td><td><a class="btn btn-small" href="inventoryInstructionDetail.html?instructionId=' +
        encodeURIComponent(row.instruction.id) + '&warehouseCode=' + encodeURIComponent(MY_WH) + '">查看详情</a> ' +
        (taskStatus !== '已完成' && taskStatus !== '已废弃' ?
          '<a class="btn btn-small btn-info" href="pda-inventory-claim.html?taskId=' + encodeURIComponent(row.instruction.id) +
          '&wh=' + encodeURIComponent(MY_WH) + '">PDA认领盘点</a>' : '') + '</td></tr>';
    }).join('');
  }

  function init() {
    document.getElementById('btnQuery').onclick = render;
    C.load(function (err) {
      if (err) alert(err.message);
      render();
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();