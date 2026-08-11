var InventoryTaskReportExport = (function () {
  var HEADERS = [
    '仓库指令单号', '所属组别', '客户编号', '仓库', '运德编码', '产品编号',
    '盘点仓位', '系统库存', '实物数量', '差异数量', '盘点结果', '盘点日期'
  ];

  function formatDateTime() {
    var d = new Date();
    var pad = function (value) { return String(value).padStart(2, '0'); };
    return d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate()) +
      pad(d.getHours()) + pad(d.getMinutes()) + pad(d.getSeconds());
  }

  function exportTasks(rows) {
    if (typeof XLSX === 'undefined') {
      throw new Error('未加载 Excel 组件，请刷新页面后重试');
    }

    var data = [HEADERS];
    (rows || []).forEach(function (row) {
      var instruction = row.instruction;
      var task = row.task || {};
      (task.items || []).forEach(function (item) {
        var completed = item.lineStatus === '已盘';
        var differenceQty = completed ? Number(item.differenceQty) : null;
        data.push([
          instruction.instructionNo || '',
          instruction.groupNo || '',
          instruction.customerCode || '',
          task.warehouseName || task.warehouseCode || '',
          item.skuCode || '',
          item.productName || '',
          item.locationCode || '',
          item.expectedQty === undefined ? '' : item.expectedQty,
          completed ? item.countedQty : '',
          completed ? item.differenceQty : '',
          completed ? (differenceQty === 0 ? '无差异' : '有差异') : '',
          completed ? (item.countedAt || '') : ''
        ]);
      });
    });

    if (data.length === 1) {
      throw new Error('当前筛选结果暂无可导出的仓位盘点任务');
    }

    var sheet = XLSX.utils.aoa_to_sheet(data);
    sheet['!cols'] = [
      { wch: 22 }, { wch: 18 }, { wch: 16 }, { wch: 18 }, { wch: 20 }, { wch: 22 },
      { wch: 18 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 20 }
    ];
    var workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, sheet, '盘点任务表');
    XLSX.writeFile(workbook, '指令盘点报告_' + formatDateTime() + '.xlsx');
  }

  return { exportTasks: exportTasks };
})();