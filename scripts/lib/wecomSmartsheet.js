/**
 * 企业微信智能表格 Webhook 同步（SKU 创建 → 智能表格追加一行）
 */
var https = require('https');
var url = require('url');

/** 企微 Webhook 字段 ID（新品查验表，可用 WECOM_FIELD_KEY_MAP 覆盖） */
var DEFAULT_FIELD_KEY_MAP = {
  yundeNo: 'f04Gwj',
  customerCode: 'ftk5Tx',
  inboundOrder: 'fIEBDU',
  productName: 'fA36o6',
  description: 'fMAfWQ',
  nameCn: 'fn8TJd',
  nameEn: 'foZmis',
  remindTime: 'faLj4m',
  auditStatus: 'fTTDv2'
};

/** PDA 产品拍照 → 企微在线表字段 ID（可用 WECOM_PHOTO_FIELD_KEY_MAP 覆盖） */
var DEFAULT_PHOTO_FIELD_KEY_MAP = {
  uploadTime: 'f3Qttt',
  yundeNo: 'fMYD7u',
  auditStatus: 'fJkfBD',
  inboundOrder: 'fp0MC5',
  warehouse: 'fYN4pL',
  operatorAccount: 'fIS8bc',
  imageUrl: 'fhS9ko'
};

var MOCK_PHOTO_OPERATOR_NAMES = ['张明', '李华', '王芳', '刘强', '陈静', '赵磊', '周敏', '吴涛'];
var MOCK_PHOTO_OPERATOR_PREFIXES = ['PDA', '仓管', '质检'];

/** 企微表已删除的列 fieldId，写入前强制剔除（如旧版 productCode） */
var DEPRECATED_WECOM_FIELD_IDS = ['ftQMc5'];

function parseJsonEnv(name, fallback) {
  var raw = process.env[name];
  if (!raw || !String(raw).trim()) return fallback;
  try {
    return JSON.parse(raw);
  } catch (e) {
    console.warn('[wecom] 无法解析 ' + name + '，使用默认值');
    return fallback;
  }
}

function getFieldKeyMap() {
  var global = parseJsonEnv('WECOM_FIELD_KEY_MAP', null);
  var map = global
    ? Object.assign({}, DEFAULT_FIELD_KEY_MAP, global)
    : Object.assign({}, DEFAULT_FIELD_KEY_MAP);
  if (!map.yundeNo && map.sku) map.yundeNo = map.sku;
  if (!map.auditStatus && map.infringement) map.auditStatus = map.infringement;
  delete map.productCode;
  return map;
}

function getPhotoFieldKeyMap() {
  var global = parseJsonEnv('WECOM_PHOTO_FIELD_KEY_MAP', null);
  var map = global
    ? Object.assign({}, DEFAULT_PHOTO_FIELD_KEY_MAP, global)
    : Object.assign({}, DEFAULT_PHOTO_FIELD_KEY_MAP);
  var inboundField = (process.env.WECOM_PHOTO_INBOUND_ORDER_FIELD || '').trim();
  if (inboundField) map.inboundOrder = inboundField;
  if (!map.yundeNo && map.sku) map.yundeNo = map.sku;
  return map;
}

function getPhotoInboundOrderFieldId() {
  return getPhotoFieldKeyMap().inboundOrder || '';
}

function getOmitFields() {
  var raw = process.env.WECOM_OMIT_FIELDS || '';
  return String(raw).split(/[,，]/).map(function (s) { return s.trim(); }).filter(Boolean);
}

function sanitizeWecomValues(values) {
  var out = Object.assign({}, values || {});
  DEPRECATED_WECOM_FIELD_IDS.forEach(function (id) {
    delete out[id];
  });
  return out;
}

function parseCreateTimeToMs(createTime) {
  if (!createTime) return String(Date.now());
  var normalized = String(createTime).trim().replace(' ', 'T');
  var ms = Date.parse(normalized);
  if (!isNaN(ms)) return String(ms);
  ms = Date.parse(String(createTime).trim());
  return String(isNaN(ms) ? Date.now() : ms);
}

function toRemindTimeValue(createTime) {
  var asDate = process.env.WECOM_REMIND_TIME_AS_DATE === 'true';
  if (asDate) return parseCreateTimeToMs(createTime);
  return createTime || new Date().toISOString().replace('T', ' ').slice(0, 19);
}

