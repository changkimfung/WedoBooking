/**
 * 读写 mock_data/inventoryInstruction.js 中的指令盘点任务。
 */
var fs = require('fs');
var path = require('path');
var vm = require('vm');

var MOCK_FILE = path.join(__dirname, '..', '..', 'mock_data', 'inventoryInstruction.js');
var STOCK_FILE = path.join(__dirname, '..', '..', 'mock_data', 'inventoryStock.js');
var LIST_MARKER = 'var MOCK_INVENTORY_INSTRUCTION_LIST = ';

function loadMockData() {
  var code = fs.readFileSync(MOCK_FILE, 'utf8');
  var sandbox = {};
  vm.runInNewContext(code, sandbox, { filename: MOCK_FILE });
  return sandbox;
}

function loadInventoryInstructionList() {
  return JSON.parse(JSON.stringify(loadMockData().MOCK_INVENTORY_INSTRUCTION_LIST || []));
}

function loadInventoryStockSnapshot() {
  var code = fs.readFileSync(STOCK_FILE, 'utf8');
  var sandbox = {};
  vm.runInNewContext(code, sandbox, { filename: STOCK_FILE });
  return JSON.parse(JSON.stringify(sandbox.MOCK_INVENTORY_STOCK_SNAPSHOT || []));
}

function formatString(value) {
  if (value === '') return "''";
  return "'" + String(value).replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'";
}

function formatValue(value, indent) {
  var pad = new Array(indent + 1).join('  ');
  if (value === null || value === undefined) return "''";
  if (typeof value === 'number') return String(value);
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'string') return formatString(value);
  if (Array.isArray(value)) {
    if (!value.length) return '[]';
    return '[\n' + value.map(function (item) {
      return pad + '  ' + formatValue(item, indent + 1);
    }).join(',\n') + '\n' + pad + ']';
  }
  return formatObject(value, indent);
}

function formatObject(obj, indent) {
  var pad = new Array(indent + 1).join('  ');
  return '{\n' + Object.keys(obj).map(function (key) {
    return pad + '  ' + key + ': ' + formatValue(obj[key], indent + 1);
  }).join(',\n') + '\n' + pad + '}';
}

function writeInventoryInstructionList(list) {
  var content = fs.readFileSync(MOCK_FILE, 'utf8');
  var startIdx = content.indexOf(LIST_MARKER);
  if (startIdx < 0) throw new Error('mock 文件结构异常，未找到指令盘点列表标记');
  var header = content.slice(0, startIdx + LIST_MARKER.length);
  var body = '[\n' + list.map(function (item) {
    return '  ' + formatObject(item, 1);
  }).join(',\n') + '\n];\n';
  fs.writeFileSync(MOCK_FILE, header + body, 'utf8');
}

module.exports = {
  loadInventoryInstructionList: loadInventoryInstructionList,
  loadInventoryStockSnapshot: loadInventoryStockSnapshot,
  writeInventoryInstructionList: writeInventoryInstructionList
};
