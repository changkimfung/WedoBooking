/**
 * 指令盘点纯业务逻辑（无文件读写），供本地 dev-server 与 Vercel 函数共用。
 * 所有函数只操作传入的内存数据；持久化由调用方决定。
 */

function nowStamp() {
  return new Date().toISOString().slice(0, 19).replace('T', ' ');
}

function findAutoCompletedSku(task, skuCode) {
  return (task.autoCompletedSkus || []).filter(function (item) {
    return item.skuCode === skuCode;
  })[0] || null;
}

function ensureAutoCompletedNoStockSkus(instruction, task, now) {
  var noStockSkus = task.noStockSkus || [];
  var changed = false;
  task.autoCompletedSkus = Array.isArray(task.autoCompletedSkus) ? task.autoCompletedSkus : [];
  noStockSkus.forEach(function (skuCode) {
    if (!findAutoCompletedSku(task, skuCode)) {
      task.autoCompletedSkus.push({ skuCode: skuCode, completedAt: now, remark: '无库存自动完结' });
      changed = true;
    }
  });
  return changed;
}

function isSkuCompleted(task, skuCode) {
  if (findAutoCompletedSku(task, skuCode)) return true;
  var items = (task.items || []).filter(function (item) { return item.skuCode === skuCode; });
  return items.length && items.every(function (item) { return item.lineStatus === '已盘'; });
}

function updateInstructionStatus(instruction, now) {
  if (instruction.status === '待提交' || instruction.status === '已废弃') return;
  var tasks = instruction.warehouseTasks || [];
  tasks.forEach(function (task) {
    var requestedSkus = Array.isArray(task.requestedSkus) ? task.requestedSkus : (instruction.requestedSkus || []);
    var allDone = requestedSkus.length && requestedSkus.every(function (sku) {
      return isSkuCompleted(task, sku.skuCode);
    });
    var hasCompletedSku = requestedSkus.some(function (sku) {
      return isSkuCompleted(task, sku.skuCode);
    });
    task.status = allDone ? '已完成' : (hasCompletedSku ? '盘点中' : '待盘点');
  });
  var validTasks = tasks.filter(function (task) {
    return (task.requestedSkus || instruction.requestedSkus || []).length;
  });
  if (validTasks.length && validTasks.every(function (task) { return task.status === '已完成'; })) {
    if (instruction.status !== '已完成') (instruction.operationLogs || (instruction.operationLogs = [])).push({ time: now, operator: '系统', action: '全部有效库位盘点完成，子单自动完成' });
    instruction.status = '已完成';
    instruction.completedAt = now;
  } else {
    instruction.status = tasks.some(function (task) {
      return task.status === '盘点中' || task.status === '已完成';
    }) ? '盘点中' : '待盘点';
    instruction.completedAt = '';
  }
}

function updateGroupStatus(list, groupId, now) {
  if (!groupId) return;
  var group = list.filter(function (item) { return item.id === groupId && item.recordType === 'group'; })[0];
  if (!group) return;
  var children = list.filter(function (item) { return item.groupId === groupId && item.recordType !== 'group'; });
  var activeChildren = children.filter(function (item) { return item.status !== '已废弃'; });
  if (activeChildren.length && activeChildren.every(function (item) { return item.status === '已完成'; })) {
    if (group.status !== '已完成') (group.operationLogs || (group.operationLogs = [])).push({ time: now, operator: '系统', action: '全部有效仓库子单已完成，组单自动完成' });
    group.status = '已完成';
    group.groupStatus = '已完成';
    group.completedAt = now;
  } else if (activeChildren.some(function (item) { return item.status === '盘点中' || item.status === '已完成'; })) {
    group.status = '盘点中';
    group.groupStatus = '盘点中';
    group.completedAt = '';
  } else {
    group.status = activeChildren.some(function (item) { return item.status === '待盘点'; }) ? '待盘点' : '待提交';
    group.groupStatus = group.status;
    group.completedAt = '';
  }
}

