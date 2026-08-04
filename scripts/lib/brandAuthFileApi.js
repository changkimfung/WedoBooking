/**
 * 品牌授权文件 · base64 落盘
 */
var fs = require('fs');
var path = require('path');
var publicBaseUrl = require('./publicBaseUrl');

var UPLOAD_DIR = path.join(__dirname, '..', '..', 'mock_data', 'uploads', 'brand-auth-files');

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
  var safePrefix = String(prefix || 'brand').replace(/[^\w-]/g, '_');
  var filename = safePrefix + '_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6) + ext;
  var buf = Buffer.from(match[2], 'base64');
  fs.writeFileSync(path.join(UPLOAD_DIR, filename), buf);
  return '/mock_data/uploads/brand-auth-files/' + filename;
}

function resolveAuthFiles(list) {
  var now = formatDateTime();
  return (list || []).map(function (item) {
    var row = JSON.parse(JSON.stringify(item));
    delete row.pendingFiles;

    var existing = Array.isArray(row.authFiles) ? row.authFiles : [];
    var kept = existing.filter(function (f) {
      return f && !f._removed;
    }).map(function (f) {
      var copy = {
        fileName: f.fileName || '',
        url: publicBaseUrl.resolvePublicUrl(f.url || ''),
        uploadedAt: f.uploadedAt || now
      };
      return copy;
    });

    var pending = Array.isArray(item.pendingFiles) ? item.pendingFiles : [];
    pending.forEach(function (pf) {
      if (!pf || !pf.dataUrl) return;
      var url = saveDataUrlFile(pf.dataUrl, row.brandCode || row.id || 'brand', pf.fileName);
      if (url) {
        kept.push({
          fileName: pf.fileName || path.basename(url),
          url: url,
          uploadedAt: now
        });
      }
    });

    row.authFiles = kept;
    if (!Array.isArray(row.operationLogs)) row.operationLogs = [];
    row.updateTime = now;
    if (!row.createTime) row.createTime = now;
    return row;
  });
}

module.exports = {
  UPLOAD_DIR: UPLOAD_DIR,
  saveDataUrlFile: saveDataUrlFile,
  resolveAuthFiles: resolveAuthFiles,
  formatDateTime: formatDateTime
};
