/**
 * 仓储中台 · 品牌授权文件管理
 */
(function () {
  var PAGE_SIZE = 20;
  var API_PATH = '/api/mock/brand-authorization';

  var currentPage = 1;
  var raw = typeof MOCK_BRAND_AUTH_LIST !== 'undefined' ? MOCK_BRAND_AUTH_LIST : [];
  var list = JSON.parse(JSON.stringify(raw));
  var selectedIds = {};
  var modalMode = 'add';
  var modalRows = [];
  var auditLogs = [];
  var OPERATOR = '演示用户';
  var productModalItems = [];
  var lastImportFailure = null;
  var pendingImportFile = null;
  var fileListModalRecordId = null;

  function val(id) {
    var el = document.getElementById(id);
    return el ? el.value : '';
  }

  function norm(s) {
    return String(s == null ? '' : s).trim().toLowerCase();
  }

  function includesNormalized(text, keyword) {
    var k = norm(keyword);
    if (!k) return true;
    return norm(text).indexOf(k) !== -1;
  }

  function escapeHtml(s) {
    if (s == null || s === '') return '';
    var div = document.createElement('div');
    div.textContent = s;
    return div.innerHTML;
  }

  function formatCell(value) {
    if (value === undefined || value === null || value === '') return '-';
    return escapeHtml(String(value));
  }

  function formatDateTime(d) {
    var dt = d || new Date();
    var pad = function (n) { return String(n).padStart(2, '0'); };
    return dt.getFullYear() + '-' + pad(dt.getMonth() + 1) + '-' + pad(dt.getDate()) +
      ' ' + pad(dt.getHours()) + ':' + pad(dt.getMinutes()) + ':' + pad(dt.getSeconds());
  }

  function todayStr() {
    var d = new Date();
    var pad = function (n) { return String(n).padStart(2, '0'); };
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }

  function addDays(dateStr, days) {
    var d = new Date(dateStr + 'T00:00:00');
    d.setDate(d.getDate() + days);
    var pad = function (n) { return String(n).padStart(2, '0'); };
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }

  function genId() {
    return 'brand-auth-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  }

  function genLogId() {
    return 'brand-auth-log-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
  }

  function displayVal(v) {
    if (v === undefined || v === null || v === '') return '空';
    return String(v);
  }

  function fileNamesFromRow(row) {
    var names = [];
    (row.authFiles || []).forEach(function (f) {
      if (f && !f._removed && f.fileName) names.push(f.fileName);
    });
    (row.pendingFiles || []).forEach(function (f) {
      if (f && f.fileName) names.push(f.fileName);
    });
    return names.length ? names.join('、') : '空';
  }

  function fileNamesFromRecord(record) {
    var files = record && record.authFiles ? record.authFiles : [];
    if (!files.length) return '空';
    return files.map(function (f) { return f.fileName || ''; }).filter(Boolean).join('、');
  }

  function getAuthorizedProducts(record) {
    if (!record || !Array.isArray(record.authorizedProducts)) return [];
    return record.authorizedProducts.map(function (s) { return String(s).trim(); }).filter(Boolean);
  }

  function formatYundeList(arr) {
    if (!arr || !arr.length) return '空';
    return arr.join('、');
  }

  function appendOperationLog(record, action, changes) {
    if (!record.operationLogs) record.operationLogs = [];
    record.operationLogs.unshift({
      id: genLogId(),
      time: formatDateTime(),
      operator: OPERATOR,
      action: action,
      changes: changes || []
    });
  }

  function buildCreateChanges(row) {
    var changes = [
      { field: '客户编码', before: '', after: row.customerCode },
      { field: '品牌名称', before: '', after: row.brandName },
      { field: '授权有效期', before: '', after: row.expireDate || '' },
      { field: '授权书文件', before: '', after: fileNamesFromRow(row) }
    ];
    if (row.remark) {
      changes.push({ field: '备注', before: '', after: row.remark });
    }
    return changes;
  }

  function fileNamesAfterEdit(oldRecord, modalRow) {
    var names = (oldRecord.authFiles || []).map(function (f) {
      return f && f.fileName ? f.fileName : '';
    }).filter(Boolean);
    (modalRow.pendingFiles || []).forEach(function (f) {
      if (f && f.fileName) names.push(f.fileName);
    });
    return names.length ? names.join('、') : '空';
  }

  function buildUpdateChanges(oldRecord, row) {
    var changes = [];
    [
      ['customerCode', '客户编码'],
      ['brandName', '品牌名称'],
      ['expireDate', '授权有效期'],
      ['remark', '备注']
    ].forEach(function (pair) {
      var before = oldRecord[pair[0]] || '';
      var after = row[pair[0]] || '';
      if (before !== after) {
        changes.push({ field: pair[1], before: before, after: after });
      }
    });
    var beforeFiles = fileNamesFromRecord(oldRecord);
    var afterFiles = fileNamesAfterEdit(oldRecord, row);
    if (beforeFiles !== afterFiles) {
      changes.push({ field: '授权书文件', before: beforeFiles, after: afterFiles });
    }
    return changes;
  }

  function buildDeleteChanges(record) {
    return [
      { field: '品牌代号', before: record.brandCode || '', after: '已删除' },
      { field: '客户编码', before: record.customerCode || '', after: '已删除' },
      { field: '品牌名称', before: record.brandName || '', after: '已删除' },
      { field: '授权有效期', before: record.expireDate || '', after: '已删除' },
      { field: '备注', before: record.remark || '', after: '已删除' },
      { field: '授权书文件', before: fileNamesFromRecord(record), after: '已删除' },
      { field: '授权产品', before: formatYundeList(getAuthorizedProducts(record)), after: '已删除' }
    ];
  }

  function appendDeleteAuditLog(record) {
    auditLogs.unshift({
      id: genLogId(),
      recordId: record.id,
      brandCode: record.brandCode || '',
      time: formatDateTime(),
      operator: OPERATOR,
      action: '删除',
      changes: buildDeleteChanges(record)
    });
  }

  function formatChangesHtml(changes) {
    if (!changes || !changes.length) return '-';
    return '<ul class="brand-log-changes">' + changes.map(function (c) {
      return '<li>' + escapeHtml(c.field) + '：' +
        escapeHtml(displayVal(c.before)) + ' → ' +
        escapeHtml(displayVal(c.after)) + '</li>';
    }).join('') + '</ul>';
  }

  function getLogsForRecord(record) {
    if (!record) return [];
    var logs = (record.operationLogs || []).slice();
    auditLogs.forEach(function (log) {
      if (log.recordId === record.id || log.brandCode === record.brandCode) {
        logs.push(log);
      }
    });
    logs.sort(function (a, b) {
      return String(b.time || '').localeCompare(String(a.time || ''));
    });
    return logs;
  }

  function parseBrandCodeNum(code) {
    var m = String(code || '').match(/^BA(\d+)$/i);
    return m ? parseInt(m[1], 10) : 0;
  }

  function formatBrandCode(n) {
    return 'BA' + String(n).padStart(4, '0');
  }

  function nextBrandCode(existingList) {
    var max = 0;
    (existingList || list).forEach(function (row) {
      var n = parseBrandCodeNum(row.brandCode);
      if (n > max) max = n;
    });
    return formatBrandCode(max + 1);
  }

  function getById(id) {
    for (var i = 0; i < list.length; i++) {
      if (list[i].id === id) return list[i];
    }
    return null;
  }

  function getFilters() {
    return {
      customerCode: val('q_customer_code').trim(),
      brandName: val('q_brand_name').trim(),
      yundeNo: val('q_yunde_no').trim(),
      expireStatus: val('q_expire_status')
    };
  }

  function matchExpireStatus(row, status) {
    if (!status) return true;
    var exp = String(row.expireDate || '').trim();
    if (!exp) return false;
    var today = todayStr();
    if (status === 'expired') return exp < today;
    if (status === 'expiring') {
      var limit = addDays(today, 30);
      return exp >= today && exp <= limit;
    }
    return true;
  }

  function rowMatches(f, row) {
    if (!includesNormalized(row.customerCode, f.customerCode)) return false;
    if (!includesNormalized(row.brandName, f.brandName)) return false;
    if (f.yundeNo) {
      var products = getAuthorizedProducts(row);
      var matched = products.some(function (code) {
        return includesNormalized(code, f.yundeNo);
      });
      if (!matched) return false;
    }
    if (!matchExpireStatus(row, f.expireStatus)) return false;
    return true;
  }

  function filtered() {
    var f = getFilters();
    return list.filter(function (row) {
      return rowMatches(f, row);
    });
  }

  function getPageList(rows) {
    var totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
    if (currentPage > totalPages) currentPage = totalPages;
    var start = (currentPage - 1) * PAGE_SIZE;
    return rows.slice(start, start + PAGE_SIZE);
  }

  function buildExpireCell(row) {
    var exp = String(row.expireDate || '').trim();
    if (!exp) return '-';
    var today = todayStr();
    var cls = '';
    if (exp < today) cls = ' brand-expire-expired';
    else if (exp <= addDays(today, 30)) cls = ' brand-expire-warn';
    return '<span class="' + cls.trim() + '">' + escapeHtml(exp) + '</span>';
  }

  function buildFilesCell(row) {
    var files = Array.isArray(row.authFiles) ? row.authFiles : [];
    if (!files.length) {
      return '<a href="#" class="brand-link-muted brand-link" data-action="viewFiles" data-id="' +
        escapeHtml(row.id) + '">查看</a>';
    }
    return '<a href="#" class="brand-link" data-action="viewFiles" data-id="' + escapeHtml(row.id) + '">' +
      escapeHtml(String(files.length)) + ' 个文件</a>';
  }

  function buildProductsCell(row) {
    var products = getAuthorizedProducts(row);
    if (!products.length) {
      return '<a href="#" class="brand-link-muted brand-link" data-action="viewProducts" data-id="' +
        escapeHtml(row.id) + '">查看</a>';
    }
    return '<a href="#" class="brand-link" data-action="viewProducts" data-id="' + escapeHtml(row.id) + '">' +
      escapeHtml(String(products.length)) + ' 个产品编码</a>';
  }

  function buildOps(row) {
    return (
      '<a href="#" class="brand-op-link" data-action="edit" data-id="' + escapeHtml(row.id) + '">编辑</a>' +
      '<a href="#" class="brand-op-link" data-action="log" data-id="' + escapeHtml(row.id) + '">日志</a>' +
      '<a href="#" class="brand-op-link" data-action="delete" data-id="' + escapeHtml(row.id) + '">删除</a>'
    );
  }

  function updateToolbarState() {
    var count = Object.keys(selectedIds).length;
    var editBtn = document.getElementById('btn_brand_edit');
    var deleteBtn = document.getElementById('btn_brand_delete');
    if (editBtn) editBtn.disabled = count === 0;
    if (deleteBtn) deleteBtn.disabled = count === 0;
  }

  function renderTable(rows) {
    var tbody = document.getElementById('brand-list-tbody');
    if (!tbody) return;

    var pageList = getPageList(rows);

    if (!pageList.length) {
      tbody.innerHTML =
        '<tr><td colspan="9"><p style="color:red;text-align:center;margin:12px 0;">暂无数据</p></td></tr>';
      syncSelectAllCheckbox(pageList);
      updateToolbarState();
      return;
    }

    tbody.innerHTML = pageList.map(function (row) {
      var checked = selectedIds[row.id] ? ' checked' : '';
      return (
        '<tr>' +
        '<td class="brand-col-check"><input type="checkbox" class="brand-row-check" data-id="' + escapeHtml(row.id) + '"' + checked + ' /></td>' +
        '<td>' + escapeHtml(row.brandCode) + '</td>' +
        '<td>' + escapeHtml(row.customerCode) + '</td>' +
        '<td>' + escapeHtml(row.brandName) + '</td>' +
        '<td>' + buildFilesCell(row) + '</td>' +
        '<td>' + buildProductsCell(row) + '</td>' +
        '<td>' + buildExpireCell(row) + '</td>' +
        '<td class="brand-remark-cell" title="' + escapeHtml(row.remark || '') + '">' + formatCell(row.remark) + '</td>' +
        '<td class="button">' + buildOps(row) + '</td>' +
        '</tr>'
      );
    }).join('');

    tbody.querySelectorAll('.brand-row-check').forEach(function (cb) {
      cb.addEventListener('change', function () {
        var id = cb.getAttribute('data-id');
        if (cb.checked) selectedIds[id] = true;
        else delete selectedIds[id];
        syncSelectAllCheckbox(pageList);
        updateToolbarState();
      });
    });

    tbody.querySelectorAll('[data-action]').forEach(function (a) {
      a.addEventListener('click', function (e) {
        e.preventDefault();
        var action = a.getAttribute('data-action');
        var id = a.getAttribute('data-id');
        if (action === 'edit') openModal('edit', [getById(id)]);
        else if (action === 'delete') deleteByIds([id]);
        else if (action === 'viewFiles') openFileListModal(getById(id));
        else if (action === 'viewProducts') openProductModal(getById(id));
        else if (action === 'log') openLogModal(getById(id));
      });
    });

    syncSelectAllCheckbox(pageList);
    updateToolbarState();
  }

  function syncSelectAllCheckbox(pageList) {
    var allCb = document.getElementById('brand-select-all');
    if (!allCb) return;
    if (!pageList.length) {
      allCb.checked = false;
      allCb.indeterminate = false;
      return;
    }
    var checkedCount = pageList.filter(function (r) { return selectedIds[r.id]; }).length;
    allCb.checked = checkedCount === pageList.length;
    allCb.indeterminate = checkedCount > 0 && checkedCount < pageList.length;
  }

  function renderPagination(total) {
    var paginationEl = document.getElementById('brand-pagination');
    if (!paginationEl) return;

    var totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    if (currentPage > totalPages) currentPage = totalPages;

    var start = total === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1;
    var end = Math.min(currentPage * PAGE_SIZE, total);

    var html = '<span style="color:#878787;">共 ' + total + ' 条，每页 ' + PAGE_SIZE + ' 条，显示 ' + start + '-' + end + '，第 ' + currentPage + '/' + totalPages + ' 页</span>';

    html += '<button type="button" data-page="prev"' + (currentPage <= 1 ? ' disabled' : '') + '>上一页</button>';

    var maxButtons = 7;
    var startPage = Math.max(1, currentPage - Math.floor(maxButtons / 2));
    var endPage = Math.min(totalPages, startPage + maxButtons - 1);
    if (endPage - startPage < maxButtons - 1) {
      startPage = Math.max(1, endPage - maxButtons + 1);
    }

    for (var i = startPage; i <= endPage; i++) {
      html += '<button type="button" data-page="' + i + '"' +
        (i === currentPage ? ' style="background-color:#007fbf;"' : '') + '>' + i + '</button>';
    }

    html += '<button type="button" data-page="next"' + (currentPage >= totalPages ? ' disabled' : '') + '>下一页</button>';

    paginationEl.innerHTML = html;

    paginationEl.querySelectorAll('[data-page]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (btn.disabled) return;
        var page = btn.getAttribute('data-page');
        if (page === 'prev') currentPage -= 1;
        else if (page === 'next') currentPage += 1;
        else currentPage = parseInt(page, 10);
        refresh(false);
      });
    });
  }

  function refresh(resetPage) {
    if (resetPage !== false) currentPage = 1;
    var rows = filtered();
    renderTable(rows);
    renderPagination(rows.length);
    var hint = document.getElementById('brand-result-hint');
    if (hint) {
      var totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
      hint.textContent = '共 ' + rows.length + ' 条，每页 ' + PAGE_SIZE + ' 条，当前第 ' + currentPage + ' / ' + totalPages + ' 页';
    }
  }

  function resetForm() {
    ['q_customer_code', 'q_brand_name', 'q_yunde_no'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.value = '';
    });
    var expEl = document.getElementById('q_expire_status');
    if (expEl) expEl.value = '';
    refresh(true);
  }

  function persistList(payload, logsPayload) {
    return fetch(API_PATH, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        list: payload || list,
        auditLogs: logsPayload != null ? logsPayload : auditLogs
      })
    }).then(function (res) { return res.json(); });
  }

  function deleteByIds(ids) {
    if (!ids || !ids.length) return;
    var label = ids.length === 1 ? '确定删除该品牌授权记录？' : '确定删除选中的 ' + ids.length + ' 条记录？';
    if (!window.confirm(label)) return;
    var idSet = {};
    ids.forEach(function (id) { idSet[id] = true; });
    list.filter(function (row) { return idSet[row.id]; }).forEach(appendDeleteAuditLog);
    list = list.filter(function (row) { return !idSet[row.id]; });
    ids.forEach(function (id) { delete selectedIds[id]; });
    persistList(list).then(function (body) {
      if (body && body.list) list = body.list;
      if (body && body.auditLogs) auditLogs = body.auditLogs;
      refresh(false);
    }).catch(function () {
      window.alert('删除失败，请重试');
    });
  }

  function emptyModalRow() {
    return {
      _key: 'row-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
      id: '',
      brandCode: '',
      customerCode: '',
      brandName: '',
      remark: '',
      expireDate: '',
      authFiles: [],
      pendingFiles: []
    };
  }

  function recordToModalRow(record) {
    var row = emptyModalRow();
    if (!record) return row;
    row.id = record.id || '';
    row.brandCode = record.brandCode || '';
    row.customerCode = record.customerCode || '';
    row.brandName = record.brandName || '';
    row.remark = record.remark || '';
    row.expireDate = record.expireDate || '';
    row.authorizedProducts = getAuthorizedProducts(record);
    row.authFiles = [];
    row.pendingFiles = [];
    return row;
  }

  function showModalError(msg) {
    var el = document.getElementById('brandAuthModalError');
    if (!el) return;
    if (msg) {
      el.textContent = msg;
      el.style.display = 'block';
    } else {
      el.textContent = '';
      el.style.display = 'none';
    }
  }

  function renderModalTable() {
    var tbody = document.getElementById('brandAuthModalTbody');
    if (!tbody) return;

    tbody.innerHTML = modalRows.map(function (row, idx) {
      var fileTags = '';

      (row.pendingFiles || []).forEach(function (f, fi) {
        fileTags += '<span class="brand-file-tag" data-row="' + idx + '" data-type="pending" data-fi="' + fi + '">' +
          '<span class="brand-file-tag-name" title="' + escapeHtml(f.fileName) + '">' + escapeHtml(f.fileName) + ' (待上传)</span>' +
          '<button type="button" class="brand-file-tag-remove" data-row="' + idx + '" data-type="pending" data-fi="' + fi + '" aria-label="移除">&times;</button>' +
          '</span>';
      });

      if (!fileTags) {
        fileTags = '<span class="brand-file-upload-hint">选择文件上传；删除已有文件请至列表「查看授权书」</span>';
      }

      var removeDisabled = modalRows.length <= 1 ? ' disabled' : '';
      var productsDisplay = formatYundeList(row.authorizedProducts || []);
      var productsHtml = productsDisplay === '空' ?
        '<span class="brand-auth-products-readonly-empty">暂无（产品绑定自动同步）</span>' :
        escapeHtml(productsDisplay.replace(/、/g, '\n'));

      return (
        '<tr data-row-idx="' + idx + '">' +
        '<td><input type="text" class="brand-modal-customer" data-idx="' + idx + '" value="' + escapeHtml(row.customerCode) + '" placeholder="客户编码" /></td>' +
        '<td><input type="text" class="brand-modal-name" data-idx="' + idx + '" value="' + escapeHtml(row.brandName) + '" placeholder="品牌名称" /></td>' +
        '<td><input type="text" class="brand-modal-remark" data-idx="' + idx + '" value="' + escapeHtml(row.remark || '') + '" placeholder="备注" /></td>' +
        '<td class="brand-file-cell">' +
        '<input type="file" class="brand-file-input" data-idx="' + idx + '" multiple accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.gif,.webp" />' +
        '<div class="brand-file-tags">' + fileTags + '</div>' +
        '</td>' +
        '<td class="brand-product-cell"><div class="brand-auth-products-readonly">' + productsHtml + '</div></td>' +
        '<td><input type="date" class="brand-modal-expire" data-idx="' + idx + '" value="' + escapeHtml(row.expireDate) + '" /></td>' +
        '<td><button type="button" class="brand-row-remove-btn" data-idx="' + idx + '"' + removeDisabled + '>删除行</button></td>' +
        '</tr>'
      );
    }).join('');

    tbody.querySelectorAll('.brand-modal-customer').forEach(function (input) {
      input.addEventListener('input', function () {
        var idx = parseInt(input.getAttribute('data-idx'), 10);
        modalRows[idx].customerCode = input.value;
      });
    });

    tbody.querySelectorAll('.brand-modal-name').forEach(function (input) {
      input.addEventListener('input', function () {
        var idx = parseInt(input.getAttribute('data-idx'), 10);
        modalRows[idx].brandName = input.value;
      });
    });

    tbody.querySelectorAll('.brand-modal-remark').forEach(function (input) {
      input.addEventListener('input', function () {
        var idx = parseInt(input.getAttribute('data-idx'), 10);
        modalRows[idx].remark = input.value;
      });
    });

    tbody.querySelectorAll('.brand-modal-expire').forEach(function (input) {
      input.addEventListener('change', function () {
        var idx = parseInt(input.getAttribute('data-idx'), 10);
        modalRows[idx].expireDate = input.value;
      });
    });

    tbody.querySelectorAll('.brand-file-input').forEach(function (input) {
      input.addEventListener('change', function () {
        var idx = parseInt(input.getAttribute('data-idx'), 10);
        var files = input.files;
        if (!files || !files.length) return;
        var pending = modalRows[idx].pendingFiles || [];
        var readers = [];
        for (var i = 0; i < files.length; i++) {
          (function (file) {
            readers.push(new Promise(function (resolve) {
              var reader = new FileReader();
              reader.onload = function () {
                resolve({ fileName: file.name, dataUrl: reader.result });
              };
              reader.onerror = function () { resolve(null); };
              reader.readAsDataURL(file);
            }));
          })(files[i]);
        }
        Promise.all(readers).then(function (results) {
          results.forEach(function (r) {
            if (r) pending.push(r);
          });
          modalRows[idx].pendingFiles = pending;
          renderModalTable();
        });
        input.value = '';
      });
    });

    tbody.querySelectorAll('.brand-file-tag-remove').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var idx = parseInt(btn.getAttribute('data-row'), 10);
        var fi = parseInt(btn.getAttribute('data-fi'), 10);
        modalRows[idx].pendingFiles.splice(fi, 1);
        renderModalTable();
      });
    });

    tbody.querySelectorAll('.brand-row-remove-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (modalRows.length <= 1) return;
        var idx = parseInt(btn.getAttribute('data-idx'), 10);
        modalRows.splice(idx, 1);
        renderModalTable();
      });
    });
  }

  function openModal(mode, records) {
    modalMode = mode || 'add';
    var title = document.getElementById('brandAuthModalTitle');
    if (title) title.textContent = modalMode === 'add' ? '新增品牌授权' : '编辑品牌授权';

    if (modalMode === 'add') {
      modalRows = [emptyModalRow()];
    } else {
      modalRows = (records || []).filter(Boolean).map(recordToModalRow);
      if (!modalRows.length) modalRows = [emptyModalRow()];
    }

    showModalError('');
    renderModalTable();
    document.getElementById('brandAuthModalBackdrop').style.display = 'flex';
  }

  function closeModal() {
    document.getElementById('brandAuthModalBackdrop').style.display = 'none';
    modalRows = [];
    showModalError('');
  }

  function collectModalRowsFromDom() {
    modalRows.forEach(function (row, idx) {
      var customerEl = document.querySelector('.brand-modal-customer[data-idx="' + idx + '"]');
      var nameEl = document.querySelector('.brand-modal-name[data-idx="' + idx + '"]');
      var remarkEl = document.querySelector('.brand-modal-remark[data-idx="' + idx + '"]');
      var expireEl = document.querySelector('.brand-modal-expire[data-idx="' + idx + '"]');
      if (customerEl) row.customerCode = customerEl.value.trim();
      if (nameEl) row.brandName = nameEl.value.trim();
      if (remarkEl) row.remark = remarkEl.value.trim();
      if (expireEl) row.expireDate = expireEl.value;
    });
  }

  function validateModalRows() {
    collectModalRowsFromDom();
    var keyMap = {};
    for (var i = 0; i < modalRows.length; i++) {
      var row = modalRows[i];
      if (!row.customerCode) {
        return '第 ' + (i + 1) + ' 行：客户编码不能为空';
      }
      if (!row.brandName) {
        return '第 ' + (i + 1) + ' 行：品牌名称不能为空';
      }
      var key = norm(row.customerCode) + '\x01' + norm(row.brandName);
      if (keyMap[key] != null) {
        return '第 ' + (i + 1) + ' 行：客户编码「' + row.customerCode + '」+ 品牌名称「' + row.brandName + '」已存在';
      }
      keyMap[key] = i;
    }
    for (var j = 0; j < modalRows.length; j++) {
      var rr = modalRows[j];
      var excludeId = modalMode === 'edit' && rr.id ? rr.id : null;
      if (BrandAuthImportExport.findByUniqueKey(list, rr.customerCode, rr.brandName, excludeId)) {
        return '第 ' + (j + 1) + ' 行：客户编码「' + rr.customerCode + '」+ 品牌名称「' + rr.brandName + '」已存在';
      }
    }
    return '';
  }

  function buildSavePayload() {
    var now = formatDateTime();
    var workingList = JSON.parse(JSON.stringify(list));
    var editIdSet = {};

    if (modalMode === 'edit') {
      modalRows.forEach(function (row) {
        if (row.id) editIdSet[row.id] = true;
      });
    }

    modalRows.forEach(function (row) {
      if (modalMode === 'edit' && row.id) {
        for (var i = 0; i < workingList.length; i++) {
          if (workingList[i].id === row.id) {
            var updated = JSON.parse(JSON.stringify(workingList[i]));
            var oldRecord = getById(row.id) || workingList[i];
            updated.customerCode = row.customerCode;
            updated.brandName = row.brandName;
            updated.remark = row.remark || '';
            updated.expireDate = row.expireDate || '';
            updated.authorizedProducts = getAuthorizedProducts(oldRecord);
            updated.authFiles = (oldRecord.authFiles || []).map(function (f) {
              return { fileName: f.fileName, url: f.url, uploadedAt: f.uploadedAt };
            });
            updated.pendingFiles = (row.pendingFiles || []).map(function (f) {
              return { fileName: f.fileName, dataUrl: f.dataUrl };
            });
            updated.updateTime = now;
            if (!updated.operationLogs) updated.operationLogs = oldRecord.operationLogs || [];
            var changes = buildUpdateChanges(oldRecord, row);
            if (changes.length) {
              appendOperationLog(updated, '编辑', changes);
            }
            workingList[i] = updated;
            break;
          }
        }
      } else {
        var created = {
          id: genId(),
          brandCode: nextBrandCode(workingList),
          customerCode: row.customerCode,
          brandName: row.brandName,
          remark: row.remark || '',
          expireDate: row.expireDate || '',
          authorizedProducts: [],
          authFiles: [],
          pendingFiles: (row.pendingFiles || []).map(function (f) {
            return { fileName: f.fileName, dataUrl: f.dataUrl };
          }),
          operationLogs: [],
          createTime: now,
          updateTime: now
        };
        appendOperationLog(created, '新增', buildCreateChanges(row));
        workingList.unshift(created);
      }
    });

    return workingList;
  }

  function saveModal() {
    var err = validateModalRows();
    if (err) {
      showModalError(err);
      return;
    }

    var payload = buildSavePayload();
    var saveBtn = document.getElementById('brandAuthModalSave');
    if (saveBtn) saveBtn.disabled = true;

    persistList(payload).then(function (body) {
      if (body && body.error) throw new Error(body.error);
      if (body && body.list) list = body.list;
      else list = payload;
      if (body && body.auditLogs) auditLogs = body.auditLogs;
      closeModal();
      refresh(modalMode === 'add');
    }).catch(function (e) {
      showModalError(e.message || '保存失败，请重试');
    }).finally(function () {
      if (saveBtn) saveBtn.disabled = false;
    });
  }

  function renderFileListModal(record) {
    if (!record) return;
    var files = Array.isArray(record.authFiles) ? record.authFiles : [];
    var ul = document.getElementById('brandFileListBody');
    var title = document.getElementById('brandFileListModalTitle');
    var tip = document.getElementById('brandFileListTip');
    if (title) {
      title.textContent = '授权书文件 · ' + (record.brandName || record.brandCode);
    }
    if (tip) {
      tip.textContent = files.length
        ? '可预览或删除授权书；新增文件请在「编辑」中上传。'
        : '暂无授权书文件，可在「编辑」中上传。';
    }
    if (!ul) return;
    if (!files.length) {
      ul.innerHTML = '<li class="brand-file-list-empty">暂无文件</li>';
      return;
    }
    ul.innerHTML = files.map(function (f, fi) {
      var url = f.url || '#';
      return (
        '<li class="brand-file-list-item">' +
        '<a href="' + escapeHtml(url) + '" target="_blank" rel="noopener" class="brand-file-list-link">' +
        escapeHtml(f.fileName || url) + '</a>' +
        '<button type="button" class="brand-file-list-delete" data-idx="' + fi + '">删除</button>' +
        '</li>'
      );
    }).join('');

    ul.querySelectorAll('.brand-file-list-delete').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var idx = parseInt(btn.getAttribute('data-idx'), 10);
        deleteAuthFileByIndex(record.id, idx);
      });
    });
  }

  function deleteAuthFileByIndex(recordId, fileIndex) {
    var record = getById(recordId);
    if (!record) return;
    var files = Array.isArray(record.authFiles) ? record.authFiles.slice() : [];
    var file = files[fileIndex];
    if (!file) return;
    var label = file.fileName || file.url || '该文件';
    if (!window.confirm('确定删除授权书「' + label + '」？')) return;

    var beforeFiles = fileNamesFromRecord(record);
    files.splice(fileIndex, 1);
    var afterFiles = files.length
      ? files.map(function (f) { return f.fileName || ''; }).filter(Boolean).join('、')
      : '空';

    var updated = JSON.parse(JSON.stringify(record));
    updated.authFiles = files;
    updated.updateTime = formatDateTime();
    appendOperationLog(updated, '编辑', [{
      field: '授权书文件',
      before: beforeFiles,
      after: afterFiles
    }]);

    for (var i = 0; i < list.length; i++) {
      if (list[i].id === recordId) {
        list[i] = updated;
        break;
      }
    }

    persistList(list).then(function (body) {
      if (body && body.error) throw new Error(body.error);
      if (body && body.list) list = body.list;
      if (body && body.auditLogs) auditLogs = body.auditLogs;
      renderFileListModal(getById(recordId));
      refresh(false);
    }).catch(function () {
      window.alert('删除失败，请重试');
    });
  }

  function openFileListModal(record) {
    if (!record) return;
    fileListModalRecordId = record.id;
    renderFileListModal(getById(record.id) || record);
    document.getElementById('brandFileListModalBackdrop').style.display = 'flex';
  }

  function closeFileListModal() {
    document.getElementById('brandFileListModalBackdrop').style.display = 'none';
    fileListModalRecordId = null;
  }

  function renderProductModalTable() {
    var tbody = document.getElementById('brandProductTbody');
    if (!tbody) return;
    if (!productModalItems.length) {
      tbody.innerHTML = '<tr><td colspan="2" class="brand-log-empty">暂无产品编码，请在产品管理中绑定品牌授权后自动同步</td></tr>';
      return;
    }
    tbody.innerHTML = productModalItems.map(function (code, idx) {
      return (
        '<tr>' +
        '<td>' + (idx + 1) + '</td>' +
        '<td>' + escapeHtml(code) + '</td>' +
        '</tr>'
      );
    }).join('');
  }

  function openProductModal(record) {
    if (!record) return;
    productModalItems = getAuthorizedProducts(record).slice();
    var title = document.getElementById('brandProductModalTitle');
    var subtitle = document.getElementById('brandProductSubtitle');
    if (title) {
      title.textContent = '授权产品集合 · ' + (record.brandName || record.brandCode);
    }
    if (subtitle) {
      subtitle.textContent = '品牌代号：' + (record.brandCode || '-') +
        '　客户编码：' + (record.customerCode || '-');
    }
    renderProductModalTable();
    document.getElementById('brandProductModalBackdrop').style.display = 'flex';
  }

  function closeProductModal() {
    document.getElementById('brandProductModalBackdrop').style.display = 'none';
    productModalItems = [];
  }

  function openLogModal(record) {
    if (!record) return;
    var title = document.getElementById('brandLogModalTitle');
    var subtitle = document.getElementById('brandLogSubtitle');
    var tbody = document.getElementById('brandLogTbody');
    if (title) {
      title.textContent = '操作日志 · ' + (record.brandName || record.brandCode);
    }
    if (subtitle) {
      subtitle.textContent = '品牌代号：' + (record.brandCode || '-') +
        '　客户编码：' + (record.customerCode || '-') +
        '　品牌名称：' + (record.brandName || '-');
    }
    var logs = getLogsForRecord(record);
    if (!tbody) return;
    if (!logs.length) {
      tbody.innerHTML = '<tr><td colspan="4" class="brand-log-empty">暂无操作日志</td></tr>';
    } else {
      tbody.innerHTML = logs.map(function (log) {
        return (
          '<tr>' +
          '<td>' + formatCell(log.time) + '</td>' +
          '<td>' + formatCell(log.operator) + '</td>' +
          '<td>' + formatCell(log.action) + '</td>' +
          '<td>' + formatChangesHtml(log.changes) + '</td>' +
          '</tr>'
        );
      }).join('');
    }
    document.getElementById('brandLogModalBackdrop').style.display = 'flex';
  }

  function closeLogModal() {
    document.getElementById('brandLogModalBackdrop').style.display = 'none';
  }

  function getSelectedIds() {
    return Object.keys(selectedIds);
  }

  function openImportModal() {
    pendingImportFile = null;
    var statusEl = document.getElementById('brandImportStatus');
    var fileInput = document.getElementById('brandImportFileInput');
    if (statusEl) {
      statusEl.style.display = 'none';
      statusEl.textContent = '';
    }
    if (fileInput) fileInput.value = '';
    document.getElementById('brandImportModalBackdrop').style.display = 'flex';
  }

  function closeImportModal() {
    document.getElementById('brandImportModalBackdrop').style.display = 'none';
    pendingImportFile = null;
    var statusEl = document.getElementById('brandImportStatus');
    if (statusEl) {
      statusEl.style.display = 'none';
      statusEl.textContent = '';
    }
  }

  function closeImportFailModal() {
    document.getElementById('brandImportFailModalBackdrop').style.display = 'none';
  }

  function showImportFailModal(result, fileName, total) {
    lastImportFailure = {
      errors: result.errors,
      summary: {
        importTime: BrandAuthImportExport.formatDateTime(),
        operator: OPERATOR,
        fileName: fileName || '',
        total: total,
        errorCount: result.errorCount
      }
    };
    var summaryEl = document.getElementById('brandImportFailSummary');
    if (summaryEl) {
      summaryEl.textContent = '共 ' + total + ' 行，发现 ' + result.errorCount + ' 处错误，未导入任何数据。';
    }
    var previewEl = document.getElementById('brandImportFailPreview');
    if (previewEl) {
      var preview = (result.errors || []).slice(0, 10);
      if (!preview.length) {
        previewEl.innerHTML = '<li>无预览数据</li>';
      } else {
        previewEl.innerHTML = preview.map(function (err) {
          return '<li>第 ' + err.rowNum + ' 行：<span class="brand-import-error-reason">' +
            escapeHtml(err.message || '') + '</span></li>';
        }).join('');
      }
    }
    document.getElementById('brandImportFailModalBackdrop').style.display = 'flex';
  }

  function downloadLastFailureReport() {
    if (!lastImportFailure) return;
    try {
      BrandAuthImportExport.downloadFailureReport(lastImportFailure.errors, lastImportFailure.summary);
    } catch (e) {
      window.alert('失败报告生成异常，请稍后重试或联系管理员');
    }
  }

  function handleExport() {
    var rows = filtered();
    if (!rows.length) {
      window.alert('当前筛选结果为空，无可导出数据');
      return;
    }
    try {
      BrandAuthImportExport.exportRows(rows);
    } catch (e) {
      window.alert(e.message || '导出失败，请重试');
    }
  }

  function handleDownloadTemplate() {
    try {
      BrandAuthImportExport.downloadTemplate();
    } catch (e) {
      window.alert(e.message || '模板下载失败，请重试');
    }
  }

  function readFileAsArrayBuffer(file) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () { resolve(reader.result); };
      reader.onerror = function () { reject(new Error('文件读取失败')); };
      reader.readAsArrayBuffer(file);
    });
  }

  function runImport(file) {
    if (!file) return;
    if (!/\.xlsx$/i.test(file.name)) {
      window.alert('仅支持 .xlsx 格式');
      return;
    }

    var statusEl = document.getElementById('brandImportStatus');
    var startBtn = document.getElementById('brandImportModalStart');
    if (startBtn) startBtn.disabled = true;

    readFileAsArrayBuffer(file).then(function (buffer) {
      var parsed = BrandAuthImportExport.parseImportWorkbook(buffer);
      if (parsed.error) {
        throw new Error(parsed.error.message || '导入文件解析失败');
      }
      var rows = parsed.rows;
      if (statusEl) {
        statusEl.style.display = 'block';
        statusEl.textContent = '正在校验，请稍候…（共 ' + rows.length + ' 行）';
      }
      var validation = BrandAuthImportExport.validateImportRows(rows, list);
      if (!validation.ok) {
        closeImportModal();
        showImportFailModal(validation, file.name, rows.length);
        return null;
      }
      return BrandAuthImportExport.applyImportRows(rows, list, {
        genId: genId,
        nextBrandCode: nextBrandCode,
        buildCreateChanges: buildCreateChanges,
        buildUpdateChanges: buildUpdateChanges,
        appendOperationLog: appendOperationLog
      });
    }).then(function (applied) {
      if (!applied) return;
      return persistList(applied.list).then(function (body) {
        if (body && body.error) throw new Error(body.error);
        list = body && body.list ? body.list : applied.list;
        if (body && body.auditLogs) auditLogs = body.auditLogs;
        closeImportModal();
        refresh(true);
        window.alert('导入成功\n\n新增 ' + applied.insertCount + ' 条，更新 ' + applied.updateCount + ' 条，共 ' + applied.successCount + ' 条。');
      });
    }).catch(function (e) {
      if (statusEl) {
        statusEl.style.display = 'block';
        statusEl.textContent = e.message || '导入失败，请重试';
      } else {
        window.alert(e.message || '导入失败，请重试');
      }
    }).finally(function () {
      if (startBtn) startBtn.disabled = false;
    });
  }

  function startImportFromModal() {
    var fileInput = document.getElementById('brandImportFileInput');
    var file = pendingImportFile || (fileInput && fileInput.files && fileInput.files[0]);
    if (!file) {
      window.alert('请先选择 .xlsx 文件');
      return;
    }
    runImport(file);
  }

  function bind() {
    var q = document.getElementById('btn_brand_query');
    var r = document.getElementById('btn_brand_reset');
    if (q) q.addEventListener('click', function () { refresh(true); });
    if (r) r.addEventListener('click', resetForm);

    ['q_customer_code', 'q_brand_name', 'q_yunde_no'].forEach(function (id) {
      var el = document.getElementById(id);
      if (!el) return;
      el.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') {
          e.preventDefault();
          refresh(true);
        }
      });
    });

    var expEl = document.getElementById('q_expire_status');
    if (expEl) expEl.addEventListener('change', function () { refresh(true); });

    var addBtn = document.getElementById('btn_brand_add');
    if (addBtn) addBtn.addEventListener('click', function () { openModal('add'); });

    var editBtn = document.getElementById('btn_brand_edit');
    if (editBtn) {
      editBtn.addEventListener('click', function () {
        var ids = getSelectedIds();
        if (!ids.length) return;
        var records = ids.map(getById).filter(Boolean);
        openModal('edit', records);
      });
    }

    var deleteBtn = document.getElementById('btn_brand_delete');
    if (deleteBtn) {
      deleteBtn.addEventListener('click', function () {
        deleteByIds(getSelectedIds());
      });
    }

    var importBtn = document.getElementById('btn_brand_import');
    if (importBtn) importBtn.addEventListener('click', openImportModal);

    var templateBtn = document.getElementById('btn_brand_template');
    if (templateBtn) templateBtn.addEventListener('click', handleDownloadTemplate);

    var exportBtn = document.getElementById('btn_brand_export');
    if (exportBtn) exportBtn.addEventListener('click', handleExport);

    var importFileInput = document.getElementById('brandImportFileInput');
    if (importFileInput) {
      importFileInput.addEventListener('change', function () {
        pendingImportFile = importFileInput.files && importFileInput.files[0] ? importFileInput.files[0] : null;
      });
    }

    ['brandImportModalClose', 'brandImportModalCancel'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.addEventListener('click', closeImportModal);
    });
    var importBackdrop = document.getElementById('brandImportModalBackdrop');
    if (importBackdrop) {
      importBackdrop.addEventListener('click', function (e) {
        if (e.target === importBackdrop) closeImportModal();
      });
    }
    var importStartBtn = document.getElementById('brandImportModalStart');
    if (importStartBtn) importStartBtn.addEventListener('click', startImportFromModal);

    ['brandImportFailModalClose', 'brandImportFailModalDismiss'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.addEventListener('click', closeImportFailModal);
    });
    var failBackdrop = document.getElementById('brandImportFailModalBackdrop');
    if (failBackdrop) {
      failBackdrop.addEventListener('click', function (e) {
        if (e.target === failBackdrop) closeImportFailModal();
      });
    }
    var failDownloadBtn = document.getElementById('brandImportFailDownload');
    if (failDownloadBtn) failDownloadBtn.addEventListener('click', downloadLastFailureReport);

    var allCb = document.getElementById('brand-select-all');
    if (allCb) {
      allCb.addEventListener('change', function () {
        var checked = allCb.checked;
        var pageList = getPageList(filtered());
        pageList.forEach(function (row) {
          if (checked) selectedIds[row.id] = true;
          else delete selectedIds[row.id];
        });
        refresh(false);
      });
    }

    document.getElementById('btn_brand_add_row').addEventListener('click', function () {
      collectModalRowsFromDom();
      modalRows.push(emptyModalRow());
      renderModalTable();
    });

    ['brandAuthModalClose', 'brandAuthModalCancel'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.addEventListener('click', closeModal);
    });

    var backdrop = document.getElementById('brandAuthModalBackdrop');
    if (backdrop) {
      backdrop.addEventListener('click', function (e) {
        if (e.target === backdrop) closeModal();
      });
    }

    document.getElementById('brandAuthModalSave').addEventListener('click', saveModal);

    ['brandFileListModalClose', 'brandFileListModalOk'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.addEventListener('click', closeFileListModal);
    });

    var fileBackdrop = document.getElementById('brandFileListModalBackdrop');
    if (fileBackdrop) {
      fileBackdrop.addEventListener('click', function (e) {
        if (e.target === fileBackdrop) closeFileListModal();
      });
    }

    ['brandProductModalClose', 'brandProductModalOk'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.addEventListener('click', closeProductModal);
    });
    var productBackdrop = document.getElementById('brandProductModalBackdrop');
    if (productBackdrop) {
      productBackdrop.addEventListener('click', function (e) {
        if (e.target === productBackdrop) closeProductModal();
      });
    }

    ['brandLogModalClose', 'brandLogModalOk'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.addEventListener('click', closeLogModal);
    });

    var logBackdrop = document.getElementById('brandLogModalBackdrop');
    if (logBackdrop) {
      logBackdrop.addEventListener('click', function (e) {
        if (e.target === logBackdrop) closeLogModal();
      });
    }
  }

  function init() {
    bind();
    if (typeof MOCK_BRAND_AUTH_AUDIT_LOGS !== 'undefined') {
      auditLogs = JSON.parse(JSON.stringify(MOCK_BRAND_AUTH_AUDIT_LOGS));
    }
    if (typeof fetch !== 'undefined') {
      fetch(API_PATH, { method: 'GET' })
        .then(function (res) { return res.json(); })
        .then(function (body) {
          if (body && Array.isArray(body.list)) {
            list = JSON.parse(JSON.stringify(body.list));
          }
          if (body && Array.isArray(body.auditLogs)) {
            auditLogs = JSON.parse(JSON.stringify(body.auditLogs));
          }
          refresh(true);
        })
        .catch(function () { refresh(true); });
    } else {
      refresh(true);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
