/**
 * 中台产品编辑 · 产品文件 base64 落盘
 */
var fs = require('fs');
var path = require('path');
var publicBaseUrl = require('./publicBaseUrl');

var UPLOAD_DIR = path.join(__dirname, '..', '..', 'mock_data', 'uploads', 'product-files');

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
    'application/pdf': '.pdf',
    'application/msword': '.doc',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
    'image/jpeg': '.jpg',
    'image/jpg': '.jpg',
    'image/png': '.png',
    'image/webp': '.webp',
    'image/gif': '.gif'
  };
  return map[String(mime || '').toLowerCase()] || '.bin';
}

function extFromFileName(fileName) {
  var m = String(fileName || '').match(/(\.[a-zA-Z0-9]+)$/);
  return m ? m[1].toLowerCase() : '';
}

function saveDataUrlFile(dataUrl, prefix, fileName) {
  var raw = String(dataUrl || '').trim();
  if (!raw) return '';
  if (raw.indexOf('data:') !== 0) {
    return publicBaseUrl.resolvePublicUrl(raw);
  }
  var match = raw.match(/^data:([^;]+);base64,(.+)$/i);
  if (!match) return raw;
  ensureUploadDir();
  var ext = extFromFileName(fileName) || extFromMime(match[1]);
  var safePrefix = String(prefix || 'prod').replace(/[^\w-]/g, '_');
  var filename = safePrefix + '_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6) + ext;
  var buf = Buffer.from(match[2], 'base64');
  fs.writeFileSync(path.join(UPLOAD_DIR, filename), buf);
  return '/mock_data/uploads/product-files/' + filename;
}

function resolveProductFiles(list) {
  var now = formatDateTime();
  return (list || []).map(function (item) {
    var row = JSON.parse(JSON.stringify(item));
    delete row.pendingProductFiles;

    var existing = Array.isArray(row.productFiles) ? row.productFiles : [];
    var kept = existing.filter(function (f) {
      return f && !f._removed;
    }).map(function (f) {
      return {
        fileName: f.fileName || '',
        url: publicBaseUrl.resolvePublicUrl(f.url || ''),
        uploadedAt: f.uploadedAt || now
      };
    });

    var pending = Array.isArray(item.pendingProductFiles) ? item.pendingProductFiles : [];
    pending.forEach(function (pf) {
      if (!pf || !pf.dataUrl) return;
      var url = saveDataUrlFile(pf.dataUrl, row.productCode || row.id || 'prod', pf.fileName);
      if (url) {
        kept.push({
          fileName: pf.fileName || path.basename(url),
          url: url,
          uploadedAt: now
        });
      }
    });

    row.productFiles = kept;
    row.hasFile = kept.length > 0;
    return row;
  });
}

module.exports = {
  UPLOAD_DIR: UPLOAD_DIR,
  resolveProductFiles: resolveProductFiles
};
