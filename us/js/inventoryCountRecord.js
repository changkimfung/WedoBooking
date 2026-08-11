(function () {
  var API = '/api/mock/inventory-count-record';
  var MY_WH = 'US-LA';
  var params = new URLSearchParams(location.search);

  function e(value) {
    var div = document.createElement('div');
    div.textContent = value == null ? '' : value;
    return div.innerHTML;
  }

  function statusClass(status) {
    return status === '通过' ? 'ii-status-已完成' :
      (status === '不通过' ? 'ii-status-已废弃' : 'ii-status-待盘点');
  }

  function render(list) {
    var instructionNo = document.getElementById('qInstructionNo').value.trim().toLowerCase();
    var sku = document.getElementById('qSku').value.trim().toLowerCase();
    var location = document.getElementById('qLocation').value.trim().toLowerCase();
    var status = document.getElementById('qStatus').value;
    var rows = list.filter(function (record) {
      return record.warehouseCode === MY_WH &&
        (!instructionNo || String(record.instructionNo).toLowerCase().indexOf(instructionNo) >= 0) &&
        (!sku || String(record.skuCode).toLowerCase().indexOf(sku) >= 0) &&
        (!location || String(record.locationCode).toLowerCase().indexOf(location) >= 0) &&
        (!status || record.status === status);
    }).sort(function (a, b) {
      return String(b.countedAt || '').localeCompare(String(a.countedAt || ''));
    });

    document.getElementById('resultHint').textContent = '共 ' + rows.length + ' 条盘点记录';
    document.getElementById('empty').style.display = rows.length ? 'none' : '';
    document.getElementById('recordBody').innerHTML = rows.map(function (record) {
      var differenceClass = Number(record.differenceQty) === 0 ? 'ii-record-balance' : 'ii-record-difference';
      return '<tr><td>' + e(record.skuCode) + '</td><td>' + e(record.beforeQty) +
        '</td><td>' + e(record.countedQty) + '</td><td class="' + differenceClass + '">' +
        e(record.differenceQty) + '</td><td>' + e(record.locationCode) + '</td><td>' +
        e(record.operator) + '</td><td>' + e(record.inventoryReason) + '</td><td>' +
        e(record.countedAt) + '</td><td>' + e(record.auditedAt || '-') + '</td><td>' +
        e(record.auditor || '-') + '</td><td><span class="ii-status ' + statusClass(record.status) + '">' +
        e(record.status) + '</span></td><td>' + e(record.remark) + '</td></tr>';
    }).join('');
  }

  function init() {
    document.getElementById('qInstructionNo').value = params.get('instructionNo') || '';
    document.getElementById('qSku').value = params.get('sku') || '';
    document.getElementById('btnQuery').onclick = function () { load(); };
    load();
  }

  function load() {
    fetch(API).then(function (res) {
      return res.json().then(function (body) {
        if (!res.ok) throw new Error(body.error || '读取盘点管理记录失败');
        render(body.list || []);
      });
    }).catch(function (err) {
      document.getElementById('resultHint').textContent = err.message;
      document.getElementById('recordBody').innerHTML = '';
      document.getElementById('empty').style.display = '';
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
