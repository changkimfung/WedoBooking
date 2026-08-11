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
var inventoryInstructionMockFile = require('./lib/inventoryInstructionMockFile');
var inventoryCountRecordMockFile = require('./lib/inventoryCountRecordMockFile');

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
var INVENTORY_INSTRUCTION_API_PATH = '/api/mock/inventory-instruction';
var INVENTORY_INSTRUCTION_ACTION_PATH = INVENTORY_INSTRUCTION_API_PATH + '/action';
var INVENTORY_COUNT_RECORD_API_PATH = '/api/mock/inventory-count-record';

function createInventoryCountRecord(instruction, task, line, operator, now) {
  var differenceQty = Number(line.countedQty) - Number(line.expectedQty);
  var autoApproved = differenceQty === 0;
  var records = inventoryCountRecordMockFile.loadInventoryCountRecordList();
  records.unshift({
    id: 'icr-' + Date.now() + '-' + line.lineId,
    instructionId: instruction.id,
    instructionNo: instruction.instructionNo,
    warehouseCode: task.warehouseCode,
    warehouseName: task.warehouseName,
    skuCode: line.skuCode,
    beforeQty: Number(line.expectedQty),
    countedQty: Number(line.countedQty),
    differenceQty: differenceQty,
    locationCode: line.locationCode,
    operator: operator,
    inventoryReason: '指令盘点',
    countedAt: now,
    auditedAt: autoApproved ? now : '',
    auditor: autoApproved ? '系统自动审核' : '',
    status: autoApproved ? '通过' : '待审核',
    remark: instruction.instructionNo + (autoApproved ? ' 盈亏平衡系统自动审核' : '')
  });
  inventoryCountRecordMockFile.writeInventoryCountRecordList(records);
}

function findAutoCompletedSku(task, skuCode) {
  return (task.autoCompletedSkus || []).filter(function (item) {
    return item.skuCode === skuCode;
  })[0] || null;
}

function ensureAutoCompletedNoStockSkus(instruction, task, now) {
  var requestedSkus = Array.isArray(task.requestedSkus) ? task.requestedSkus : (instruction.requestedSkus || []);
  var noStockSkus = task.noStockSkus || [];
  var changed = false;
  task.autoCompletedSkus = Array.isArray(task.autoCompletedSkus) ? task.autoCompletedSkus : [];
  noStockSkus.forEach(function (skuCode) {
    if (!findAutoCompletedSku(task, skuCode)) {
      task.autoCompletedSkus.push({ skuCode: skuCode, completedAt: now, remark: '无库存自动完结' });
      changed = true;
    }
  });
  return changed;
}

function isSkuCompleted(task, skuCode) {
  if (findAutoCompletedSku(task, skuCode)) return true;
  var items = (task.items || []).filter(function (item) { return item.skuCode === skuCode; });
  return items.length && items.every(function (item) { return item.lineStatus === '已盘'; });
}

function updateInstructionStatus(instruction, now) {
  if (instruction.status === '待提交' || instruction.status === '已废弃') return;
  var tasks = instruction.warehouseTasks || [];
  tasks.forEach(function (task) {
    var requestedSkus = Array.isArray(task.requestedSkus) ? task.requestedSkus : (instruction.requestedSkus || []);
    var allDone = requestedSkus.length && requestedSkus.every(function (sku) {
      return isSkuCompleted(task, sku.skuCode);
    });
    var hasCompletedSku = requestedSkus.some(function (sku) {
      return isSkuCompleted(task, sku.skuCode);
    });
    task.status = allDone ? '已完成' : (hasCompletedSku ? '盘点中' : '待盘点');
  });
  var validTasks = tasks.filter(function (task) {
    return (task.requestedSkus || instruction.requestedSkus || []).length;
  });
  if (validTasks.length && validTasks.every(function (task) { return task.status === '已完成'; })) {
    if (instruction.status !== '已完成') (instruction.operationLogs || (instruction.operationLogs = [])).push({ time: now, operator: '系统', action: '全部有效库位盘点完成，子单自动完成' });
    instruction.status = '已完成';
    instruction.completedAt = now;
  } else {
    instruction.status = tasks.some(function (task) {
      return task.status === '盘点中' || task.status === '已完成';
    }) ? '盘点中' : '待盘点';
    instruction.completedAt = '';
  }
}

