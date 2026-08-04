/**
 * 读取 mock_data/inOrder.js 中的 MOCK_IN_ORDER_LIST
 */
var fs = require('fs');
var path = require('path');
var vm = require('vm');

var MOCK_FILE = path.join(__dirname, '..', '..', 'mock_data', 'inOrder.js');

function loadInOrderList() {
  var code = fs.readFileSync(MOCK_FILE, 'utf8');
  var sandbox = {};
  vm.runInNewContext(code, sandbox, { filename: MOCK_FILE });
  return JSON.parse(JSON.stringify(sandbox.MOCK_IN_ORDER_LIST || []));
}

module.exports = {
  MOCK_FILE: MOCK_FILE,
  loadInOrderList: loadInOrderList
};
