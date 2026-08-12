/**
 * Vercel Serverless：与本地 dev-server GET /api/mock/inventory-count-record 一致
 */
var recordMockFile = require('../../scripts/lib/inventoryCountRecordMockFile');

module.exports = async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  if (req.method === 'GET') {
    try {
      res.status(200).json({ list: recordMockFile.loadInventoryCountRecordList() });
    } catch (e) {
      res.status(500).json({ error: e.message || String(e) });
    }
    return;
  }

  res.status(405).json({ error: 'Method not allowed' });
};
