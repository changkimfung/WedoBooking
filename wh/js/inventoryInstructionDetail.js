(function () {
  var C = InventoryInstructionCommon;

  function e(s) {
    var d = document.createElement('div');
    d.textContent = s == null || s === '' ? '-' : s;
    return d.innerHTML;
  }

  function getInstructionId() {
    return new URLSearchParams(window.location.search).get('instructionId') || '';
  }

  function skuRows(instruction, task) {
    var requestedSkus = task.requestedSkus || instruction.requestedSkus || [];
    var itemsBySku = {};
    (task.items || []).forEach(function (item) {
      (itemsBySku[item.skuCode] || (itemsBySku[item.skuCode] = [])).push(item);
    });

    return requestedSkus.map(function (sku) {
      var skuCode = sku.skuCode;
      var items = itemsBySku[skuCode] || [];
      var autoCompleted = (task.autoCompletedSkus || []).filter(function (item) {
        return item.skuCode === skuCode;
      })[0];
      var doneItems = items.filter(function (item) { return item.lineStatus === '已盘'; });
      var completed = !!autoCompleted || (items.length && doneItems.length === items.length);
      var completedAt = autoCompleted ? autoCompleted.completedAt : '';
      if (completed && !autoCompleted) {
        doneItems.forEach(function (item) {
          if (item.countedAt && (!completedAt || item.countedAt > completedAt)) completedAt = item.countedAt;
        });
      }
      return {
        skuCode: skuCode,
        status: completedAt ? '已完结' : (doneItems.length > 0 ? '盘点中' : '待盘点'),
        doneCount: doneItems.length,
        totalCount: items.length,
        completedAt: completedAt,
        remark: autoCompleted ? autoCompleted.remark : ''
      };
    });
  }

  function render(instruction) {
    var root = document.getElementById('detailMain');
    if (!instruction || C.isGroup(instruction)) {
      root.innerHTML = '<p class="inventory-hint">未找到仓库指令子单。</p>';
      return;
    }
    var task = (instruction.warehouseTasks || [])[0];
    if (!task) {
      root.innerHTML = '<p class="inventory-hint">该子单暂无目标仓库任务。</p>';
      return;
    }
    var rows = skuRows(instruction, task).map(function (row) {
      return '<tr><td>' + e(row.skuCode) + '</td><td>' + status(row.status) +
        '</td><td>' + row.doneCount +
        '</td><td>' + e(row.completedAt) + '</td><td>' + e(row.remark) + '</td></tr>';
    }).join('') || '<tr><td colspan="5">暂无货物清单</td></tr>';

    root.innerHTML = '<div class="inventory-create-panel">' +
      '<div class="inventory-create-titlebar"><h3>仓库指令子单详情 · ' + e(instruction.instructionNo) +
      '</h3><p>所属组单：' + e(instruction.groupNo) + '　子单状态：' + status(C.normalizedStatus(instruction.status)) + '</p></div>' +
      '<div class="inventory-detail-section"><h4>基础信息</h4>' +
      '<table class="inventory-form-table"><tr><td class="inventory-form-label">客户编码</td><td>' + e(instruction.customerCode) +
      '</td><td class="inventory-form-label">盘点原因</td><td>' + e(instruction.inventoryReason) +
      '</td></tr><tr><td class="inventory-form-label">发起时间</td><td>' + e(instruction.initiatedAt || instruction.createdAt) +
      '</td><td class="inventory-form-label">目标仓库</td><td>' + e(task.warehouseName || task.warehouseCode) +
      '</td></tr><tr><td class="inventory-form-label">备注</td><td colspan="3">' + e(instruction.remark) +
      '</td></tr></table></div>' +
      '<div class="inventory-detail-section"><h4>货物清单</h4>' +
      '<table class="inventory-item-table"><tr><th>运德编码</th><th>盘点状态</th><th>已完成仓位任务数</th><th>完成时间</th><th>备注</th></tr>' + rows +
      '</table></div></div>';
  }

  function status(s) {
    return '<span class="inventory-status inventory-status-' + e(s) + '">' + e(s) + '</span>';
  }

  function init() {
    var id = getInstructionId();
    C.load(function (err) {
      if (err) window.alert(err.message);
      render(C.find(C.getList(), id));
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();