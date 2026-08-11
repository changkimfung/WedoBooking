(function () {
  var C = InventoryInstructionCommon;
  var selectedIds = {};

  function e(s) {
    var d = document.createElement('div');
    d.textContent = s == null ? '' : s;
    return d.innerHTML;
  }

  function status(s) {
    return '<span class="inventory-status inventory-status-' + e(s) + '">' + e(s) + '</span>';
  }

  function childRows(list) {
    var groups = {};
    list.forEach(function (item) {
      if (C.isGroup(item)) groups[item.id] = item;
    });
    return C.executableInstructions(list).map(function (instruction) {
      return { instruction: instruction, group: groups[instruction.groupId] || null };
    });
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

  function selectedInstructions() {
    return Object.keys(selectedIds).filter(function (id) { return selectedIds[id]; });
  }

  function syncSelectionUi() {
    var eligible = document.querySelectorAll('[data-select-child]:not(:disabled)');
    var selected = selectedInstructions();
    document.getElementById('selectionHint').textContent = selected.length ? '已选择 ' + selected.length + ' 条可废弃子单' : '仅待提交、待盘点子单可废弃';
    document.getElementById('checkAll').checked = eligible.length > 0 && Array.prototype.every.call(eligible, function (input) {
      return input.checked;
    });
  }

  function filteredRows() {
    var no = document.getElementById('qNo').value.trim().toLowerCase();
    var st = document.getElementById('qStatus').value;
    return childRows(C.getList()).filter(function (row) {
      var instruction = row.instruction;
      var groupNo = (row.group && row.group.groupNo) || instruction.groupNo || '-';
      return (!no || String(instruction.instructionNo).toLowerCase().indexOf(no) >= 0 ||
        String(groupNo).toLowerCase().indexOf(no) >= 0) && (!st || C.normalizedStatus(instruction.status) === st);
    }).map(function (row) {
      row.task = (row.instruction.warehouseTasks || [])[0] || {};
      return row;
    });
  }

  function render() {
    var rows = filteredRows();

    document.getElementById('resultHint').textContent = '共 ' + rows.length + ' 条仓库指令子单';
    document.getElementById('taskBody').innerHTML = rows.map(function (row) {
      var instruction = row.instruction;
      var task = row.task;
      var progress = skuProgress(instruction, task);
      var currentStatus = C.normalizedStatus(instruction.status);
      var canDiscard = currentStatus === '待提交' || currentStatus === '待盘点';
      return '<tr>' +
        '<td><input type="checkbox" data-select-child="' + e(instruction.id) + '"' +
        (selectedIds[instruction.id] ? ' checked' : '') + (canDiscard ? '' : ' disabled') + '></td>' +
        '<td>' + e(instruction.instructionNo) + '</td>' +
        '<td>' + e(instruction.customerCode || '-') + '</td>' +
        '<td>' + progress.completed + ' / ' + progress.total + '</td>' +
        '<td>' + e(instruction.initiatedAt || instruction.createdAt || '-') + '</td>' +
        '<td>' + status(currentStatus) + '</td>' +
        '<td class="button"><a href="#" data-view-child="' + e(instruction.id) + '">查看明细</a></td>' +
      '</tr>';
    }).join('') || '<tr><td colspan="7">暂无数据</td></tr>';

    document.querySelectorAll('[data-select-child]').forEach(function (input) {
      input.onchange = function () {
        selectedIds[input.getAttribute('data-select-child')] = input.checked;
        syncSelectionUi();
      };
    });
    syncSelectionUi();

    document.querySelectorAll('[data-view-child]').forEach(function (link) {
      link.onclick = function (event) {
        event.preventDefault();
        window.location.href = 'inventoryInstructionDetail.html?instructionId=' + encodeURIComponent(link.getAttribute('data-view-child'));
      };
    });
  }

  function open(title, content) {
    document.getElementById('modalTitle').textContent = title;
    document.getElementById('modalContent').innerHTML = content;
    document.getElementById('taskModal').classList.remove('is-hidden');
  }

  function close() {
    document.getElementById('taskModal').classList.add('is-hidden');
  }

  function instructionDetail(instruction) {
    var task = (instruction.warehouseTasks || [])[0];
    if (!task) return '<p class="inventory-hint">该子单暂无仓库任务。</p>';
    var s = C.summary(task.items || []);
    var items = (task.items || []).map(function (item) {
      return '<tr><td>' + e(item.skuCode) + '</td><td>' + e(item.productName) +
        '</td><td>' + e(item.locationCode) + '</td><td>' + e(item.expectedQty) +
        '</td><td>' + e(item.lineStatus) + '</td><td>' + e(item.claimedBy || '-') +
        '</td><td>' + e(item.countedQty === '' ? '-' : item.countedQty) +
        '</td><td>' + e(item.differenceQty === '' ? '-' : item.differenceQty) + '</td></tr>';
    }).join('') || '<tr><td colspan="8">暂无已生成的库位任务</td></tr>';
    return '<div class="inventory-child-detail">' +
      '<p class="inventory-hint">本仓运德编号：' + e((task.requestedSkus || instruction.requestedSkus || []).map(function (item) {
        return item.skuCode;
      }).join('、') || '-') + '</p>' +
      '<p class="inventory-hint">待认领 ' + s.pending + ' / 盘点中 ' + s.claimed + ' / 已盘 ' + s.done + '</p>' +
      '<table class="inventory-item-table"><tr><th>运德编号</th><th>品名</th><th>库位</th><th>账存</th><th>状态</th><th>认领人</th><th>实盘</th><th>差异</th></tr>' + items + '</table>' +
      (task.noStockSkus && task.noStockSkus.length ? '<p>无在仓库存运德编号：' + e(task.noStockSkus.join('、')) + '</p>' : '') +
    '</div>';
  }

  function groupDetail(id) {
    var list = C.getList();
    var group = C.find(list, id);
    if (!group) return;
    var children = C.executableInstructions(list).filter(function (item) { return item.groupId === group.id; });
    if (!C.isGroup(group)) children = [group];
    var rows = children.map(function (child) {
      var task = (child.warehouseTasks || [])[0] || {};
      var progress = C.progressSummary(child);
      return '<tr><td>' + e(child.instructionNo) + '</td><td>' + e(task.warehouseName || '-') + '</td><td>' +
        e((task.requestedSkus || child.requestedSkus || []).length) + '</td><td>' +
        progress.pending + ' / ' + progress.claimed + ' / ' + progress.done + '</td><td>' +
        status(child.status) + '</td><td class="button"><a href="#" data-view-child="' + e(child.id) + '">查看明细</a></td></tr>';
    }).join('');
    open('指令盘点组单 · ' + (group.groupNo || group.instructionNo),
      '<table class="inventory-form-table"><tr><td class="inventory-form-label">客户编码</td><td>' + e(group.customerCode || '-') +
      '</td><td class="inventory-form-label">盘点原因</td><td>' + e(group.inventoryReason || '-') +
      '</td></tr><tr><td class="inventory-form-label">发起时间</td><td>' + e(group.initiatedAt || group.createdAt || '-') +
      '</td><td class="inventory-form-label">备注</td><td>' + e(group.remark || '-') +
      '</td></tr></table><div class="inventory-wh-section"><h4>仓库子单</h4><table class="inventory-item-table"><tr><th>子单号</th><th>目标仓</th><th>运德编号数</th><th>待认领 / 盘点中 / 已盘</th><th>状态</th><th>操作</th></tr>' + rows + '</table></div>');
    document.querySelectorAll('[data-view-child]').forEach(function (link) {
      link.onclick = function (event) {
        event.preventDefault();
        var child = C.find(C.getList(), link.getAttribute('data-view-child'));
        if (child) open('仓库指令单 · ' + child.instructionNo, instructionDetail(child));
      };
    });
  }

  function batchDiscard() {
    var ids = selectedInstructions();
    if (!ids.length) return window.alert('请先勾选待提交或待盘点的仓库子单');
    if (!window.confirm('确认废弃已选的 ' + ids.length + ' 条仓库子单吗？废弃后不可通过 PDA 继续盘点。')) return;
    var list = C.getList();
    var now = C.now();
    list.forEach(function (instruction) {
      if (!selectedIds[instruction.id] || (instruction.status !== '待提交' && instruction.status !== '待盘点')) return;
      instruction.status = '已废弃';
      instruction.discardedAt = now;
      instruction.discardedBy = '中台操作员';
      C.addLog(instruction, instruction.discardedBy, '中台批量废弃仓库子单');
    });
    document.getElementById('btnBatchDiscard').disabled = true;
    C.save(list, function (err) {
      document.getElementById('btnBatchDiscard').disabled = false;
      if (err) return window.alert(err.message);
      selectedIds = {};
      render();
    });
  }

  function init() {
    document.getElementById('btnQuery').onclick = function () { selectedIds = {}; render(); };
    document.getElementById('btnNew').onclick = function () { window.location.href = 'inventoryInstructionCreate.html'; };
    document.getElementById('checkAll').onchange = function () {
      document.querySelectorAll('[data-select-child]:not(:disabled)').forEach(function (input) {
        input.checked = document.getElementById('checkAll').checked;
        selectedIds[input.getAttribute('data-select-child')] = input.checked;
      });
      syncSelectionUi();
    };
    document.getElementById('btnBatchDiscard').onclick = batchDiscard;
    document.getElementById('btnExportReport').onclick = function () {
      try {
        InventoryTaskReportExport.exportTasks(filteredRows());
      } catch (e) {
        window.alert(e.message || '报告导出失败，请重试');
      }
    };
    document.getElementById('closeModal').onclick = close;
    document.getElementById('taskModal').onclick = function (event) { if (event.target === this) close(); };
    C.load(function (err) {
      if (err) window.alert(err.message);
      render();
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();