/** 读取列表前归一化：补齐无库存自动完结、刷新子单与组单状态。返回是否发生变化。 */
function normalizeInstructionList(list) {
  var changed = false;
  list.forEach(function (instruction) {
    if (instruction.recordType === 'group' || instruction.status === '已废弃') return;
    (instruction.warehouseTasks || []).forEach(function (task) {
      changed = ensureAutoCompletedNoStockSkus(instruction, task, instruction.initiatedAt || instruction.createdAt || nowStamp()) || changed;
    });
    updateInstructionStatus(instruction, instruction.initiatedAt || instruction.createdAt || nowStamp());
  });
  list.filter(function (instruction) { return instruction.recordType === 'group'; }).forEach(function (group) {
    updateGroupStatus(list, group.id, group.initiatedAt || group.createdAt || nowStamp());
  });
  return changed;
}

/** 保存列表前按库存快照拆分仓位任务。 */
function expandWarehouseTasks(list, stock) {
  var now = nowStamp();
  list.forEach(function (instruction) {
    if (instruction.recordType === 'group' || instruction.status === '已废弃') return;
    (instruction.warehouseTasks || []).forEach(function (task) {
      var taskSkus = Array.isArray(task.requestedSkus) ? task.requestedSkus : instruction.requestedSkus;
      if ((task.items || []).length || !Array.isArray(taskSkus)) return;
      task.noStockSkus = [];
      taskSkus.forEach(function (sku) {
        var records = stock.filter(function (record) { return record.warehouseCode === task.warehouseCode && record.skuCode === sku.skuCode; });
        if (!records.length) task.noStockSkus.push(sku.skuCode);
        records.forEach(function (record, index) {
          task.items.push({ lineId: task.taskId + '-' + sku.skuCode + '-' + index, skuCode: record.skuCode, productName: record.productName || sku.productName, locationCode: record.locationCode, expectedQty: record.expectedQty, countedQty: '', differenceQty: '', lineStatus: '待认领', claimedBy: '', claimedAt: '', countedBy: '', countedAt: '' });
        });
      });
      ensureAutoCompletedNoStockSkus(instruction, task, now);
    });
    updateInstructionStatus(instruction, now);
  });
  list.forEach(function (instruction) {
    if (instruction.recordType === 'group') updateGroupStatus(list, instruction.id, now);
  });
}

/** 构建盘点管理记录（差异为 0 自动审核通过）。 */
function buildInventoryCountRecord(instruction, task, line, operator, now) {
  var differenceQty = Number(line.countedQty) - Number(line.expectedQty);
  var autoApproved = differenceQty === 0;
  return {
    id: 'icr-' + Date.now() + '-' + line.lineId,
    instructionId: instruction.id,
    instructionNo: instruction.instructionNo,
    warehouseCode: task.warehouseCode,
    warehouseName: task.warehouseName,
    skuCode: line.skuCode,
    beforeQty: Number(line.expectedQty),
    countedQty: Number(line.countedQty),
    differenceQty: differenceQty,
    locationCode: line.locationCode,
    operator: operator,
    inventoryReason: '指令盘点',
    countedAt: now,
    auditedAt: autoApproved ? now : '',
    auditor: autoApproved ? '系统自动审核' : '',
    status: autoApproved ? '通过' : '待审核',
    remark: instruction.instructionNo + (autoApproved ? ' 盈亏平衡系统自动审核' : '')
  };
}

/**
 * 执行 PDA / PC 盘点动作。成功返回 { instruction, newRecord }；
 * 校验失败抛错。调用方负责持久化 list 与 newRecord。
 */
