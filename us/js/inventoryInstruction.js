(function () {
  var C = InventoryInstructionCommon;
  var MY_WH = 'US-LA';
  var selectedInstructionIds = {};

  function e(s) {
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

  function skuStatus(task, skuCode) {
    var noStock = (task.noStockSkus || []).some(function (sku) { return sku.skuCode === skuCode; });
    var items = (task.items || []).filter(function (item) { return item.skuCode === skuCode; });
    if (noStock || (items.length && items.every(function (item) { return item.lineStatus === '已盘'; }))) return '已完成';
    if (items.some(function (item) { return item.lineStatus === '盘点中'; })) return '盘点中';
    return '待盘点';
  }

  function skuHasAutoLocation(task, skuCode) {
    return (task.items || []).some(function (item) {
      return item.skuCode === skuCode && /^A/i.test(item.locationCode || '');
    });
  }

  function selectedRows() {
    return C.executableInstructions(C.getList()).map(function (instruction) {
      return { instruction: instruction, task: C.findWarehouseTask(instruction, MY_WH) };
    }).filter(function (row) { return row.task && selectedInstructionIds[row.instruction.id]; });
  }

  function selectedCount() {
    return selectedRows().length;
  }

  function syncSelectionUI() {
    var checks = Array.prototype.slice.call(document.querySelectorAll('.ii-row-check'));
    var count = selectedCount();
    var checkAll = document.getElementById('checkAll');
    checkAll.checked = checks.length > 0 && checks.every(function (check) { return check.checked; });
    checkAll.indeterminate = checks.some(function (check) { return check.checked; }) && !checkAll.checked;
    document.getElementById('btnInventoryList').disabled = !count;
    document.getElementById('btnInventoryList').textContent = count ? '盘点清单（' + count + '）' : '盘点清单';
  }

  function skuStatusText(task, skuCode) {
    var status = skuStatus(task, skuCode);
    return status === '已完成' ? 'Done' : (status === '盘点中' ? 'In progress' : 'Pending');
  }

  var CODE39 = {
    '0': 'nnnwwnwnn', '1': 'wnnwnnnnw', '2': 'nnwwnnnnw', '3': 'wnwwnnnnn',
    '4': 'nnnwwnnnw', '5': 'wnnwwnnnn', '6': 'nnwwwnnnn', '7': 'nnnwnnwnw',
    '8': 'wnnwnnwnn', '9': 'nnwwnnwnn', 'A': 'wnnnnwnnw', 'B': 'nnwnnwnnw',
    'C': 'wnwnnwnnn', 'D': 'nnnnwwnnw', 'E': 'wnnnwwnnn', 'F': 'nnwnwwnnn',
    'G': 'nnnnnwwnw', 'H': 'wnnnnwwnn', 'I': 'nnwnnwwnn', 'J': 'nnnnwwwnn',
    'K': 'wnnnnnnww', 'L': 'nnwnnnnww', 'M': 'wnwnnnnwn', 'N': 'nnnnwnnww',
    'O': 'wnnnwnnwn', 'P': 'nnwnwnnwn', 'Q': 'nnnnnnwww', 'R': 'wnnnnnwwn',
    'S': 'nnwnnnwwn', 'T': 'nnnnwnwwn', 'U': 'wwnnnnnnw', 'V': 'nwwnnnnnw',
    'W': 'wwwnnnnnn', 'X': 'nwnnwnnnw', 'Y': 'wwnnwnnnn', 'Z': 'nwwnwnnnn',
    '-': 'nwnnnnwnw', '*': 'nwnnwnwnn'
  };

  function pdfEscape(text) { return String(text).replace(/([\\()])/g, '\\$1'); }
  function pdfText(text, x, y, size, center) {
    var offset = center ? String(text).length * size * 0.25 : 0;
    return 'BT /F1 ' + size + ' Tf ' + (x - offset).toFixed(2) + ' ' + y.toFixed(2) + ' Td (' + pdfEscape(text) + ') Tj ET\n';
  }
  function pdfLine(x1, y1, x2, y2) { return x1 + ' ' + y1 + ' m ' + x2 + ' ' + y2 + ' l S\n'; }
  function barcodePdf(value, x, y, width) {
    var text = '*' + String(value).toUpperCase().replace(/[^0-9A-Z-]/g, '-') + '*';
    var units = 0;
    text.split('').forEach(function (character) {
      (CODE39[character] || CODE39['-']).split('').forEach(function (part) { units += part === 'w' ? 3 : 1; });
      units += 1;
    });
    var unit = width / units;
    var cursor = x;
    var command = '0 g\n';
    text.split('').forEach(function (character) {
      (CODE39[character] || CODE39['-']).split('').forEach(function (part, index) {
        var barWidth = unit * (part === 'w' ? 3 : 1);
        if (index % 2 === 0) command += cursor.toFixed(2) + ' ' + y.toFixed(2) + ' ' + barWidth.toFixed(2) + ' 27 re f\n';
        cursor += barWidth;
      });
      cursor += unit;
    });
    return command + pdfText(value, x + width / 2, y - 8, 7, true);
  }

  function drawChecklistCard(card, x, top) {
    var width = 230, height = 205, labelWidth = 58, rowHeight = height / 4;
    var bottom = 595 - top - height;
    var stream = '0 G 0.6 w\n' + x + ' ' + bottom + ' ' + width + ' ' + height + ' re S\n';
    stream += pdfLine(x + labelWidth, bottom, x + labelWidth, bottom + height);
    for (var row = 1; row < 4; row++) stream += pdfLine(x, bottom + row * rowHeight, x + width, bottom + row * rowHeight);
    ['Order', 'SKU', 'Auto BOX?', 'Status'].forEach(function (label, index) {
      stream += pdfText(label, x + labelWidth / 2, bottom + height - rowHeight * index - rowHeight / 2 - 3, 9, true);
    });
    stream += barcodePdf(card.instructionNo, x + labelWidth + 14, bottom + height - rowHeight + 12, width - labelWidth - 28);
    stream += barcodePdf(card.skuCode, x + labelWidth + 14, bottom + height - rowHeight * 2 + 12, width - labelWidth - 28);
    stream += pdfText(card.autoWarehouse ? '[x]' : '[ ]', x + labelWidth + (width - labelWidth) / 2, bottom + height - rowHeight * 2.5 - 4, 14, true);
    return stream + pdfText(card.status, x + labelWidth + (width - labelWidth) / 2, bottom + height - rowHeight * 3.5 - 3, 9, true);
  }

  function downloadPdf(pages) {
    var objects = ['<< /Type /Catalog /Pages 2 0 R >>', ''];
    var pageIds = [], contentIds = [];
    pages.forEach(function (content) {
      pageIds.push(objects.length + 1);
      objects.push('');
      contentIds.push(objects.length + 1);
      objects.push('<< /Length ' + content.length + ' >>\nstream\n' + content + 'endstream');
    });
    objects[1] = '<< /Type /Pages /Kids [' + pageIds.map(function (id) { return id + ' 0 R'; }).join(' ') + '] /Count ' + pageIds.length + ' >>';
    pageIds.forEach(function (pageId, index) {
      objects[pageId - 1] = '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 842 595] /Resources << /Font << /F1 ' + (objects.length + 1) + ' 0 R >> >> /Contents ' + contentIds[index] + ' 0 R >>';
    });
    objects.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
    var pdf = '%PDF-1.4\n';
    var offsets = [0];
    objects.forEach(function (object, index) { offsets.push(pdf.length); pdf += (index + 1) + ' 0 obj\n' + object + '\nendobj\n'; });
    var xref = pdf.length;
    pdf += 'xref\n0 ' + (objects.length + 1) + '\n0000000000 65535 f \n';
    offsets.slice(1).forEach(function (offset) { pdf += String(offset).padStart(10, '0') + ' 00000 n \n'; });
    pdf += 'trailer\n<< /Size ' + (objects.length + 1) + ' /Root 1 0 R >>\nstartxref\n' + xref + '\n%%EOF';
    var link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([pdf], { type: 'application/pdf' }));
    link.download = 'inventory-checklist-' + new Date().toISOString().slice(0, 10).replace(/-/g, '') + '.pdf';
    link.click();
    setTimeout(function () { URL.revokeObjectURL(link.href); }, 1000);
  }

  function buildInventoryPdf(rows) {
    var cards = [];
    rows.forEach(function (row) {
      var requestedSkus = row.task.requestedSkus || row.instruction.requestedSkus || [];
      requestedSkus.forEach(function (sku) {
        cards.push({
          instructionNo: row.instruction.instructionNo,
          skuCode: sku.skuCode,
          autoWarehouse: skuHasAutoLocation(row.task, sku.skuCode),
          status: skuStatusText(row.task, sku.skuCode)
        });
      });
    });
    var positions = [{ x: 35, top: 48 }, { x: 306, top: 48 }, { x: 577, top: 48 }, { x: 35, top: 310 }, { x: 306, top: 310 }, { x: 577, top: 310 }];
    var pages = [];
    cards.forEach(function (card, index) {
      var pageIndex = Math.floor(index / positions.length);
      if (!pages[pageIndex]) pages[pageIndex] = '';
      var position = positions[index % positions.length];
      pages[pageIndex] += drawChecklistCard(card, position.x, position.top);
    });
    downloadPdf(pages);
  }

  function openInventoryList() {
    var rows = selectedRows();
    if (!rows.length) { alert('请至少选择一条指令单'); return; }
    var button = document.getElementById('btnInventoryList');
    button.disabled = true;
    button.textContent = '正在生成 PDF…';
    try {
      buildInventoryPdf(rows);
    } catch (err) {
      alert('PDF 生成失败，请重试');
    }
    button.disabled = false;
    syncSelectionUI();
  }

  function skuProgress(instruction, task) {
    var requestedSkus = task.requestedSkus || instruction.requestedSkus || [];
    var itemsBySku = {};
    var autoCompleted = {};
    (task.items || []).forEach(function (item) {
      (itemsBySku[item.skuCode] || (itemsBySku[item.skuCode] = [])).push(item);
    });
    (task.autoCompletedSkus || []).forEach(function (item) { autoCompleted[item.skuCode] = true; });
    var completedCount = requestedSkus.filter(function (sku) {
      var items = itemsBySku[sku.skuCode] || [];
      return autoCompleted[sku.skuCode] || (items.length && items.every(function (item) { return item.lineStatus === '已盘'; }));
    }).length;
    return { completed: completedCount, total: requestedSkus.length };
  }

  function render() {
    var st = document.getElementById('qStatus').value;
    var rows = [];
    C.executableInstructions(C.getList()).forEach(function (instruction) {
      var task = C.findWarehouseTask(instruction, MY_WH);
      if (task && (!st || C.normalizedStatus(task.status) === st)) {
        rows.push({ instruction: instruction, task: task });
      }
    });
    rows.sort(function (a, b) { return issuedAt(b.instruction).localeCompare(issuedAt(a.instruction)); });

    document.getElementById('empty').style.display = rows.length ? 'none' : '';
    document.getElementById('taskBody').innerHTML = rows.map(function (row, index) {
      var progress = skuProgress(row.instruction, row.task);
      var taskStatus = C.normalizedStatus(row.task.status);
      var checked = selectedInstructionIds[row.instruction.id] ? ' checked' : '';
      return '<tr><td class="ii-select-col"><input type="checkbox" class="ii-row-check" data-id="' + e(row.instruction.id) + '"' + checked + '></td><td>' + e(row.instruction.instructionNo) + '</td><td><span class="ii-priority ii-priority-' + priority(index) + '">' +
        priority(index) + '</span></td><td>' + e(row.instruction.customerCode || '-') +
        '</td><td>' + progress.completed + ' / ' + progress.total + '</td><td>' +
        e(issuedAt(row.instruction) || '-') + '</td><td><span class="ii-status ii-status-' +
        e(taskStatus) + '">' + e(taskStatus) + '</span></td><td><a class="btn btn-small" href="inventoryInstructionDetail.html?instructionId=' +
        encodeURIComponent(row.instruction.id) + '&warehouseCode=' + encodeURIComponent(MY_WH) + '">查看详情</a> ' +
        (taskStatus !== '已完成' && taskStatus !== '已废弃' ?
          '<a class="btn btn-small btn-info" href="pda-inventory-claim.html?taskId=' + encodeURIComponent(row.instruction.id) +
          '&wh=' + encodeURIComponent(MY_WH) + '">PDA认领盘点</a>' : '') + '</td></tr>';
    }).join('');
    document.querySelectorAll('.ii-row-check').forEach(function (check) {
      check.onchange = function () {
        var id = check.getAttribute('data-id');
        if (check.checked) selectedInstructionIds[id] = true;
        else delete selectedInstructionIds[id];
        syncSelectionUI();
      };
    });
    syncSelectionUI();
  }

  function init() {
    document.getElementById('btnQuery').onclick = function () {
      selectedInstructionIds = {};
      render();
    };
    document.getElementById('checkAll').onchange = function () {
      document.querySelectorAll('.ii-row-check').forEach(function (check) {
        check.checked = document.getElementById('checkAll').checked;
        if (check.checked) selectedInstructionIds[check.getAttribute('data-id')] = true;
        else delete selectedInstructionIds[check.getAttribute('data-id')];
      });
      syncSelectionUI();
    };
    document.getElementById('btnInventoryList').onclick = openInventoryList;
    C.load(function (err) {
      if (err) alert(err.message);
      render();
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();