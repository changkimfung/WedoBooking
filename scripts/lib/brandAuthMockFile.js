/**
 * 读写 mock_data/brandAuthorization.js
 */
var fs = require('fs');
var path = require('path');
var vm = require('vm');

var MOCK_FILE = path.join(__dirname, '..', '..', 'mock_data', 'brandAuthorization.js');
var LIST_MARKER = 'var MOCK_BRAND_AUTH_LIST = ';
var AUDIT_MARKER = 'var MOCK_BRAND_AUTH_AUDIT_LOGS = ';

function loadSandbox() {
  var code = fs.readFileSync(MOCK_FILE, 'utf8');
  var sandbox = {};
  vm.runInNewContext(code, sandbox, { filename: MOCK_FILE });
  return sandbox;
}

function loadBrandAuthList() {
  return JSON.parse(JSON.stringify(loadSandbox().MOCK_BRAND_AUTH_LIST || []));
}

function loadBrandAuthAuditLogs() {
  return JSON.parse(JSON.stringify(loadSandbox().MOCK_BRAND_AUTH_AUDIT_LOGS || []));
}

function formatString(s) {
  if (s === '') return "''";
  return "'" + String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'";
}

function formatValue(value, indent) {
  var pad = '';
  for (var i = 0; i < indent; i++) pad += '  ';

  if (value === null || value === undefined) return "''";
  if (typeof value === 'number') return String(value);
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'string') return formatString(value);
  if (Array.isArray(value)) {
    if (!value.length) return '[]';
    var isPrimitive = typeof value[0] !== 'object' || value[0] === null;
    if (isPrimitive) {
      return '[\n' + value.map(function (v) {
        return pad + '  ' + formatString(v);
      }).join(',\n') + '\n' + pad + ']';
    }
    return '[\n' + value.map(function (v) {
      return pad + '  ' + formatObject(v, indent + 1);
    }).join(',\n') + '\n' + pad + ']';
  }
  return formatObject(value, indent);
}

function formatObject(obj, indent) {
  var pad = '';
  for (var i = 0; i < indent; i++) pad += '  ';
  var keys = Object.keys(obj);
  var lines = keys.map(function (key) {
    return pad + '  ' + key + ': ' + formatValue(obj[key], indent + 1);
  });
  return '{\n' + lines.join(',\n') + '\n' + pad + '}';
}

function formatList(list) {
  var body = list.map(function (item) {
    return '  ' + formatObject(item, 1);
  }).join(',\n');
  return '[\n' + body + '\n]';
}

function getFileHeader() {
  var content = fs.readFileSync(MOCK_FILE, 'utf8');
  var startIdx = content.indexOf(LIST_MARKER);
  if (startIdx < 0) {
    throw new Error('mock 文件结构异常，未找到 MOCK_BRAND_AUTH_LIST 标记');
  }
  return content.slice(0, startIdx);
}

function writeBrandAuthData(list, auditLogs) {
  var header = getFileHeader();
  var audit = auditLogs != null ? auditLogs : loadBrandAuthAuditLogs();
  var next = header +
    LIST_MARKER + formatList(list) + ';\n' +
    AUDIT_MARKER + formatList(audit) + ';\n';
  fs.writeFileSync(MOCK_FILE, next, 'utf8');
}

function writeBrandAuthList(list) {
  writeBrandAuthData(list, null);
}

module.exports = {
  MOCK_FILE: MOCK_FILE,
  loadBrandAuthList: loadBrandAuthList,
  loadBrandAuthAuditLogs: loadBrandAuthAuditLogs,
  writeBrandAuthList: writeBrandAuthList,
  writeBrandAuthData: writeBrandAuthData
};
