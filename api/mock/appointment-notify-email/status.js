/**
 * Vercel Serverless：GET /api/mock/appointment-notify-email/status
 */
var notifyMail = require('../../../scripts/lib/appointmentNotifyMail');

module.exports = async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    res.status(200).json(notifyMail.getSmtpStatus());
  } catch (e) {
    res.status(500).json({ error: e.message || String(e) });
  }
};
