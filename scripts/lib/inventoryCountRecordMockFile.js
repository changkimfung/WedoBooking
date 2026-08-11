/** 读写 mock_data/inventoryCountRecord.js 中的海外仓盘点管理记录。 */
var fs = require('fs');
var path = require('path');
var vm = require('vm');

var MOCK_FILE = path.join(__dirname, '..', '..', 'mock_data', 'inventoryCountRecord.js');
var LIST_MARKER = 'var MOCK_INVENTORY_COUNT_RECORD_LIST = ';

function loadInventoryCountRecordList() {
  var code = fs.readFileSync(MOCK_FILE, 'utf8');
  var sandbox = {};
  vm.runInNewContext(code, sandbox, { filename: MOCK_FILE });
  return JSON.parse(JSON.stringify(sandbox.MOCK_INVENTORY_COUNT_RECORD_LIST || []));
}

function formatValue(value, indent) {
  var pad = new Array(indent + 1).join('  ');
  if (value === null || value === undefined) return "''";
  if (typeof value === 'number') return String(value);
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'string') return "'" + value.replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'";
  if (Array.isArray(value)) return '[' + value.map(function (item) { return formatValue(item, indent); }).join(', ') + ']';
  return '{\n' + Object.keys(value).map(function (key) {
    return pad + '  ' + key + ': ' + formatValue(value[key], indent + 1);
  }).join(',\n') + '\n' + pad + '}';
}

function writeInventoryCountRecordList(list) {
  var content = fs.readFileSync(MOCK_FILE, 'utf8');
  var startIndex = content.indexOf(LIST_MARKER);
  if (startIndex < 0) throw new Error('mock 文件结构异常，未找到盘点管理记录列表标记');
  var header = content.slice(0, startIndex + LIST_MARKER.length);
  var body = '[\n' + list.map(function (record) {
    return '  ' + formatValue(record, 1);
  }).join(',\n') + '\n];\n';
  fs.writeFileSync(MOCK_FILE, header + body, 'utf8');
}

module.exports = {
  loadInventoryCountRecordList: loadInventoryCountRecordList,
  writeInventoryCountRecordList: writeInventoryCountRecordList
};
