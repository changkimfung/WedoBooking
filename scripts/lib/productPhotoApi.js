/**
 * 仓储中台 PDA · 产品拍照提交（保存图片 + 更新产品 + 企微同步）
 */
var fs = require('fs');
var path = require('path');
var productMockFile = require('./productInfoMockFile');
var inOrderMockFile = require('./inOrderMockFile');
var publicBaseUrl = require('./publicBaseUrl');
var wecomSmartsheet = require('./wecomSmartsheet');

var UPLOAD_DIR = path.join(__dirname, '..', '..', 'mock_data', 'uploads', 'product-photos');

function normSku(s) {
  return String(s == null ? '' : s).trim().toUpperCase();
}

function normOrderNo(s) {
  return String(s == null ? '' : s).trim().toUpperCase();
}

function formatDateTime(d) {
  var dt = d || new Date();
  var pad = function (n) { return String(n).padStart(2, '0'); };
  return dt.getFullYear() + '-' + pad(dt.getMonth() + 1) + '-' + pad(dt.getDate()) +
    ' ' + pad(dt.getHours()) + ':' + pad(dt.getMinutes()) + ':' + pad(dt.getSeconds());
}

function ensureUploadDir() {
  if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  }
}

function extFromMime(mime) {
  var map = {
    'image/jpeg': '.jpg',
    'image/jpg': '.jpg',
    'image/png': '.png',
    'image/webp': '.webp',
    'image/gif': '.gif'
  };
  return map[String(mime || '').toLowerCase()] || '.jpg';
}

function saveDataUrlImage(dataUrl, skuCode) {
  var raw = String(dataUrl || '').trim();
  var match = raw.match(/^data:(image\/[\w.+-]+);base64,(.+)$/i);
  if (!match) return raw;
  ensureUploadDir();
  var ext = extFromMime(match[1]);
  var safeSku = normSku(skuCode).replace(/[^A-Z0-9._-]/g, '_') || 'SKU';
  var filename = safeSku + '_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6) + ext;
  var filePath = path.join(UPLOAD_DIR, filename);
  fs.writeFileSync(filePath, Buffer.from(match[2], 'base64'));
  return '/mock_data/uploads/product-photos/' + filename;
}

function resolveImageUrl(imageUrl, skuCode) {
  var raw = String(imageUrl || '').trim();
  if (!raw) return '';
  if (/^data:image\//i.test(raw)) {
    return publicBaseUrl.resolvePublicUrl(saveDataUrlImage(raw, skuCode));
  }
  return publicBaseUrl.resolvePublicUrl(raw);
}

function findProductBySku(list, skuCode) {
  var code = normSku(skuCode);
  if (!code) return null;
  for (var i = 0; i < list.length; i++) {
    var row = list[i];
    if (normSku(row.skuCode) === code || normSku(row.productCode) === code) {
      return row;
    }
  }
  return null;
}

function lookupProductBySku(skuCode) {
  var list = productMockFile.loadProductInfoList();
  var row = findProductBySku(list, skuCode);
  if (!row) return null;
  return {
    id: row.id,
    skuCode: row.skuCode || row.productCode,
    productCode: row.productCode,
    productName: row.productName || row.nameCn || '',
    userCode: row.userCode,
    auditStatus: row.auditStatus || '待审核',
    hasImage: !!row.hasImage
  };
}

function findInboundOrderByNo(list, orderNo) {
  var code = normOrderNo(orderNo);
  if (!code) return null;
  for (var i = 0; i < list.length; i++) {
    if (normOrderNo(list[i].orderNo) === code) return list[i];
  }
  return null;
}

function lookupInboundOrderByNo(orderNo) {
  var row = findInboundOrderByNo(inOrderMockFile.loadInOrderList(), orderNo);
  if (!row) return null;
  return {
    orderNo: row.orderNo,
    userCode: row.userCode,
    warehouse: row.warehouse,
    status: row.status,
    totalQty: row.totalQty,
    receivedQty: row.receivedQty
  };
}

