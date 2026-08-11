/** 指令盘点原型公共数据访问层。 */
var InventoryInstructionCommon = (function () {
  var API = '/api/mock/inventory-instruction';
  var ACTION_API = API + '/action';

  function clone(v) { return JSON.parse(JSON.stringify(v)); }
  function getList() { return clone(typeof MOCK_INVENTORY_INSTRUCTION_LIST === 'undefined' ? [] : MOCK_INVENTORY_INSTRUCTION_LIST); }
  function apply(list) { window.MOCK_INVENTORY_INSTRUCTION_LIST = clone(list); }
  function request(url, body, done) {
    fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      .then(function (res) { return res.json().then(function (data) { if (!res.ok) throw new Error(data.error || '操作失败'); return data; }); })
      .then(function (data) { apply(data.list || []); if (done) done(null, data); })
      .catch(function (err) { if (done) done(err); });
  }
  function load(done) {
    fetch(API).then(function (res) { return res.json().then(function (body) {
      if (!res.ok) throw new Error(body.error || '读取指令盘点数据失败');
      apply(body.list || []); if (done) done(null, getList());
    }); }).catch(function (err) { if (done) done(err); });
  }
  function save(list, done) { request(API, { list: list }, done); }
  function action(payload, done) { request(ACTION_API, payload, done); }
  function now() { var d = new Date(), p = function (n) { return String(n).padStart(2, '0'); }; return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes()) + ':' + p(d.getSeconds()); }
  function find(list, id) { return list.filter(function (t) { return t.id === id || t.instructionNo === id || t.groupNo === id; })[0] || null; }
  function isGroup(record) { return record && record.recordType === 'group'; }
  function normalizedStatus(value) {
    var legacy = { '已建单': '待盘点', '待执行': '待盘点', '已完结': '已完成' };
    return legacy[value] || value || '待提交';
  }
  function executableInstructions(list) { return list.filter(function (record) { return !isGroup(record); }); }
  function groupRecords(list) {
    var groups = {}, result = [];
    list.forEach(function (record) {
      if (isGroup(record)) {
        groups[record.id] = { group: record, children: [] };
        result.push(groups[record.id]);
      }
    });
    executableInstructions(list).forEach(function (record) {
      var entry = record.groupId && groups[record.groupId];
      if (entry) entry.children.push(record);
      else result.push({ group: record, children: [record], legacy: true });
    });
    return result;
  }
  function findWarehouseTask(instruction, warehouseCode) { return (instruction && instruction.warehouseTasks || []).filter(function (wt) { return wt.warehouseCode === warehouseCode; })[0] || null; }
  function addLog(task, operator, actionText) { (task.operationLogs || (task.operationLogs = [])).push({ time: now(), operator: operator, action: actionText }); }
  function summary(items) {
    var s = { total: items.length, pending: 0, claimed: 0, done: 0 };
    items.forEach(function (i) { if (i.lineStatus === '已盘') s.done++; else if (i.lineStatus === '盘点中') s.claimed++; else s.pending++; });
    return s;
  }
  function progressSummary(instruction) { var all = []; (instruction.warehouseTasks || []).forEach(function (wt) { all = all.concat(wt.items || []); }); return summary(all); }
  function groupProgress(children) { var all = []; children.forEach(function (instruction) { (instruction.warehouseTasks || []).forEach(function (task) { all = all.concat(task.items || []); }); }); return summary(all); }
  return { getList: getList, load: load, save: save, action: action, now: now, find: find, isGroup: isGroup, normalizedStatus: normalizedStatus, executableInstructions: executableInstructions, groupRecords: groupRecords, findWarehouseTask: findWarehouseTask, addLog: addLog, summary: summary, progressSummary: progressSummary, groupProgress: groupProgress };
})();