function applyInventoryAction(list, body) {
  var instruction = list.filter(function (item) { return item.id === body.instructionId; })[0];
  var task = instruction && (instruction.warehouseTasks || []).filter(function (item) { return item.warehouseCode === body.warehouseCode; })[0];
  var line = task && (task.items || []).filter(function (item) { return item.lineId === body.lineId; })[0];
  var skuItems = task && (task.items || []).filter(function (item) { return item.skuCode === body.skuCode; });
  if (instruction && instruction.status === '已废弃') throw new Error('该仓库子单已废弃，不能继续盘点');
  if (!task) throw new Error('未找到对应仓库盘点任务');
  if (!body.operator) throw new Error('操作人不能为空');
  var now = nowStamp();
  var newRecord = null;
  if (body.action === 'claimSku') {
    if (!body.skuCode || !skuItems.length) throw new Error('未找到对应料号盘点任务');
    var lockedItem = skuItems.filter(function (item) {
      return item.lineStatus === '盘点中' && item.claimedBy !== body.operator;
    })[0];
    if (lockedItem) throw new Error('料号 ' + body.skuCode + ' 已被 ' + lockedItem.claimedBy + ' 认领处理中');
    if (!skuItems.some(function (item) { return item.lineStatus !== '已盘'; })) throw new Error('该料号已完成盘点');
    skuItems.forEach(function (item) {
      if (item.lineStatus === '待认领') {
        item.lineStatus = '盘点中'; item.claimedBy = body.operator; item.claimedAt = now;
      }
    });
    (instruction.operationLogs || (instruction.operationLogs = [])).push({ time: now, operator: body.operator, action: '认领' + task.warehouseName + '料号 ' + body.skuCode + ' 的全部待盘库位' });
  } else if (body.action === 'releaseSku') {
    if (!body.skuCode || !skuItems.length) throw new Error('未找到对应料号盘点任务');
    if (skuItems.some(function (item) { return item.lineStatus === '盘点中' && item.claimedBy !== body.operator; })) throw new Error('仅认领人可放弃该料号任务');
    skuItems.forEach(function (item) {
      if (item.lineStatus === '盘点中' && item.claimedBy === body.operator) {
        item.lineStatus = '待认领'; item.claimedBy = ''; item.claimedAt = '';
      }
    });
    (instruction.operationLogs || (instruction.operationLogs = [])).push({ time: now, operator: body.operator, action: '放弃认领' + task.warehouseName + '料号 ' + body.skuCode });
  } else if (body.action === 'forceResetSku') {
    if (!body.skuCode || !skuItems.length) throw new Error('未找到对应料号盘点任务');
    var resetItems = skuItems.filter(function (item) { return item.lineStatus === '盘点中'; });
    if (!resetItems.length) throw new Error('该料号当前没有可重置的认领任务');
    resetItems.forEach(function (item) {
      item.lineStatus = '待认领'; item.claimedBy = ''; item.claimedAt = '';
    });
    (instruction.operationLogs || (instruction.operationLogs = [])).push({ time: now, operator: body.operator, action: '海外仓 PC 强行重置料号 ' + body.skuCode + ' 的认领状态' });
  } else if (body.action === 'complete') {
    if (!line) throw new Error('未找到对应库位盘点任务');
    if (line.lineStatus !== '盘点中' || line.claimedBy !== body.operator) throw new Error('仅认领人可提交盘点结果');
    if (!/^\d+$/.test(String(body.countedQty))) throw new Error('实盘数必须为非负整数');
    line.countedQty = Number(body.countedQty); line.differenceQty = line.countedQty - Number(line.expectedQty); line.lineStatus = '已盘'; line.countedBy = body.operator; line.countedAt = now;
    newRecord = buildInventoryCountRecord(instruction, task, line, body.operator, now);
    (instruction.operationLogs || (instruction.operationLogs = [])).push({ time: now, operator: body.operator, action: '完成' + task.warehouseName + '库位 ' + line.locationCode + '盘点，实盘 ' + line.countedQty });
  } else { throw new Error('不支持的盘点动作'); }
  updateInstructionStatus(instruction, now);
  updateGroupStatus(list, instruction.groupId, now);
  return { instruction: instruction, newRecord: newRecord };
}

module.exports = {
  nowStamp: nowStamp,
  findAutoCompletedSku: findAutoCompletedSku,
  ensureAutoCompletedNoStockSkus: ensureAutoCompletedNoStockSkus,
  isSkuCompleted: isSkuCompleted,
  updateInstructionStatus: updateInstructionStatus,
  updateGroupStatus: updateGroupStatus,
  normalizeInstructionList: normalizeInstructionList,
  expandWarehouseTasks: expandWarehouseTasks,
  buildInventoryCountRecord: buildInventoryCountRecord,
  applyInventoryAction: applyInventoryAction
};