/** 演示用入库单号（格式对齐 mock RDxxxxxxxxx） */
function generateMockInboundOrderNo() {
  var n = Math.floor(Math.random() * 900000000) + 100000000;
  return 'RD' + String(n);
}

/** 演示用拍照操作人（如 PDA-张明） */
function generateMockPhotoOperator() {
  var prefix = MOCK_PHOTO_OPERATOR_PREFIXES[
    Math.floor(Math.random() * MOCK_PHOTO_OPERATOR_PREFIXES.length)
  ];
  var name = MOCK_PHOTO_OPERATOR_NAMES[
    Math.floor(Math.random() * MOCK_PHOTO_OPERATOR_NAMES.length)
  ];
  return prefix + '-' + name;
}

function resolvePhotoOperator(source) {
  var src = source || {};
  var explicit = String(
    src.operatorAccount || src.operator ||
    (process.env.WECOM_PHOTO_OPERATOR_ACCOUNT || '')
  ).trim();
  if (explicit) return explicit;
  if (process.env.WECOM_PHOTO_OPERATOR_RANDOM === 'false') return '';
  return generateMockPhotoOperator();
}

function resolveSkuInboundOrder(product) {
  var explicit = String(product.inboundOrderNo || product.inboundOrder || '').trim();
  if (explicit) return explicit;
  if (process.env.WECOM_SKU_INBOUND_ORDER_RANDOM === 'false') return '';
  return generateMockInboundOrderNo();
}

function buildSkuValues(product) {
  var keys = getFieldKeyMap();
  var omit = getOmitFields();
  var all = {
    yundeNo: product.yundeNo || product.skuCode || product.productCode || '',
    customerCode: product.userCode || '',
    inboundOrder: resolveSkuInboundOrder(product),
    productName: product.productName || '',
    description: product.description || '',
    nameCn: product.nameCn || '',
    nameEn: product.nameEn || '',
    remindTime: toRemindTimeValue(product.createTime),
    auditStatus: product.auditStatus || '待审核'
  };
  var values = {};
  Object.keys(all).forEach(function (logical) {
    var colKey = keys[logical];
    if (!colKey || omit.indexOf(colKey) !== -1 || omit.indexOf(logical) !== -1) return;
    if (logical === 'inboundOrder' && !all[logical]) return;
    values[colKey] = all[logical];
  });
  return values;
}

function getWebhookUrl() {
  return (
    (process.env.WECOM_SMARTSHEET_WEBHOOK || '').trim() ||
    (process.env.WECOM_SMARTSHEET_WEBHOOK_SHEET1 || '').trim()
  );
}

function getProductPhotoWebhookUrl() {
  return (process.env.WECOM_SMARTSHEET_WEBHOOK_PHOTO || '').trim();
}

function formatUploadTimeValue(uploadTime) {
  if (!uploadTime) {
    return new Date().toISOString().replace('T', ' ').slice(0, 19);
  }
  return String(uploadTime).trim();
}

/** 企微 url 列：单行一个链接，格式 [{ link, text }] */
function toSmartsheetUrlCellValue(url, text) {
  var link = String(url || '').trim();
  if (!link) return [];
  var label = String(text || '').trim();
  if (!label) label = link.split('/').pop() || link;
  return [{ link: link, text: label }];
}

function dedupeImageUrls(urls) {
  var list = Array.isArray(urls) ? urls : (urls ? [urls] : []);
  var seen = {};
  var result = [];
  list.forEach(function (raw) {
    var link = String(raw || '').trim();
    if (!link || seen[link]) return;
    seen[link] = true;
    result.push(link);
  });
  return result;
}

