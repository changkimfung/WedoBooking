/**
 * Vercel Serverless：与本地 dev-server GET/POST /api/mock/inventory-instruction 一致
 * 注意：Vercel 文件系统只读，写文件为尽力而为；失败时返回内存计算结果。
 */
var mockFile = require('../../scripts/lib/inventoryInstructionMockFile');
var service = require('../../scripts/lib/inventoryInstructionService');

function safeWrite(fn) {
  try { fn(); } catch (e) { /* Vercel 只读文件系统：忽略持久化失败 */ }
}

module.exports = async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  if (req.method === 'GET') {
    try {
      var list = mockFile.loadInventoryInstructionList();
      var changed = service.normalizeInstructionList(list);
      if (changed) safeWrite(function () { mockFile.writeInventoryInstructionList(list); });
      res.status(200).json({ list: list });
    } catch (e) {
      res.status(500).json({ error: e.message || String(e) });
    }
    return;
  }

  if (req.method === 'POST') {
    try {
      var body = req.body;
      if (typeof body === 'string') body = JSON.parse(body || '{}');
      if (!body || !Array.isArray(body.list)) {
        res.status(400).json({ error: '请求体需包含 list 数组' });
        return;
      }
      var stock = mockFile.loadInventoryStockSnapshot();
      service.expandWarehouseTasks(body.list, stock);
      safeWrite(function () { mockFile.writeInventoryInstructionList(body.list); });
      res.status(200).json({ ok: true, count: body.list.length, list: body.list });
    } catch (e) {
      res.status(500).json({ error: e.message || String(e) });
    }
    return;
  }

  res.status(405).json({ error: 'Method not allowed' });
};
