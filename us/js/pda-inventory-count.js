(function () {
  var C = InventoryInstructionCommon;
  var MY_WH = new URLSearchParams(location.search).get('wh') || 'US-LA';

  function $(id) { return document.getElementById(id); }
  function esc(s) {
    var d = document.createElement('div');
    d.textContent = s == null ? '' : s;
    return d.innerHTML;
  }
  function issuedAt(instruction) {
    return instruction.initiatedAt || instruction.createdAt || '';
  }
  function priority(index) {
    return index === 0 ? '新' : '旧';
  }
  function statusClass(status) {
    return status === '已完成' ? 'pda-claim-done' :
      (status === '已废弃' ? 'pda-claim-locked' : 'pda-claim-pending');
  }
  function activeClaim() {
    var rows = C.executableInstructions(C.getList()).map(function (instruction) {
      return { instruction: instruction, task: C.findWarehouseTask(instruction, MY_WH) };
    }).filter(function (row) { return row.task; });
    for (var i = 0; i < rows.length; i++) {
      var item = (rows[i].task.items || []).filter(function (line) {
        return line.lineStatus === '盘点中' && line.claimedBy === 'PDA操作员';
      })[0];
      if (item) return { instruction: rows[i].instruction, skuCode: item.skuCode };
    }
    return null;
  }
  function showResumeModal(claim) {
    if (!claim) return;
    $('resumeModalText').textContent = '检测到未主动退出或未完成的指令盘点任务：' + claim.instruction.instructionNo + '，料号：' + claim.skuCode + '。请继续完成或在盘点页面退出后释放任务。';
    $('btnResumeInventory').onclick = function () {
      location.href = 'pda-inventory-location.html?taskId=' + encodeURIComponent(claim.instruction.id) +
        '&wh=' + encodeURIComponent(MY_WH) + '&sku=' + encodeURIComponent(claim.skuCode) + '&operator=PDA操作员';
    };
    $('resumeModal').classList.remove('pda-hidden');
    $('resumeModal').setAttribute('aria-hidden', 'false');
  }
  function render() {
    var rows = C.executableInstructions(C.getList()).map(function (instruction) {
      return { instruction: instruction, task: C.findWarehouseTask(instruction, MY_WH) };
    }).filter(function (row) { return row.task; });
    rows.sort(function (a, b) { return issuedAt(b.instruction).localeCompare(issuedAt(a.instruction)); });

    $('taskStatus').textContent = rows.length ? '' : '暂无本仓指令盘点任务';
    $('taskList').innerHTML = rows.map(function (row, index) {
      var status = C.normalizedStatus(row.task.status);
      var unavailable = status === '已完成' || status === '已废弃';
      var level = priority(index);
      return '<button type="button" class="pda-instruction-card' + (unavailable ? ' pda-instruction-card-disabled' : '') +
        '" data-id="' + esc(row.instruction.id) + '"' + (unavailable ? ' disabled' : '') + '>' +
        '<strong>' + esc(row.instruction.instructionNo) + '</strong>' +
        '<span class="pda-priority pda-priority-' + level + '">优先级：' + level + '</span>' +
        '<span class="pda-claim-badge ' + statusClass(status) + '">' + esc(status) + '</span>' +
        '</button>';
    }).join('');
    document.querySelectorAll('.pda-instruction-card:not([disabled])').forEach(function (button) {
      button.onclick = function () {
        location.href = 'pda-inventory-claim.html?taskId=' + encodeURIComponent(button.getAttribute('data-id')) +
          '&wh=' + encodeURIComponent(MY_WH);
      };
    });
  }
  function init() {
    C.load(function (err) {
      if (err) {
        $('taskStatus').textContent = err.message;
        return;
      }
      render();
      showResumeModal(activeClaim());
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();