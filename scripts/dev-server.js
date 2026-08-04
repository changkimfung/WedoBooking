/**
 * 本地原型服务：静态资源 + 将预约送仓数据写入 mock_data/deliveryAppointment.js
 * 启动：npm run dev  →  http://localhost:3847/customer/deliveryAppointment.html
 */
var http = require('http');
var fs = require('fs');
var os = require('os');
var path = require('path');
var url = require('url');

try {
  require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
} catch (e) { /* dotenv 未安装时忽略 */ }

var mockFile = require('./lib/deliveryAppointmentMockFile');
var productMockFile = require('./lib/productInfoMockFile');
var productDetailFileApi = require('./lib/productDetailFileApi');
var brandAuthMockFile = require('./lib/brandAuthMockFile');
var brandAuthFileApi = require('./lib/brandAuthFileApi');
var brandAuthProductSync = require('./lib/brandAuthProductSync');
var wecomSmartsheet = require('./lib/wecomSmartsheet');
var productPhotoApi = require('./lib/productPhotoApi');
var notifyMail = require('./lib/appointmentNotifyMail');
var publicBaseUrl = require('./lib/publicBaseUrl');

var ROOT = path.join(__dirname, '..');
var DEMO_ROOT = path.join(ROOT, '..', 'Demo');
var PORT = Number(process.env.PORT) || 3847;
var API_PATH = '/api/mock/delivery-appointment';
var PRODUCT_API_PATH = '/api/mock/product-info';
var BRAND_AUTH_API_PATH = '/api/mock/brand-authorization';
var WECOM_SYNC_PRODUCT_PATH = '/api/wecom/sync-product';
var PRODUCT_PHOTO_LOOKUP_PATH = '/api/mock/product-photo/lookup';
var PRODUCT_PHOTO_INBOUND_LOOKUP_PATH = '/api/mock/product-photo/inbound-lookup';
var PRODUCT_PHOTO_SUBMIT_PATH = '/api/mock/product-photo/submit';
var WECOM_SYNC_PRODUCT_PHOTO_PATH = '/api/wecom/sync-product-photo';
var NOTIFY_MAIL_PATH = '/api/mock/appointment-notify-email';
var SITE_CONFIG_PATH = '/api/mock/site-config';

var MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.pdf': 'application/pdf',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
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

  if (req.method === 'GET' && req.url === SITE_CONFIG_PATH) {
    try {
      sendJson(res, 200, { publicBaseUrl: publicBaseUrl.getPublicBaseUrl() });
    } catch (e) {
      sendJson(res, 500, { error: e.message || String(e) });
    }
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

  if (req.method === 'GET' && req.url === PRODUCT_API_PATH) {
    try {
      sendJson(res, 200, { list: productMockFile.loadProductInfoList() });
    } catch (e) {
      sendJson(res, 500, { error: e.message || String(e) });
    }
    return;
  }

  if (req.method === 'POST' && req.url === PRODUCT_API_PATH) {
    readBody(req)
      .then(function (body) {
        if (!body || !Array.isArray(body.list)) {
          sendJson(res, 400, { error: '请求体需包含 list 数组' });
          return;
        }
        var resolved = productDetailFileApi.resolveProductFiles(body.list);
        productMockFile.writeProductInfoList(resolved);
        sendJson(res, 200, { ok: true, count: resolved.length, list: resolved });
      })
      .catch(function (e) {
        sendJson(res, 500, { error: e.message || String(e) });
      });
    return;
  }

  if (req.method === 'GET' && req.url === BRAND_AUTH_API_PATH) {
    try {
      sendJson(res, 200, {
        list: brandAuthMockFile.loadBrandAuthList(),
        auditLogs: brandAuthMockFile.loadBrandAuthAuditLogs()
      });
    } catch (e) {
      sendJson(res, 500, { error: e.message || String(e) });
    }
    return;
  }

  if (req.method === 'POST' && req.url === BRAND_AUTH_API_PATH) {
    readBody(req)
      .then(function (body) {
        if (!body || !Array.isArray(body.list)) {
          sendJson(res, 400, { error: '请求体需包含 list 数组' });
          return;
        }
        var resolved = brandAuthFileApi.resolveAuthFiles(body.list);
        var auditLogs = Array.isArray(body.auditLogs) ? body.auditLogs : brandAuthMockFile.loadBrandAuthAuditLogs();
        brandAuthMockFile.writeBrandAuthData(resolved, auditLogs);
        var syncResult = brandAuthProductSync.syncProductsFromBrandAuth(resolved);
        sendJson(res, 200, {
          ok: true,
          count: resolved.length,
          list: resolved,
          auditLogs: auditLogs,
          syncedProducts: syncResult.syncedCount || 0
        });
      })
      .catch(function (e) {
        sendJson(res, 500, { error: e.message || String(e) });
      });
    return;
  }

  if (req.method === 'POST' && req.url === WECOM_SYNC_PRODUCT_PATH) {
    readBody(req)
      .then(function (body) {
        if (!body || !body.product) {
          sendJson(res, 400, { error: '请求体需包含 product 对象' });
          return;
        }
        return wecomSmartsheet.syncProductToSmartsheet(body.product);
      })
      .then(function (result) {
        if (!result) return;
        sendJson(res, 200, result);
      })
      .catch(function (e) {
        sendJson(res, 500, { error: e.message || String(e) });
      });
    return;
  }

  if (req.method === 'GET' && req.url.indexOf(PRODUCT_PHOTO_LOOKUP_PATH) === 0) {
    try {
      var lookupParsed = url.parse(req.url, true);
      var sku = (lookupParsed.query && lookupParsed.query.sku) || '';
      var found = productPhotoApi.lookupProductBySku(sku);
      if (!found) {
        sendJson(res, 404, { error: '中台未找到该 SKU', sku: String(sku || '').trim() });
        return;
      }
      sendJson(res, 200, { ok: true, product: found });
    } catch (e) {
      sendJson(res, 500, { error: e.message || String(e) });
    }
    return;
  }

  if (req.method === 'GET' && req.url.indexOf(PRODUCT_PHOTO_INBOUND_LOOKUP_PATH) === 0) {
    try {
      var inboundParsed = url.parse(req.url, true);
      var orderNo = (inboundParsed.query && inboundParsed.query.orderNo) || '';
      var inboundFound = productPhotoApi.lookupInboundOrderByNo(orderNo);
      if (!inboundFound) {
        sendJson(res, 404, { error: '中台未找到该入库单', orderNo: String(orderNo || '').trim() });
        return;
      }
      sendJson(res, 200, { ok: true, inboundOrder: inboundFound });
    } catch (e) {
      sendJson(res, 500, { error: e.message || String(e) });
    }
    return;
  }

  if (req.method === 'POST' && req.url === PRODUCT_PHOTO_SUBMIT_PATH) {
    readBody(req)
      .then(function (body) {
        return productPhotoApi.submitProductPhotos(body || {});
      })
      .then(function (result) {
        sendJson(res, 200, result);
      })
      .catch(function (e) {
        sendJson(res, 400, { error: e.message || String(e) });
      });
    return;
  }

  if (req.method === 'POST' && req.url === WECOM_SYNC_PRODUCT_PHOTO_PATH) {
    readBody(req)
      .then(function (body) {
        if (!body) {
          sendJson(res, 400, { error: '请求体不能为空' });
          return;
        }
        if (Array.isArray(body.items)) {
          return wecomSmartsheet.syncProductPhotoBatchToSmartsheet(body.items);
        }
        return wecomSmartsheet.syncProductPhotoToSmartsheet(body);
      })
      .then(function (result) {
        if (!result) return;
        sendJson(res, 200, result);
      })
      .catch(function (e) {
        sendJson(res, 500, { error: e.message || String(e) });
      });
    return;
  }

  serveStatic(req, res);
});

