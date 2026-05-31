/**
 * 测试 SMTP 发信：node scripts/test-notify-email.js
 * 需先在项目根目录配置 .env（参考 .env.example）
 */
var path = require('path');

require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

var notifyMail = require('./lib/appointmentNotifyMail');

var payload = {
  to: process.env.APPOINTMENT_NOTIFY_EMAIL || 'zhengjianfengb@sailvan.com',
  subject: '【预约送仓】SMTP 连通性测试',
  body: [
    '这是一封 SMTP 连通性测试邮件。',
    '',
    '预约单号：TEST-001',
    '送仓码：SC0000',
    '原状态：待预约',
    '新状态：仓库待确认',
    '变更时间：' + new Date().toISOString()
  ].join('\n'),
  appointmentId: 'test',
  appointmentNo: 'TEST-001',
  deliveryCode: 'SC0000',
  oldStatus: '待预约',
  newStatus: '仓库待确认'
};

console.log('SMTP 状态:', notifyMail.getSmtpStatus());

notifyMail.sendAppointmentNotifyEmail(payload)
  .then(function (entry) {
    console.log('发送成功:', entry);
    process.exit(0);
  })
  .catch(function (err) {
    console.error('发送失败:', err.message || err);
    process.exit(1);
  });
