/**
 * Vercel Serverless：POST/GET /api/mock/appointment-notify-email
 */
var notifyMail = require('../../scripts/lib/appointmentNotifyMail');

module.exports = async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  if (req.method === 'GET') {
    try {
      res.status(200).json({ list: notifyMail.loadMailLog() });
    } catch (e) {
      res.status(500).json({ error: e.message || String(e) });
    }
    return;
  }

  if (req.method === 'POST') {
    try {
      var body = req.body;
      if (typeof body === 'string') body = JSON.parse(body || '{}');
      if (!body || (!body.to && !process.env.APPOINTMENT_NOTIFY_EMAIL)) {
        res.status(400).json({
          error: '请求体需包含 subject、body，或配置 APPOINTMENT_NOTIFY_EMAIL'
        });
        return;
      }
      var entry = await notifyMail.sendAppointmentNotifyEmail(body);
      res.status(200).json({ ok: true, entry: entry });
    } catch (e) {
      res.status(500).json({ error: e.message || String(e) });
    }
    return;
  }

  res.status(405).json({ error: 'Method not allowed' });
};