/** 单行 values；imageOnly 时仅写入图片链接列 */
function buildProductPhotoRowValues(record, imageOnly) {
  var keys = getPhotoFieldKeyMap();
  var omit = getOmitFields();
  var values = {};
  var imageKey = keys.imageUrl;
  var yundeNo = record.yundeNo || record.skuCode || record.sku || record.productCode || '';
  var linkText = record.imageLinkText || (yundeNo ? yundeNo + ' 产品图片' : '产品图片');
  if (record.imageIndex != null) {
    linkText = linkText + ' ' + record.imageIndex;
  }
  var imageUrl = toSmartsheetUrlCellValue(record.imageUrl || record.imageLink || '', linkText);

  if (imageKey && omit.indexOf(imageKey) === -1 && omit.indexOf('imageUrl') === -1 && imageUrl.length) {
    values[imageKey] = imageUrl;
  }

  if (imageOnly) return values;

  var fields = {
    yundeNo: yundeNo,
    inboundOrder: record.inboundOrderNo || record.inboundOrder || '',
    auditStatus: record.auditStatus || '待审核',
    warehouse: record.warehouse || '',
    uploadTime: formatUploadTimeValue(record.uploadTime),
    operatorAccount: resolvePhotoOperator(record)
  };
  Object.keys(fields).forEach(function (logical) {
    var colKey = keys[logical];
    if (!colKey || omit.indexOf(colKey) !== -1 || omit.indexOf(logical) !== -1) return;
    if (logical === 'inboundOrder' && !fields[logical]) return;
    if (logical === 'operatorAccount' && !fields[logical]) return;
    values[colKey] = fields[logical];
  });
  return values;
}

/** 多图展开为多行：首行全字段，后续行仅图片链接 */
function buildProductPhotoRows(record) {
  var imageUrls = record.imageUrls;
  if (!Array.isArray(imageUrls) || !imageUrls.length) {
    var single = record.imageUrl || record.imageLink || '';
    imageUrls = single ? [single] : [];
  }
  imageUrls = dedupeImageUrls(imageUrls);
  if (!imageUrls.length) return [];

  var baseRecord = Object.assign({}, record);
  if (!String(baseRecord.operatorAccount || baseRecord.operator || '').trim()) {
    baseRecord.operatorAccount = resolvePhotoOperator(record);
  }

  return imageUrls.map(function (imageUrl, idx) {
    return buildProductPhotoRowValues(Object.assign({}, baseRecord, {
      imageUrl: imageUrl,
      imageIndex: imageUrls.length > 1 ? idx + 1 : null
    }), idx > 0);
  });
}

function buildProductPhotoValues(record) {
  var rows = buildProductPhotoRows(record);
  return rows.length ? rows[0] : buildProductPhotoRowValues(record, false);
}

function getWebhookConfig() {
  return { webhook: getWebhookUrl() };
}

