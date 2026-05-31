/**
 * 预约单状态变更通知邮件：SMTP 真实发送 + 本地 JSON 审计日志
 */
var fs = require('fs');
var path = require('path');
var nodemailer = require('nodemailer');
var dns = require('dns');

var LOG_FILE = path.join(__dirname, '..', '..', 'mock_data', 'appointment-notify-mail.json');

function loadMailLog() {
  try {
    if (fs.existsSync(LOG_FILE)) {
      var raw = fs.readFileSync(LOG_FILE, 'utf8');
      var parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    }
  } catch (e) { /* ignore */ }
  return [];
}

function appendMailEntry(entry) {
  var list = loadMailLog();
  list.unshift(entry);
  if (list.length > 500) list.length = 500;
  fs.writeFileSync(LOG_FILE, JSON.stringify(list, null, 2), 'utf8');
  return entry;
}

function escapeHtml(str) {
  return String(str == null ? '' : str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function getPayloadFields(payload) {
  if (Array.isArray(payload.fields) && payload.fields.length) {
    return payload.fields;
  }
  return [
    { label: '预约单号', value: payload.appointmentNo || '-' },
    { label: '送仓码', value: payload.deliveryCode || '-' },
    { label: '原状态', value: payload.oldStatus || '-' },
    { label: '新状态', value: payload.newStatus || '-' }
  ];
}

function renderFieldRows(payload) {
  return getPayloadFields(payload).map(function (field) {
    return '<tr><td style="width:150px;padding:10px 12px;border:1px solid #e8eef6;background:#f7faff;color:#5d7288;font-weight:600;">' +
      escapeHtml(field.label || '-') + '</td><td style="padding:10px 12px;border:1px solid #e8eef6;color:#25384d;">' +
      escapeHtml(field.value == null || field.value === '' ? '-' : field.value) + '</td></tr>';
  }).join('');
}

function buildBrandBlock(brand) {
  var b = brand || {};
  var logo = b.logoUrl
    ? '<img src="' + escapeHtml(b.logoUrl) + '" alt="' + escapeHtml(b.name || 'WEDO SCM') + '" style="max-height:46px;max-width:160px;display:block;margin-right:14px;">'
    : '<div style="width:46px;height:46px;border-radius:12px;background:#1f5f9f;color:#fff;font-weight:700;line-height:46px;text-align:center;margin-right:14px;">W</div>';
  return [
    '<div style="display:flex;align-items:center;padding:22px 28px;background:#123b63;color:#fff;">',
    logo,
    '<div>',
    '<div style="font-size:20px;font-weight:700;letter-spacing:.5px;">' + escapeHtml(b.name || '运德供应链') + '</div>',
    '<div style="font-size:12px;opacity:.86;margin-top:2px;">' + escapeHtml(b.subtitle || 'WEDO SCM') + '</div>',
    b.description ? '<div style="font-size:12px;opacity:.82;margin-top:6px;">' + escapeHtml(b.description) + '</div>' : '',
    '</div>',
    '</div>'
  ].join('');
}

function renderTextBlock(text, style) {
  return '<p style="' + style + '">' + escapeHtml(text).replace(/\n/g, '<br>') + '</p>';
}

function renderActionTextBlock(payload, style) {
  var text = payload.actionText || '';
  var html = escapeHtml(text);
  if (payload.inlineActionLinkLabel && payload.actionUrl) {
    var link = '<a href="' + escapeHtml(payload.actionUrl) + '" style="color:#1f5f9f;text-decoration:underline;font-weight:600;">' +
      escapeHtml(payload.inlineActionLinkLabel) + '</a>';
    html = html.replace(escapeHtml(payload.inlineActionLinkLabel), link);
  }
  return '<p style="' + style + '">' + html.replace(/\n/g, '<br>') + '</p>';
}

function buildHtmlBody(payload) {
  var brand = payload.brand || {};
  var watermark = brand.watermarkUrl || brand.logoUrl || '';
  var bgStyle = watermark
    ? 'background:#f3f7fb url(' + escapeHtml(watermark) + ') no-repeat right 28px bottom 28px;background-size:160px auto;'
    : 'background:#f3f7fb;';
  var actionButton = payload.actionUrl && !payload.hideActionButton
    ? '<p style="margin:22px 0 4px;"><a href="' + escapeHtml(payload.actionUrl) +
      '" style="display:inline-block;background:#1f5f9f;color:#fff;text-decoration:none;padding:10px 18px;border-radius:4px;font-weight:600;">' +
      escapeHtml(payload.actionLabel || '查看详情') + '</a></p>'
    : '';
  var role = payload.recipientRole && !payload.hideRecipientRole
    ? '<span style="display:inline-block;margin-bottom:12px;padding:3px 9px;border-radius:999px;background:#eaf4ff;color:#1f5f9f;font-size:12px;">收件角色：' +
      escapeHtml(payload.recipientRole) + '</span>'
    : '';
  var footerStyle = 'margin-top:24px;color:' + escapeHtml(payload.footerColor || '#99a7b5') + ';font-size:12px;';

  return [
    '<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#25384d;line-height:1.7;' + bgStyle + 'padding:24px;">',
    '<div style="max-width:720px;margin:0 auto;background:#fff;border-radius:10px;overflow:hidden;box-shadow:0 8px 24px rgba(18,59,99,.12);">',
    buildBrandBlock(brand),
    '<div style="padding:28px;">',
    role,
    '<h2 style="margin:0 0 12px;font-size:22px;color:#123b63;">' + escapeHtml(payload.title || payload.subject || '预约送仓通知') + '</h2>',
    payload.intro ? renderTextBlock(payload.intro, 'margin:0 0 18px;color:#43566b;white-space:normal;') : '',
    '<table style="width:100%;border-collapse:collapse;margin:16px 0;" cellpadding="0" cellspacing="0">',
    renderFieldRows(payload),
    '</table>',
    payload.actionText ? renderActionTextBlock(payload, 'margin:18px 0 0;color:#43566b;white-space:normal;') : '',
    actionButton,
    payload.showRawBody && payload.body ? '<pre style="white-space:pre-wrap;background:#f7faff;border:1px solid #e8eef6;padding:12px;border-radius:6px;color:#5d7288;font-family:Arial,Helvetica,sans-serif;">' +
      escapeHtml(payload.body) + '</pre>' : '',
    renderTextBlock(payload.footerNote || '本邮件由运德预约送仓系统自动发送，请勿直接回复。', footerStyle),
    '</div>',
    '</div>',
    '</div>'
  ].join('');
}

function smtpLookup(hostname, options, callback) {
  dns.lookup(hostname, { family: 4, all: false }, callback);
}

function getSmtpConfig() {
  var port = Number(process.env.SMTP_PORT) || 587;
  var secure = process.env.SMTP_SECURE === 'true';
  return {
    host: process.env.SMTP_HOST,
    port: port,
    secure: secure,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    },
    tls: {
      servername: process.env.SMTP_HOST,
      minVersion: 'TLSv1.2'
    },
    lookup: smtpLookup
  };
}

function isSmtpConfigured() {
  return !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

function getDefaultNotifyEmail() {
  return process.env.APPOINTMENT_NOTIFY_EMAIL || 'zhengjianfengb@sailvan.com';
}

function getTransporter() {
  if (!isSmtpConfigured()) return null;
  transporterCache = nodemailer.createTransport(getSmtpConfig());
  return transporterCache;
}

function recordAppointmentNotifyEmail(payload, meta) {
  var info = meta || {};
  var entry = {
    id: 'mail-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
    sentAt: new Date().toISOString(),
    channel: info.channel || 'log',
    status: info.status || 'logged',
    to: payload.to,
    subject: payload.subject,
    body: payload.body,
    templateKey: payload.templateKey || '',
    recipientRole: payload.recipientRole || '',
    title: payload.title || '',
    intro: payload.intro || '',
    actionUrl: payload.actionUrl || '',
    actionLabel: payload.actionLabel || '',
    footerNote: payload.footerNote || '',
    footerColor: payload.footerColor || '',
    hideRecipientRole: payload.hideRecipientRole === true,
    hideActionButton: payload.hideActionButton === true,
    inlineActionLinkLabel: payload.inlineActionLinkLabel || '',
    fields: Array.isArray(payload.fields) ? payload.fields : [],
    appointmentId: payload.appointmentId || '',
    appointmentNo: payload.appointmentNo || '',
    deliveryCode: payload.deliveryCode || '',
    oldStatus: payload.oldStatus || '',
    newStatus: payload.newStatus || '',
    messageId: info.messageId || '',
    error: info.error || ''
  };
  appendMailEntry(entry);
  return entry;
}

/**
 * 发送预约状态变更通知（Promise）
 * @param {object} payload to, subject, body, appointmentId, ...
 * @returns {Promise<object>} 日志条目
 */
function sendAppointmentNotifyEmail(payload) {
  var mailPayload = Object.assign({}, payload);
  if (!mailPayload.to) mailPayload.to = getDefaultNotifyEmail();

  var transporter = getTransporter();
  if (!transporter) {
    var missing = recordAppointmentNotifyEmail(mailPayload, {
      channel: 'log',
      status: 'skipped',
      error: '未配置 SMTP（请在 .env 中设置 SMTP_HOST / SMTP_USER / SMTP_PASS）'
    });
    console.warn('[预约通知邮件] SMTP 未配置，仅写入本地日志:', missing.subject);
    return Promise.resolve(missing);
  }

  var from = process.env.SMTP_FROM || process.env.SMTP_USER;

  return transporter.sendMail({
    from: from,
    to: mailPayload.to,
    subject: mailPayload.subject,
    text: mailPayload.body,
    html: buildHtmlBody(mailPayload)
  }).then(function (info) {
    var entry = recordAppointmentNotifyEmail(mailPayload, {
      channel: 'smtp',
      status: 'sent',
      messageId: info.messageId || ''
    });
    console.log('[预约通知邮件] 已发送', entry.to, entry.subject, entry.messageId);
    return entry;
  }).catch(function (err) {
    var entry = recordAppointmentNotifyEmail(mailPayload, {
      channel: 'smtp',
      status: 'failed',
      error: err.message || String(err)
    });
    console.error('[预约通知邮件] 发送失败', entry.subject, entry.error);
    return Promise.reject(err);
  });
}

function getSmtpStatus() {
  return {
    configured: isSmtpConfigured(),
    host: process.env.SMTP_HOST || '',
    port: Number(process.env.SMTP_PORT) || 587,
    from: process.env.SMTP_FROM || process.env.SMTP_USER || '',
    defaultTo: getDefaultNotifyEmail()
  };
}

module.exports = {
  LOG_FILE: LOG_FILE,
  loadMailLog: loadMailLog,
  recordAppointmentNotifyEmail: recordAppointmentNotifyEmail,
  sendAppointmentNotifyEmail: sendAppointmentNotifyEmail,
  getSmtpStatus: getSmtpStatus,
  isSmtpConfigured: isSmtpConfigured
};