function getLanIpv4Addresses() {
  var addrs = [];
  var nets = os.networkInterfaces();
  Object.keys(nets).forEach(function (name) {
    (nets[name] || []).forEach(function (net) {
      if (net.family === 'IPv4' && !net.internal) addrs.push(net.address);
    });
  });
  return addrs;
}

server.listen(PORT, '0.0.0.0', function () {
  var smtp = notifyMail.getSmtpStatus();
  var lanIps = getLanIpv4Addresses();
  console.log('PmDemo dev server: http://localhost:' + PORT);
  console.log('  客户预约送仓: http://localhost:' + PORT + '/customer/deliveryAppointment.html');
  console.log('  官网预约送仓: http://localhost:' + PORT + '/fg/index.html');
  console.log('  收货预约管理(海外仓): http://localhost:' + PORT + '/us/receiving-appointment.html');
  if (lanIps.length) {
    console.log('  内网访问（需先运行 scripts/open-firewall.ps1 开放防火墙）:');
    lanIps.forEach(function (ip) {
      console.log('    http://' + ip + ':' + PORT + '/customer/deliveryAppointment.html');
    });
  }
  console.log('  写入 mock: POST ' + API_PATH);
  console.log('  产品信息同步: GET/POST ' + PRODUCT_API_PATH);
  console.log('  品牌授权文件: GET/POST ' + BRAND_AUTH_API_PATH);
  console.log('  品牌授权管理: http://localhost:' + PORT + '/wh/brandAuthorization.html');
  console.log('  企微 SKU 同步: POST ' + WECOM_SYNC_PRODUCT_PATH);
  console.log('  产品拍照: GET ' + PRODUCT_PHOTO_LOOKUP_PATH + '?sku=...');
  console.log('  入库单校验: GET ' + PRODUCT_PHOTO_INBOUND_LOOKUP_PATH + '?orderNo=...');
  console.log('  产品拍照提交: POST ' + PRODUCT_PHOTO_SUBMIT_PATH);
  console.log('  企微产品拍照同步: POST ' + WECOM_SYNC_PRODUCT_PHOTO_PATH);
  console.log('  客户产品列表: http://localhost:' + PORT + '/customer/productList.html');
  console.log('  仓储中台 PDA 产品拍照: http://localhost:' + PORT + '/wh/pda-product-photo.html');
  var wh = wecomSmartsheet.getWebhookUrl();
  if (wh) {
    console.log('  企微 Webhook(SKU): 已配置');
  } else {
    console.log('  企微 Webhook(SKU): 未配置（见 .env WECOM_SMARTSHEET_WEBHOOK）');
  }
  var photoWh = wecomSmartsheet.getProductPhotoWebhookUrl();
  if (photoWh) {
    console.log('  企微 Webhook(产品拍照): 已配置');
  } else {
    console.log('  企微 Webhook(产品拍照): 未配置（见 .env WECOM_SMARTSHEET_WEBHOOK_PHOTO）');
  }
  var inboundField = wecomSmartsheet.getPhotoInboundOrderFieldId();
  if (inboundField) {
    console.log('  企微关联入库单列: ' + inboundField);
  } else {
    console.log('  企微关联入库单列: 未配置（见 .env WECOM_PHOTO_INBOUND_ORDER_FIELD）');
  }
  console.log('  预约通知邮件: POST/GET ' + NOTIFY_MAIL_PATH);
  if (smtp.configured) {
    console.log('  SMTP 已配置: ' + smtp.host + ':' + smtp.port + ' → ' + smtp.defaultTo);
  } else {
    console.log('  SMTP 未配置: 复制 .env.example 为 .env 并填写 SMTP 参数后重启');
  }
});
