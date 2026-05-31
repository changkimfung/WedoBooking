/**
 * 本地原型服务：静态资源 + 将预约送仓数据写入 mock_data/deliveryAppointment.js
 * 启动：npm run dev  →  http://localhost:3847/customer/deliveryAppointment.html
 */
var http = require('http');
var fs = require('fs');
var path = require('path');
var url = require('url');

try {
  require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
} catch (e) { /* dotenv 未安装时忽略 */ }

var mockFile = require('./lib/deliveryAppointmentMockFile');
var notifyMail = require('./lib/appointmentNotifyMail');

var ROOT = path.join(__dirname, '..');
var DEMO_ROOT = path.join(ROOT, '..', 'Demo');
var PORT = Number(process.env.PORT) || 3847;
var API_PATH = '/api/mock/delivery-appointment';
var NOTIFY_MAIL_PATH = '/api/mock/appointment-notify-email';

var MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml'
};

function sendJson(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
}

function readBody(req) {
  return new Promise(function (resolve, reject) {
    var chunks = [];
    req.on('data', function (c) { chunks.push(c); });
    req.on('end', function () {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'));
      } catch (e) {
        reject(e);
      }
    });
    req.on('error', reject);
  });
}

function resolveStaticFile(pathname) {
  var safe = pathname.replace(/^\//, '').replace(/\.\./g, '');
  if (safe.indexOf('_demo/') === 0) {
    var demoRel = safe.slice('_demo/'.length);
    var demoPath = path.normalize(path.join(DEMO_ROOT, demoRel));
    if (demoPath.startsWith(path.normalize(DEMO_ROOT + path.sep))) return demoPath;
    return null;
  }
  var filePath = path.normalize(path.join(ROOT, safe));
  if (filePath.startsWith(path.normalize(ROOT + path.sep))) return filePath;
  return null;
}

function serveStatic(req, res) {
  var parsed = url.parse(req.url);
  var pathname = decodeURIComponent(parsed.pathname);
  if (pathname === '/') pathname = '/customer/deliveryAppointment.html';
  var filePath = resolveStaticFile(pathname);
  if (!filePath) {
    sendJson(res, 403, { error: 'forbidden' });
    return;
  }
  fs.stat(filePath, function (err, stat) {
    if (err || !stat.isFile()) {
      res.writeHead(404);
      res.end('Not Found');
      return;
    }
    var ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    fs.createReadStream(filePath).pipe(res);
  });
}

var server = http.createServer(function (req, res) {
  if (req.method === 'POST' && req.url === API_PATH) {
    readBody(req)
      .then(function (body) {
        if (!body || !Array.isArray(body.list)) {
          sendJson(res, 400, { error: '请求体需包含 list 数组' });
          return;
        }
        mockFile.writeDeliveryAppointmentList(body.list);
        sendJson(res, 200, { ok: true, count: body.list.length });
      })
      .catch(function (e) {
        sendJson(res, 500, { error: e.message || String(e) });
      });
    return;
  }

  if (req.method === 'GET' && req.url === API_PATH) {
    try {
      sendJson(res, 200, { list: mockFile.loadDeliveryAppointmentList() });
    } catch (e) {
      sendJson(res, 500, { error: e.message || String(e) });
    }
    return;
  }

  if (req.method === 'POST' && req.url === NOTIFY_MAIL_PATH) {
    readBody(req)
      .then(function (body) {
        if (!body || (!body.to && !process.env.APPOINTMENT_NOTIFY_EMAIL)) {
          sendJson(res, 400, { error: '请求体需包含 subject、body，或配置 APPOINTMENT_NOTIFY_EMAIL' });
          return;
        }
        return notifyMail.sendAppointmentNotifyEmail(body);
      })
      .then(function (entry) {
        if (!entry) return;
        sendJson(res, 200, { ok: true, entry: entry });
      })
      .catch(function (e) {
        sendJson(res, 500, { error: e.message || String(e) });
      });
    return;
  }

  if (req.method === 'GET' && req.url === NOTIFY_MAIL_PATH + '/status') {
    try {
      sendJson(res, 200, notifyMail.getSmtpStatus());
    } catch (e) {
      sendJson(res, 500, { error: e.message || String(e) });
    }
    return;
  }

  if (req.method === 'GET' && req.url === NOTIFY_MAIL_PATH) {
    try {
      sendJson(res, 200, { list: notifyMail.loadMailLog() });
    } catch (e) {
      sendJson(res, 500, { error: e.message || String(e) });
    }
    return;
  }

  serveStatic(req, res);
});

server.listen(PORT, function () {
  var smtp = notifyMail.getSmtpStatus();
  console.log('PmDemo dev server: http://localhost:' + PORT);
  console.log('  客户预约送仓: http://localhost:' + PORT + '/customer/deliveryAppointment.html');
  console.log('  官网预约送仓: http://localhost:' + PORT + '/fg/index.html');
  console.log('  收货预约管理(海外仓): http://localhost:' + PORT + '/us/receiving-appointment.html');
  console.log('  写入 mock: POST ' + API_PATH);
  console.log('  预约通知邮件: POST/GET ' + NOTIFY_MAIL_PATH);
  if (smtp.configured) {
    console.log('  SMTP 已配置: ' + smtp.host + ':' + smtp.port + ' → ' + smtp.defaultTo);
  } else {
    console.log('  SMTP 未配置: 复制 .env.example 为 .env 并填写 SMTP 参数后重启');
  }
});
