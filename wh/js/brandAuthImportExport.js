/**
 * 品牌授权 · 批量导入/导出/失败报告（依赖全局 XLSX）
 */
var BrandAuthImportExport = (function () {
  var MAX_ROWS = 500;
  var HEADERS = ['品牌代号', '客户编码', '品牌名称', '授权书文件', '授权有效期', '备注'];

  var HEADER_ALIASES = {
    '品牌代号': 'brandCode',
    '客户编码': 'customerCode',
    '品牌名称': 'brandName',
    '授权书文件': 'authFilesRaw',
    '授权有效期': 'expireDate',
    '备注': 'remark'
  };

  function pad(n) {
    return String(n).padStart(2, '0');
  }

  function formatDateTime(d) {
    var dt = d || new Date();
    return dt.getFullYear() + '-' + pad(dt.getMonth() + 1) + '-' + pad(dt.getDate()) +
      ' ' + pad(dt.getHours()) + ':' + pad(dt.getMinutes()) + ':' + pad(dt.getSeconds());
  }

  function formatReportFileName() {
    var d = new Date();
    return '品牌授权导入失败报告_' + d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate()) +
      '_' + pad(d.getHours()) + pad(d.getMinutes()) + pad(d.getSeconds()) + '.xlsx';
  }

  function norm(s) {
    return String(s == null ? '' : s).trim().toLowerCase();
  }

  function uniqueKey(customerCode, brandName) {
    return norm(customerCode) + '\x01' + norm(brandName);
  }

  function isValidBrandCodeFormat(code) {
    return /^BA\d{4}$/i.test(String(code || '').trim());
  }

  function isValidExpireDate(value) {
    var v = String(value || '').trim();
    if (!v) return true;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
    var d = new Date(v + 'T00:00:00');
    return !isNaN(d.getTime());
  }

  function parseAuthFileUrls(raw) {
    var text = String(raw || '').trim();
    if (!text) return [];
    return text.split(/[;；\n]/).map(function (s) { return s.trim(); }).filter(Boolean);
  }

  function validateAuthFileUrls(raw) {
    var urls = parseAuthFileUrls(raw);
    for (var i = 0; i < urls.length; i++) {
      if (!/^https?:\/\//i.test(urls[i])) return urls[i];
    }
    return '';
  }

  function authFilesFromRaw(raw, uploadedAt) {
    return parseAuthFileUrls(raw).map(function (url) {
      var fileName = url.split('/').pop().split('?')[0] || url;
      return {
        fileName: fileName,
        url: url,
        uploadedAt: uploadedAt || formatDateTime()
      };
    });
  }

  function authFilesToExportCell(row) {
    var files = Array.isArray(row.authFiles) ? row.authFiles : [];
    if (!files.length) return '';
    return files.map(function (f) { return f.url || f.fileName || ''; }).filter(Boolean).join(';');
  }

  function findByBrandCode(list, brandCode) {
    var code = String(brandCode || '').trim().toUpperCase();
    if (!code) return null;
    for (var i = 0; i < list.length; i++) {
      if (String(list[i].brandCode || '').trim().toUpperCase() === code) return list[i];
    }
    return null;
  }

  function findByUniqueKey(list, customerCode, brandName, excludeId) {
    var key = uniqueKey(customerCode, brandName);
    for (var i = 0; i < list.length; i++) {
      var row = list[i];
      if (excludeId && row.id === excludeId) continue;
      if (uniqueKey(row.customerCode, row.brandName) === key) return row;
    }
    return null;
  }

  function ensureXlsx() {
    if (typeof XLSX === 'undefined') {
      throw new Error('未加载 Excel 组件，请刷新页面后重试');
    }
  }

  function sheetToRows(sheet) {
    return XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
  }

  function parseImportWorkbook(arrayBuffer) {
    ensureXlsx();
    var wb = XLSX.read(arrayBuffer, { type: 'array' });
    var sheetName = wb.SheetNames[0];
    if (!sheetName) {
      return { error: { type: 'FILE_PARSE_ERROR', message: '导入文件无有效工作表' } };
    }
    var matrix = sheetToRows(wb.Sheets[sheetName]);
    if (!matrix.length) {
      return { error: { type: 'FILE_PARSE_ERROR', message: '导入文件无数据' } };
    }
    var headerRow = matrix[0].map(function (c) { return String(c || '').trim(); });
    var colMap = {};
    headerRow.forEach(function (title, idx) {
      if (HEADER_ALIASES[title]) colMap[HEADER_ALIASES[title]] = idx;
    });
    if (colMap.customerCode == null || colMap.brandName == null) {
      return { error: { type: 'FILE_PARSE_ERROR', message: '缺少必填列「客户编码」或「品牌名称」' } };
    }
    var rows = [];
    for (var r = 1; r < matrix.length; r++) {
      var line = matrix[r];
      var empty = !line || line.every(function (cell) { return String(cell || '').trim() === ''; });
      if (empty) continue;
      rows.push({
        rowNum: r + 1,
        brandCode: colMap.brandCode != null ? String(line[colMap.brandCode] || '').trim() : '',
        customerCode: String(line[colMap.customerCode] || '').trim(),
        brandName: String(line[colMap.brandName] || '').trim(),
        authFilesRaw: colMap.authFilesRaw != null ? String(line[colMap.authFilesRaw] || '').trim() : '',
        expireDate: colMap.expireDate != null ? String(line[colMap.expireDate] || '').trim() : '',
        remark: colMap.remark != null ? String(line[colMap.remark] || '').trim() : ''
      });
    }
    if (!rows.length) {
      return { error: { type: 'FILE_PARSE_ERROR', message: '导入文件无数据行，请检查后重新上传' } };
    }
    if (rows.length > MAX_ROWS) {
      return { error: { type: 'FILE_PARSE_ERROR', message: '单次导入不能超过 ' + MAX_ROWS + ' 行，请分批导入' } };
    }
    return { rows: rows };
  }

  function pushError(errors, row, type, message) {
    errors.push({
      rowNum: row.rowNum,
      action: row.action || (row.brandCode ? '编辑' : '新增'),
      brandCode: row.brandCode,
      customerCode: row.customerCode,
      brandName: row.brandName,
      authFilesRaw: row.authFilesRaw || '',
      expireDate: row.expireDate,
      remark: row.remark,
      type: type,
      message: message
    });
  }

  function groupErrorsByRow(errors) {
    var map = {};
    errors.forEach(function (err) {
      var key = String(err.rowNum);
      if (!map[key]) {
        map[key] = Object.assign({}, err, { types: [err.type], messages: [err.message] });
      } else {
        map[key].types.push(err.type);
        map[key].messages.push(err.message);
        map[key].type = map[key].types.join(';');
        map[key].message = map[key].messages.join('；');
      }
    });
    return Object.keys(map).map(function (k) { return map[k]; });
  }

  function validateImportRows(rows, existingList) {
    var errors = [];
    var list = existingList || [];
    var newKeyFirstRow = {};
    var editCodeFirstRow = {};

    rows.forEach(function (row) {
      row.action = row.brandCode ? '编辑' : '新增';

      if (row.brandCode) {
        if (!isValidBrandCodeFormat(row.brandCode)) {
          pushError(errors, row, 'BRAND_CODE_FORMAT',
            '品牌代号「' + row.brandCode + '」格式不正确，应为 BA+4 位数字，如 BA0001');
        } else if (!findByBrandCode(list, row.brandCode)) {
          pushError(errors, row, 'BRAND_CODE_NOT_FOUND',
            '品牌代号「' + row.brandCode + '」不存在，请核对后重试');
        }
        var codeKey = String(row.brandCode).trim().toUpperCase();
        if (editCodeFirstRow[codeKey] && editCodeFirstRow[codeKey] !== row.rowNum) {
          pushError(errors, row, 'DUPLICATE_IN_FILE',
            '与第 ' + editCodeFirstRow[codeKey] + ' 行重复：品牌代号「' + row.brandCode + '」');
        } else {
          editCodeFirstRow[codeKey] = row.rowNum;
        }
      } else {
        if (!row.customerCode) {
          pushError(errors, row, 'REQUIRED_CUSTOMER', '第 ' + row.rowNum + ' 行：客户编码不能为空');
        }
        if (!row.brandName) {
          pushError(errors, row, 'REQUIRED_BRAND_NAME', '第 ' + row.rowNum + ' 行：品牌名称不能为空');
        }
      }

      if (row.expireDate && !isValidExpireDate(row.expireDate)) {
        pushError(errors, row, 'EXPIRE_DATE_FORMAT',
          '授权有效期「' + row.expireDate + '」格式不正确，请使用 yyyy-MM-dd');
      }

      if (row.authFilesRaw) {
        var invalidUrl = validateAuthFileUrls(row.authFilesRaw);
        if (invalidUrl) {
          pushError(errors, row, 'AUTH_FILE_INVALID',
            '授权书文件「' + invalidUrl + '」无效，请填写可访问的 http(s) 链接或多个链接用分号分隔');
        }
      }

      if (!row.brandCode && row.customerCode && row.brandName) {
        var uKey = uniqueKey(row.customerCode, row.brandName);
        if (newKeyFirstRow[uKey] && newKeyFirstRow[uKey] !== row.rowNum) {
          pushError(errors, row, 'DUPLICATE_IN_FILE',
            '与第 ' + newKeyFirstRow[uKey] + ' 行重复：客户编码「' + row.customerCode + '」+ 品牌名称「' + row.brandName + '」');
        } else {
          newKeyFirstRow[uKey] = row.rowNum;
        }
        var dupDb = findByUniqueKey(list, row.customerCode, row.brandName);
        if (dupDb) {
          pushError(errors, row, 'DUPLICATE_IN_DB',
            '客户编码「' + row.customerCode + '」+ 品牌名称「' + row.brandName + '」已存在（品牌代号 ' + dupDb.brandCode + '）');
        }
      }

      if (row.brandCode && row.customerCode && row.brandName) {
        var existing = findByBrandCode(list, row.brandCode);
        if (existing) {
          var conflict = findByUniqueKey(list, row.customerCode, row.brandName, existing.id);
          if (conflict) {
            pushError(errors, row, 'UNIQUE_VIOLATION_ON_EDIT',
              '修改后将与品牌代号「' + conflict.brandCode + '」重复：客户编码「' + row.customerCode + '」+ 品牌名称「' + row.brandName + '」');
          }
        }
      }
    });

    var grouped = groupErrorsByRow(errors);
    return {
      ok: grouped.length === 0,
      errors: grouped,
      errorCount: grouped.length,
      total: rows.length
    };
  }

  function applyImportRows(rows, existingList, helpers) {
    var h = helpers || {};
    var working = JSON.parse(JSON.stringify(existingList || []));
    var now = formatDateTime();
    var insertCount = 0;
    var updateCount = 0;

    rows.forEach(function (row) {
      if (row.brandCode) {
        for (var i = 0; i < working.length; i++) {
          if (String(working[i].brandCode || '').trim().toUpperCase() !== String(row.brandCode).trim().toUpperCase()) continue;
          var old = JSON.parse(JSON.stringify(working[i]));
          working[i].customerCode = row.customerCode || working[i].customerCode;
          working[i].brandName = row.brandName || working[i].brandName;
          working[i].expireDate = row.expireDate || '';
          working[i].remark = row.remark || '';
          if (row.authFilesRaw) {
            working[i].authFiles = authFilesFromRaw(row.authFilesRaw, now);
          }
          working[i].updateTime = now;
          if (typeof h.buildUpdateChanges === 'function' && typeof h.appendOperationLog === 'function') {
            var changes = h.buildUpdateChanges(old, working[i]);
            if (changes.length) h.appendOperationLog(working[i], '编辑', changes);
          }
          updateCount++;
          break;
        }
      } else {
        var created = {
          id: typeof h.genId === 'function' ? h.genId() : ('brand-auth-' + Date.now()),
          brandCode: typeof h.nextBrandCode === 'function' ? h.nextBrandCode(working) : '',
          customerCode: row.customerCode,
          brandName: row.brandName,
          expireDate: row.expireDate || '',
          remark: row.remark || '',
          authorizedProducts: [],
          authFiles: authFilesFromRaw(row.authFilesRaw, now),
          operationLogs: [],
          createTime: now,
          updateTime: now
        };
        if (typeof h.appendOperationLog === 'function' && typeof h.buildCreateChanges === 'function') {
          h.appendOperationLog(created, '新增', h.buildCreateChanges(created));
        }
        working.unshift(created);
        insertCount++;
      }
    });

    return {
      list: working,
      insertCount: insertCount,
      updateCount: updateCount,
      successCount: insertCount + updateCount
    };
  }

  function validateUniquePair(customerCode, brandName, excludeId, existingList) {
    var dup = findByUniqueKey(existingList || [], customerCode, brandName, excludeId);
    if (!dup) return '';
    return '客户编码「' + customerCode + '」+ 品牌名称「' + brandName + '」已存在，请更换或使用编辑导入';
  }

  function downloadWorkbook(wb, filename) {
    ensureXlsx();
    XLSX.writeFile(wb, filename);
  }

  function exportRows(rows, filename) {
    ensureXlsx();
    var data = [HEADERS];
    (rows || []).forEach(function (row) {
      data.push([
        row.brandCode || '',
        row.customerCode || '',
        row.brandName || '',
        authFilesToExportCell(row),
        row.expireDate || '',
        row.remark || ''
      ]);
    });
    var ws = XLSX.utils.aoa_to_sheet(data);
    var wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '品牌授权');
    downloadWorkbook(wb, filename || ('品牌授权导出_' + formatDateTime().replace(/[: ]/g, '').slice(0, 15) + '.xlsx'));
  }

  function downloadTemplate() {
    ensureXlsx();
    var ws = XLSX.utils.aoa_to_sheet([
      HEADERS,
      ['', 'CN0000438', 'NIKE', 'https://example.com/auth.pdf', '2026-12-31', '示例备注'],
      ['BA0001', 'CN0000438', 'NIKE', '', '2026-12-31', '']
    ]);
    var wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '导入模板');
    var tip = XLSX.utils.aoa_to_sheet([
      ['说明'],
      ['品牌代号为空视为新增；非空视为编辑'],
      ['任一行有误则整批不导入'],
      ['授权书文件可填多个 http(s) 链接，用分号分隔；编辑行留空表示不更新授权书'],
      ['客户编码+品牌名称组合不可重复']
    ]);
    XLSX.utils.book_append_sheet(wb, tip, '填写说明');
    downloadWorkbook(wb, '品牌授权导入模板.xlsx');
  }

  function buildFailureWorkbook(errors, summary) {
    ensureXlsx();
    var detailHeader = ['行号', '导入动作', '品牌代号', '客户编码', '品牌名称', '授权书文件', '授权有效期', '备注', '错误类型', '错误说明'];
    var detailRows = [detailHeader];
    (errors || []).forEach(function (err) {
      detailRows.push([
        err.rowNum,
        err.action || '',
        err.brandCode ? err.brandCode : '（空）',
        err.customerCode || '',
        err.brandName || '',
        err.authFilesRaw || '',
        err.expireDate || '',
        err.remark || '',
        err.type || '',
        err.message || ''
      ]);
    });
    var ws1 = XLSX.utils.aoa_to_sheet(detailRows);
    var ws2 = XLSX.utils.aoa_to_sheet([
      ['项', '值'],
      ['导入时间', summary.importTime || formatDateTime()],
      ['操作人', summary.operator || ''],
      ['文件名', summary.fileName || ''],
      ['总行数', summary.total || 0],
      ['错误行数', summary.errorCount || 0],
      ['导入结果', '失败，未写入任何数据']
    ]);
    var wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws1, '失败明细');
    XLSX.utils.book_append_sheet(wb, ws2, '导入摘要');
    return wb;
  }

  function downloadFailureReport(errors, summary) {
    downloadWorkbook(buildFailureWorkbook(errors, summary), formatReportFileName());
  }

  return {
    MAX_ROWS: MAX_ROWS,
    HEADERS: HEADERS,
    parseImportWorkbook: parseImportWorkbook,
    validateImportRows: validateImportRows,
    applyImportRows: applyImportRows,
    validateUniquePair: validateUniquePair,
    findByUniqueKey: findByUniqueKey,
    exportRows: exportRows,
    downloadTemplate: downloadTemplate,
    downloadFailureReport: downloadFailureReport,
    formatDateTime: formatDateTime
  };
})();