/** 同一 SKU 多图分组，图片链接去重（企微侧展开为多行） */
function groupWecomRecordsBySku(normalized, inboundOrderNo) {
  var inboundOrder = String(inboundOrderNo || '').trim();
  var map = {};
  normalized.forEach(function (entry) {
    var key = normSku(entry.skuCode);
    if (!key) return;
    if (!map[key]) {
      map[key] = {
        skuCode: entry.skuCode,
        yundeNo: entry.yundeNo || '',
        inboundOrderNo: inboundOrder || entry.inboundOrderNo || '',
        auditStatus: entry.auditStatus,
        warehouse: entry.warehouse,
        uploadTime: entry.uploadTime,
        operatorAccount: entry.operatorAccount || '',
        imageUrls: []
      };
    }
    var url = String(entry.imageUrl || '').trim();
    if (url && map[key].imageUrls.indexOf(url) === -1) {
      map[key].imageUrls.push(url);
    }
  });
  return Object.keys(map).map(function (key) { return map[key]; });
}

function submitProductPhotos(payload) {
  var items = payload && Array.isArray(payload.items) ? payload.items : [];
  if (!items.length) {
    return Promise.reject(new Error('提交列表不能为空'));
  }

  var inboundOrderNo = String(payload.inboundOrderNo || payload.inboundOrder || '').trim();
  var operatorAccount = wecomSmartsheet.resolvePhotoOperator(payload);

  var warehouse = (payload.warehouse || '').trim() || '深圳A仓';
  var uploadTime = formatDateTime();
  var list = productMockFile.loadProductInfoList();
  var normalized = [];
  var errors = [];

  items.forEach(function (item, idx) {
    var skuCode = String(item.skuCode || item.sku || '').trim();
    if (!skuCode) {
      errors.push('第 ' + (idx + 1) + ' 条缺少 SKU 编码');
      return;
    }
    var product = findProductBySku(list, skuCode);
    if (!product) {
      errors.push('SKU ' + skuCode + ' 在中台不存在');
      return;
    }
    var imageUrl = resolveImageUrl(item.imageUrl || item.imageDataUrl || item.url, skuCode);
    if (!imageUrl) {
      errors.push('SKU ' + skuCode + ' 缺少图片');
      return;
    }
    normalized.push({
      skuCode: product.skuCode || product.productCode,
      yundeNo: product.yundeNo || '',
      productId: product.id,
      imageUrl: imageUrl,
      auditStatus: product.auditStatus || '待审核',
      warehouse: warehouse,
      uploadTime: uploadTime,
      operatorAccount: operatorAccount
    });
  });

  if (errors.length) {
    return Promise.reject(new Error(errors.join('；')));
  }

  normalized.forEach(function (entry) {
    for (var i = 0; i < list.length; i++) {
      if (list[i].id !== entry.productId) continue;
      list[i].hasImage = true;
      if (!Array.isArray(list[i].productPhotos)) list[i].productPhotos = [];
      list[i].productPhotos.push({
        url: entry.imageUrl,
        uploadedAt: uploadTime,
        warehouse: warehouse,
        inboundOrderNo: inboundOrderNo,
        source: 'pda-product-photo'
      });
      break;
    }
  });

  productMockFile.writeProductInfoList(list);

  var wecomRecords = groupWecomRecordsBySku(normalized, inboundOrderNo);
  var inboundFieldId = wecomSmartsheet.getPhotoInboundOrderFieldId();
  var inboundSyncWarning = inboundOrderNo && !inboundFieldId
    ? '已填写入库单但未配置 WECOM_PHOTO_INBOUND_ORDER_FIELD，关联入库单未写入企微'
    : null;

  return wecomSmartsheet.syncProductPhotoBatchToSmartsheet(wecomRecords)
    .then(function (wecomResult) {
      var failed = (wecomResult.results || []).filter(function (r) {
        return !r.ok && !r.skipped;
      });
      return {
        ok: failed.length === 0,
        count: normalized.length,
        wecomRowCount: wecomResult.rowCount || 0,
        inboundOrderNo: inboundOrderNo,
        inboundOrderFieldId: inboundFieldId || null,
        inboundSyncWarning: inboundSyncWarning,
        uploadTime: uploadTime,
        warehouse: warehouse,
        items: normalized,
        wecomRecords: wecomRecords,
        wecom: wecomResult
      };
    });
}

module.exports = {
  lookupProductBySku: lookupProductBySku,
  lookupInboundOrderByNo: lookupInboundOrderByNo,
  submitProductPhotos: submitProductPhotos
};