function postJson(targetUrl, payload) {
  return new Promise(function (resolve, reject) {
    var parsed = url.parse(targetUrl);
    var body = JSON.stringify(payload);
    var req = https.request({
      hostname: parsed.hostname,
      port: parsed.port || 443,
      path: parsed.path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Length': Buffer.byteLength(body)
      }
    }, function (res) {
      var chunks = [];
      res.on('data', function (c) { chunks.push(c); });
      res.on('end', function () {
        var text = Buffer.concat(chunks).toString('utf8');
        var data;
        try {
          data = JSON.parse(text || '{}');
        } catch (e) {
          reject(new Error('企微响应非 JSON：' + text.slice(0, 200)));
          return;
        }
        if (data.errcode && data.errcode !== 0) {
          reject(new Error(data.errmsg || ('errcode=' + data.errcode)));
          return;
        }
        resolve(data);
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function addRecordViaWebhook(webhookUrl, values) {
  return addRecordsViaWebhook(webhookUrl, [values]);
}

function addRecordsViaWebhook(webhookUrl, valuesList) {
  if (!webhookUrl) {
    return Promise.reject(new Error('Webhook 未配置'));
  }
  var list = Array.isArray(valuesList) ? valuesList : (valuesList ? [valuesList] : []);
  if (!list.length) {
    return Promise.reject(new Error('add_records 不能为空'));
  }
  return postJson(webhookUrl, {
    add_records: list.map(function (values) {
      return { values: sanitizeWecomValues(values) };
    })
  });
}

function syncProductPhotoToSmartsheet(record) {
  var webhookUrl = getProductPhotoWebhookUrl();
  var rows = buildProductPhotoRows(record);
  var result = {
    ok: false,
    skipped: false,
    values: rows,
    rowCount: rows.length,
    webhook: null
  };

  if (!webhookUrl) {
    result.skipped = true;
    result.message = '未配置 WECOM_SMARTSHEET_WEBHOOK_PHOTO';
    return Promise.resolve(result);
  }
  if (!rows.length) {
    result.skipped = true;
    result.message = '无图片链接可同步';
    return Promise.resolve(result);
  }

  return addRecordsViaWebhook(webhookUrl, rows)
    .then(function (data) {
      result.ok = true;
      result.webhook = { ok: true, data: data };
      result.message = '已同步至企业微信智能表格（产品拍照 ' + rows.length + ' 行）';
      return result;
    })
    .catch(function (err) {
      result.webhook = { ok: false, error: err.message || String(err), values: rows };
      result.message = '企业微信同步失败：' + (err.message || String(err));
      return result;
    });
}

function syncProductPhotoBatchToSmartsheet(records) {
  var list = Array.isArray(records) ? records : [];
  var webhookUrl = getProductPhotoWebhookUrl();
  var allRows = [];

  list.forEach(function (record) {
    allRows = allRows.concat(buildProductPhotoRows(record));
  });

  if (!allRows.length) {
    return Promise.resolve({ ok: true, results: [], rowCount: 0, message: '无待同步记录' });
  }

  if (!webhookUrl) {
    return Promise.resolve({
      ok: true,
      skipped: true,
      rowCount: allRows.length,
      results: [{
        ok: false,
        skipped: true,
        message: '未配置 WECOM_SMARTSHEET_WEBHOOK_PHOTO',
        values: allRows
      }],
      message: '未配置 WECOM_SMARTSHEET_WEBHOOK_PHOTO'
    });
  }

  return addRecordsViaWebhook(webhookUrl, allRows)
    .then(function (data) {
      return {
        ok: true,
        rowCount: allRows.length,
        results: [{
          ok: true,
          rowCount: allRows.length,
          values: allRows,
          webhook: { ok: true, data: data },
          message: '已同步至企业微信智能表格（产品拍照 ' + allRows.length + ' 行）'
        }]
      };
    })
    .catch(function (err) {
      return {
        ok: false,
        rowCount: allRows.length,
        results: [{
          ok: false,
          values: allRows,
          webhook: { ok: false, error: err.message || String(err) },
          message: '企业微信同步失败：' + (err.message || String(err))
        }]
      };
    });
}

function syncProductToSmartsheet(product) {
  var webhookUrl = getWebhookUrl();
  var values = buildSkuValues(product);
  var result = {
    ok: false,
    skipped: false,
    values: values,
    webhook: null
  };

  if (!webhookUrl) {
    result.skipped = true;
    result.message = '未配置 WECOM_SMARTSHEET_WEBHOOK';
    return Promise.resolve(result);
  }

  return addRecordViaWebhook(webhookUrl, values)
    .then(function (data) {
      result.ok = true;
      result.webhook = { ok: true, data: data };
      result.message = '已同步至企业微信智能表格';
      return result;
    })
    .catch(function (err) {
      result.webhook = { ok: false, error: err.message || String(err), values: values };
      result.message = '企业微信同步失败：' + (err.message || String(err));
      return result;
    });
}

module.exports = {
  generateMockInboundOrderNo: generateMockInboundOrderNo,
  generateMockPhotoOperator: generateMockPhotoOperator,
  resolvePhotoOperator: resolvePhotoOperator,
  buildSkuValues: buildSkuValues,
  buildProductPhotoValues: buildProductPhotoValues,
  buildProductPhotoRows: buildProductPhotoRows,
  toSmartsheetUrlCellValue: toSmartsheetUrlCellValue,
  dedupeImageUrls: dedupeImageUrls,
  getWebhookUrl: getWebhookUrl,
  getProductPhotoWebhookUrl: getProductPhotoWebhookUrl,
  getPhotoInboundOrderFieldId: getPhotoInboundOrderFieldId,
  getWebhookConfig: getWebhookConfig,
  addRecordViaWebhook: addRecordViaWebhook,
  addRecordsViaWebhook: addRecordsViaWebhook,
  syncProductToSmartsheet: syncProductToSmartsheet,
  syncProductPhotoToSmartsheet: syncProductPhotoToSmartsheet,
  syncProductPhotoBatchToSmartsheet: syncProductPhotoBatchToSmartsheet,
  syncProductToBothSheets: syncProductToSmartsheet
};
