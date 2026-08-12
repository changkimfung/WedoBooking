/**
 * Vercel Serverless：与本地 dev-server POST /api/mock/inventory-instruction/action 一致
 * 支持 claimSku / releaseSku / complete / forceResetSku。
 * 注意：Vercel 文件系统只读，写文件为尽力而为；失败时返回内存计算结果。
 */
var mockFile = require('../../../scripts/lib/inventoryInstructionMockFile');
var recordMockFile = require('../../../scripts/lib/inventoryCountRecordMockFile');
var service = require('../../../scripts/lib/inventoryInstructionService');

function safeWrite(fn) {
  try { fn(); } catch (e) { /* Vercel 只读文件系统：忽略持久化失败 */ }
}

module.exports = async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    var body = req.body;
    if (typeof body === 'string') body = JSON.parse(body || '{}');
    var list = mockFile.loadInventoryInstructionList();
    var result = service.applyInventoryAction(list, body);
    if (result.newRecord) {
      safeWrite(function () {
        var records = recordMockFile.loadInventoryCountRecordList();
        records.unshift(result.newRecord);
        recordMockFile.writeInventoryCountRecordList(records);
      });
    }
    safeWrite(function () { mockFile.writeInventoryInstructionList(list); });
    res.status(200).json({ ok: true, list: list, instruction: result.instruction });
  } catch (e) {
    res.status(400).json({ error: e.message || String(e) });
  }
};