function updateGroupStatus(list, groupId, now) {
  if (!groupId) return;
  var group = list.filter(function (item) { return item.id === groupId && item.recordType === 'group'; })[0];
  if (!group) return;
  var children = list.filter(function (item) { return item.groupId === groupId && item.recordType !== 'group'; });
  var activeChildren = children.filter(function (item) { return item.status !== '已废弃'; });
  if (activeChildren.length && activeChildren.every(function (item) { return item.status === '已完成'; })) {
    if (group.status !== '已完成') (group.operationLogs || (group.operationLogs = [])).push({ time: now, operator: '系统', action: '全部有效仓库子单已完成，组单自动完成' });
    group.status = '已完成';
    group.groupStatus = '已完成';
    group.completedAt = now;
  } else if (activeChildren.some(function (item) { return item.status === '盘点中' || item.status === '已完成'; })) {
    group.status = '盘点中';
    group.groupStatus = '盘点中';
    group.completedAt = '';
  } else {
    group.status = activeChildren.some(function (item) { return item.status === '待盘点'; }) ? '待盘点' : '待提交';
    group.groupStatus = group.status;
    group.completedAt = '';
  }
}

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

  if (req.method === 'POST' && req.url === INVENTORY_INSTRUCTION_ACTION_PATH) {
    readBody(req)
      .then(function (body) {
        var list = inventoryInstructionMockFile.loadInventoryInstructionList();
        var instruction = list.filter(function (item) { return item.id === body.instructionId; })[0];
        var task = instruction && (instruction.warehouseTasks || []).filter(function (item) { return item.warehouseCode === body.warehouseCode; })[0];
        var line = task && (task.items || []).filter(function (item) { return item.lineId === body.lineId; })[0];
        var skuItems = task && (task.items || []).filter(function (item) { return item.skuCode === body.skuCode; });
        if (instruction && instruction.status === '已废弃') throw new Error('该仓库子单已废弃，不能继续盘点');
        if (!task) throw new Error('未找到对应仓库盘点任务');
        if (!body.operator) throw new Error('操作人不能为空');
        var now = new Date().toISOString().slice(0, 19).replace('T', ' ');
        if (body.action === 'claimSku') {
          if (!body.skuCode || !skuItems.length) throw new Error('未找到对应料号盘点任务');
          var lockedItem = skuItems.filter(function (item) {
            return item.lineStatus === '盘点中' && item.claimedBy !== body.operator;
          })[0];
          if (lockedItem) throw new Error('料号 ' + body.skuCode + ' 已被 ' + lockedItem.claimedBy + ' 认领处理中');
          if (!skuItems.some(function (item) { return item.lineStatus !== '已盘'; })) throw new Error('该料号已完成盘点');
          skuItems.forEach(function (item) {
            if (item.lineStatus === '待认领') {
              item.lineStatus = '盘点中'; item.claimedBy = body.operator; item.claimedAt = now;
            }
          });
          (instruction.operationLogs || (instruction.operationLogs = [])).push({ time: now, operator: body.operator, action: '认领' + task.warehouseName + '料号 ' + body.skuCode + ' 的全部待盘库位' });
        } else if (body.action === 'releaseSku') {
          if (!body.skuCode || !skuItems.length) throw new Error('未找到对应料号盘点任务');
          if (skuItems.some(function (item) { return item.lineStatus === '盘点中' && item.claimedBy !== body.operator; })) throw new Error('仅认领人可放弃该料号任务');
          skuItems.forEach(function (item) {
            if (item.lineStatus === '盘点中' && item.claimedBy === body.operator) {
              item.lineStatus = '待认领'; item.claimedBy = ''; item.claimedAt = '';
            }
          });
          (instruction.operationLogs || (instruction.operationLogs = [])).push({ time: now, operator: body.operator, action: '放弃认领' + task.warehouseName + '料号 ' + body.skuCode });
        } else if (body.action === 'forceResetSku') {
          if (!body.skuCode || !skuItems.length) throw new Error('未找到对应料号盘点任务');
          var resetItems = skuItems.filter(function (item) { return item.lineStatus === '盘点中'; });
          if (!resetItems.length) throw new Error('该料号当前没有可重置的认领任务');
          resetItems.forEach(function (item) {
            item.lineStatus = '待认领'; item.claimedBy = ''; item.claimedAt = '';
          });
          (instruction.operationLogs || (instruction.operationLogs = [])).push({ time: now, operator: body.operator, action: '海外仓 PC 强行重置料号 ' + body.skuCode + ' 的认领状态' });
        } else if (body.action === 'complete') {
          if (!line) throw new Error('未找到对应库位盘点任务');
          if (line.lineStatus !== '盘点中' || line.claimedBy !== body.operator) throw new Error('仅认领人可提交盘点结果');
          if (!/^\d+$/.test(String(body.countedQty))) throw new Error('实盘数必须为非负整数');
          line.countedQty = Number(body.countedQty); line.differenceQty = line.countedQty - Number(line.expectedQty); line.lineStatus = '已盘'; line.countedBy = body.operator; line.countedAt = now;
          createInventoryCountRecord(instruction, task, line, body.operator, now);
          (instruction.operationLogs || (instruction.operationLogs = [])).push({ time: now, operator: body.operator, action: '完成' + task.warehouseName + '库位 ' + line.locationCode + '盘点，实盘 ' + line.countedQty });
        } else { throw new Error('不支持的盘点动作'); }
        updateInstructionStatus(instruction, now);
        updateGroupStatus(list, instruction.groupId, now);
        inventoryInstructionMockFile.writeInventoryInstructionList(list);
        sendJson(res, 200, { ok: true, list: list, instruction: instruction });
      })
      .catch(function (e) { sendJson(res, 400, { error: e.message || String(e) }); });
    return;
  }

  if (req.method === 'GET' && req.url === INVENTORY_COUNT_RECORD_API_PATH) {
    try {
      sendJson(res, 200, { list: inventoryCountRecordMockFile.loadInventoryCountRecordList() });
    } catch (e) {
      sendJson(res, 500, { error: e.message || String(e) });
    }
    return;
  }

  if (req.method === 'GET' && req.url === INVENTORY_INSTRUCTION_API_PATH) {
    try {
      var instructionList = inventoryInstructionMockFile.loadInventoryInstructionList();
      var changed = false;
      instructionList.forEach(function (instruction) {
        if (instruction.recordType === 'group' || instruction.status === '已废弃') return;
        (instruction.warehouseTasks || []).forEach(function (task) {
          changed = ensureAutoCompletedNoStockSkus(instruction, task, instruction.initiatedAt || instruction.createdAt || new Date().toISOString().slice(0, 19).replace('T', ' ')) || changed;
        });
        updateInstructionStatus(instruction, instruction.initiatedAt || instruction.createdAt || new Date().toISOString().slice(0, 19).replace('T', ' '));
      });
      instructionList.filter(function (instruction) { return instruction.recordType === 'group'; }).forEach(function (group) {
        updateGroupStatus(instructionList, group.id, group.initiatedAt || group.createdAt || new Date().toISOString().slice(0, 19).replace('T', ' '));
      });
      if (changed) inventoryInstructionMockFile.writeInventoryInstructionList(instructionList);
      sendJson(res, 200, { list: instructionList });
    } catch (e) {
      sendJson(res, 500, { error: e.message || String(e) });
    }
    return;
  }

  if (req.method === 'POST' && req.url === INVENTORY_INSTRUCTION_API_PATH) {
    readBody(req)
      .then(function (body) {
        if (!body || !Array.isArray(body.list)) {
          sendJson(res, 400, { error: '请求体需包含 list 数组' });
          return;
        }
        var stock = inventoryInstructionMockFile.loadInventoryStockSnapshot();
        body.list.forEach(function (instruction) {
          if (instruction.recordType === 'group' || instruction.status === '已废弃') return;
          (instruction.warehouseTasks || []).forEach(function (task) {
            var taskSkus = Array.isArray(task.requestedSkus) ? task.requestedSkus : instruction.requestedSkus;
            if ((task.items || []).length || !Array.isArray(taskSkus)) return;
            task.noStockSkus = [];
            taskSkus.forEach(function (sku) {
              var records = stock.filter(function (record) { return record.warehouseCode === task.warehouseCode && record.skuCode === sku.skuCode; });
              if (!records.length) task.noStockSkus.push(sku.skuCode);
              records.forEach(function (record, index) {
                task.items.push({ lineId: task.taskId + '-' + sku.skuCode + '-' + index, skuCode: record.skuCode, productName: record.productName || sku.productName, locationCode: record.locationCode, expectedQty: record.expectedQty, countedQty: '', differenceQty: '', lineStatus: '待认领', claimedBy: '', claimedAt: '', countedBy: '', countedAt: '' });
              });
            });
            ensureAutoCompletedNoStockSkus(instruction, task, new Date().toISOString().slice(0, 19).replace('T', ' '));
          });
          updateInstructionStatus(instruction, new Date().toISOString().slice(0, 19).replace('T', ' '));
        });
        body.list.forEach(function (instruction) {
          if (instruction.recordType === 'group') updateGroupStatus(body.list, instruction.id, new Date().toISOString().slice(0, 19).replace('T', ' '));
        });
        inventoryInstructionMockFile.writeInventoryInstructionList(body.list);
        sendJson(res, 200, { ok: true, count: body.list.length, list: body.list });
      })
      .catch(function (e) {
        sendJson(res, 500, { error: e.message || String(e) });
      });
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
  console.log('  指令盘点原型: GET/POST ' + INVENTORY_INSTRUCTION_API_PATH);
  console.log('  指令盘点原子操作: POST ' + INVENTORY_INSTRUCTION_ACTION_PATH);
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
