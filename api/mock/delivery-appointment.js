/**
 * Vercel Serverless：与本地 dev-server POST/GET /api/mock/delivery-appointment 一致
 */
var mockFile = require('../../scripts/lib/deliveryAppointmentMockFile');

module.exports = async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  if (req.method === 'GET') {
    try {
      res.status(200).json({ list: mockFile.loadDeliveryAppointmentList() });
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
      mockFile.writeDeliveryAppointmentList(body.list);
      res.status(200).json({ ok: true, count: body.list.length });
    } catch (e) {
      res.status(500).json({ error: e.message || String(e) });
    }
    return;
  }

  res.status(405).json({ error: 'Method not allowed' });
};
