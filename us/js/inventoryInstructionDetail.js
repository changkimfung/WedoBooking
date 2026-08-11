(function () {
  var C = InventoryInstructionCommon;
  var WH = new URLSearchParams(location.search).get('warehouseCode') || 'US-LA';
  var ID = new URLSearchParams(location.search).get('instructionId');

  function e(s) {
    var d = document.createElement('div');
    d.textContent = s == null || s === '' ? '-' : s;
    return d.innerHTML;
  }

  function status(s) {
    return '<span class="ii-status ii-status-' + e(s) + '">' + e(s) + '</span>';
  }

  function skuRows(instruction, task) {
    var requestedSkus = task.requestedSkus || instruction.requestedSkus || [];
    var itemsBySku = {};
    (task.items || []).forEach(function (item) {
      (itemsBySku[item.skuCode] || (itemsBySku[item.skuCode] = [])).push(item);
    });

    return requestedSkus.map(function (sku) {
      var items = itemsBySku[sku.skuCode] || [];
      var autoCompleted = (task.autoCompletedSkus || []).filter(function (item) {
        return item.skuCode === sku.skuCode;
      })[0];
      var doneItems = items.filter(function (item) { return item.lineStatus === '已盘'; });
      var activeItems = items.filter(function (item) { return item.lineStatus === '盘点中'; });
      var completed = !!autoCompleted || (items.length && doneItems.length === items.length);
      var completedAt = autoCompleted ? autoCompleted.completedAt : '';
      if (completed && !autoCompleted) {
        doneItems.forEach(function (item) {
          if (item.countedAt && (!completedAt || item.countedAt > completedAt)) completedAt = item.countedAt;
        });
      }
      return {
        skuCode: sku.skuCode,
        status: completed ? '已完结' : (activeItems.length ? '盘点中' : '待认领'),
        doneCount: doneItems.length,
        totalCount: items.length,
        owner: activeItems.map(function (item) { return item.claimedBy; }).filter(function (owner, index, owners) {
          return owner && owners.indexOf(owner) === index;
        }).join('、'),
        completedAt: completedAt,
        remark: autoCompleted ? autoCompleted.remark : ''
      };
    });
  }

  function render() {
    var instruction = C.find(C.getList(), ID);
    var root = document.getElementById('detailMain');
    if (!instruction || C.isGroup(instruction)) {
      root.innerHTML = '<p class="alert">未找到仓库指令任务</p>';
      return;
    }

    var task = C.findWarehouseTask(instruction, WH);
    if (!task) {
      root.innerHTML = '<p class="alert">该指令未下发至当前仓库</p>';
      return;
    }

    var taskStatus = C.normalizedStatus(task.status);
    var rows = skuRows(instruction, task).map(function (row) {
      var action = '<a class="btn btn-small ii-view-record" target="_blank" href="inventoryCountRecord.html?instructionNo=' +
        encodeURIComponent(instruction.instructionNo) + '&sku=' + encodeURIComponent(row.skuCode) + '">查看明细</a>' +
        (row.status === '盘点中' ? ' <button type="button" class="btn btn-small btn-warning ii-force-reset" data-sku="' +
          e(row.skuCode) + '">强行重置</button>' : '');
      return '<tr><td>' + e(row.skuCode) + '</td><td>' + status(row.status) +
        '</td><td>' + row.doneCount + ' / ' + row.totalCount +
        '</td><td>' + e(row.owner) + '</td><td>' + e(row.completedAt) + '</td><td>' + e(row.remark) +
        '</td><td>' + action + '</td></tr>';
    }).join('') || '<tr><td colspan="7">暂无货物清单</td></tr>';

    root.innerHTML = '<div class="well">' +
      '<div class="pull-right">' + (taskStatus !== '已完成' && taskStatus !== '已废弃' ?
        '<a class="btn btn-info" href="pda-inventory-claim.html?taskId=' + encodeURIComponent(instruction.id) +
        '&wh=' + encodeURIComponent(WH) + '">PDA 认领盘点</a>' : '') + '</div>' +
      '<h3>仓库指令子单详情 · ' + e(instruction.instructionNo) + '</h3>' +
      '<p>所属组单：' + e(instruction.groupNo) + '　子单状态：' + status(taskStatus) + '</p>' +
      '<h4>基础信息</h4><table class="table table-bordered"><tr><th>客户编码</th><td>' + e(instruction.customerCode) +
      '</td><th>盘点原因</th><td>' + e(instruction.inventoryReason) +
      '</td></tr><tr><th>发起时间</th><td>' + e(instruction.initiatedAt || instruction.createdAt) +
      '</td><th>目标仓库</th><td>' + e(task.warehouseName || task.warehouseCode) +
      '</td></tr><tr><th>备注</th><td colspan="3">' + e(instruction.remark) +
      '</td></tr></table><h4>货物清单</h4><table class="table table-bordered table-hover"><tr class="info">' +
      '<th>运德编号</th><th>执行状态</th><th>仓位任务</th><th>当前认领人</th><th>完成时间</th><th>备注</th><th>操作</th>' +
      '</tr>' + rows + '</table></div>';

    root.querySelectorAll('.ii-force-reset').forEach(function (button) {
      button.onclick = function () {
        var skuCode = button.getAttribute('data-sku');
        if (!window.confirm('确认强行重置料号 ' + skuCode + ' 的认领状态吗？未提交的仓位将恢复为待认领。')) return;
        button.disabled = true;
        C.action({ action: 'forceResetSku', instructionId: instruction.id, warehouseCode: WH, skuCode: skuCode, operator: '海外仓管理员' }, function (err) {
          if (err) {
            button.disabled = false;
            window.alert(err.message);
            return;
          }
          render();
        });
      };
    });
  }

  C.load(function (err) {
    if (err) alert(err.message);
    render();
  });
})();