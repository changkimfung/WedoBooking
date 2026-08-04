/**
 * 仓储中台 · 产品信息管理列表
 * 依赖：MOCK_PRODUCT_INFO_LIST 及筛选选项常量
 */
(function () {
  var PAGE_SIZE = 20;
  var API_PATH = '/api/mock/product-info';
  var BRAND_AUTH_API = '/api/mock/brand-authorization';
  var BRAND_AUTH_BINDING_CATEGORIES = ['有品牌无授权', '自有品牌', '授权品牌'];
  var currentPage = 1;
  var editRecordId = '';
  var editCustomerCode = '';
  var brandAuthList = [];
  var editInspectionFiles = [];
  var editPendingInspectionFiles = [];
  var syncPollTimer = null;
  var SYNC_POLL_MS = 4000;
  var OPERATOR = '演示用户';

  var raw = typeof MOCK_PRODUCT_INFO_LIST !== 'undefined' ? MOCK_PRODUCT_INFO_LIST : [];
  var list = JSON.parse(JSON.stringify(raw));
  var rawBrandAuth = typeof MOCK_BRAND_AUTH_LIST !== 'undefined' ? MOCK_BRAND_AUTH_LIST : [];
  brandAuthList = JSON.parse(JSON.stringify(rawBrandAuth));

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

  function formatNumber(num, digits) {
    if (num === undefined || num === null || num === '') return '-';
    return Number(num).toFixed(digits);
  }

  function getById(id) {
    for (var i = 0; i < list.length; i++) {
      if (list[i].id === id) return list[i];
    }
    return null;
  }

  function formatDateTime(d) {
    var dt = d || new Date();
    var pad = function (n) { return String(n).padStart(2, '0'); };
    return dt.getFullYear() + '-' + pad(dt.getMonth() + 1) + '-' + pad(dt.getDate()) +
      ' ' + pad(dt.getHours()) + ':' + pad(dt.getMinutes()) + ':' + pad(dt.getSeconds());
  }

  function genLogId() {
    return 'product-log-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
  }

  function displayLogVal(v) {
    if (v === undefined || v === null || v === '') return '空';
    return String(v);
  }

  function formatBrandAuthLogLabel(authId) {
    if (!authId) return '空';
    var label = getBrandNameForProduct({ brandAuthId: authId });
    return label || String(authId);
  }

  function appendProductOperationLog(record, action, changes, options) {
    if (!record.operationLogs) record.operationLogs = [];
    var log = {
      id: genLogId(),
      time: formatDateTime(),
      operator: OPERATOR,
      action: action,
      changes: changes || []
    };
    if (options && options.relationDesc) log.relationDesc = options.relationDesc;
    record.operationLogs.unshift(log);
  }

  function buildProductBrandAuthChanges(oldRecord, newRecord) {
    var changes = [];
    var oldAuthId = oldRecord.brandAuthId || '';
    var newAuthId = newRecord.brandAuthId || '';
    var oldExpire = oldRecord.fileExpireDate || '';
    var newExpire = newRecord.fileExpireDate || '';
    var authChanged = oldAuthId !== newAuthId;

    if (authChanged) {
      changes.push({
        field: '授权品牌',
        before: formatBrandAuthLogLabel(oldAuthId),
        after: formatBrandAuthLogLabel(newAuthId)
      });
    }
    if (oldExpire !== newExpire) {
      changes.push({
        field: '授权有效期',
        before: oldExpire || '空',
        after: newExpire || '空',
        relation: authChanged ? '随授权品牌变更联动' : ''
      });
    }
    return changes;
  }

  function buildProductEditRelationDesc(changes) {
    if (!changes || !changes.length) return '';
    var authChange = changes.some(function (c) { return c.field === '授权品牌'; });
    var expireLinked = changes.some(function (c) {
      return c.field === '授权有效期' && c.relation === '随授权品牌变更联动';
    });
    if (authChange && expireLinked) {
      return '授权品牌与授权有效期一并变更（有效期随绑定品牌同步）';
    }
    if (changes.length === 1 && changes[0].field === '授权有效期') {
      return '授权有效期变更';
    }
    return '';
  }

  function formatProductChangesHtml(changes) {
    if (!changes || !changes.length) return '-';
    return '<ul class="product-log-changes">' + changes.map(function (c) {
      var relation = c.relation ? '（' + escapeHtml(c.relation) + '）' : '';
      return '<li>' + escapeHtml(c.field) + '：' +
        escapeHtml(displayLogVal(c.before)) + ' → ' +
        escapeHtml(displayLogVal(c.after)) + relation + '</li>';
    }).join('') + '</ul>';
  }

  function getSpecialAttrOptions() {
    if (typeof MOCK_PRODUCT_DETAIL_SPECIAL_ATTRS !== 'undefined') {
      return MOCK_PRODUCT_DETAIL_SPECIAL_ATTRS.slice();
    }
    return ['普货', '普通电子类', '内置纽扣电池', '内置锂电池', '带磁性', '点烟器/打火机',
      '外观敏感件', '膏状', '液体', '粉末', '纯电池', '种子', '超规格(尺寸)'];
  }

  function getBrandCategoryOptions() {
    if (typeof MOCK_PRODUCT_BRAND_CATEGORY !== 'undefined') {
      return MOCK_PRODUCT_BRAND_CATEGORY.slice();
    }
    return ['未设置', '有品牌无授权', '自有品牌', '授权品牌', '不涉牌'];
  }

  function getProductStatusOptions() {
    if (typeof MOCK_PRODUCT_DETAIL_STATUS !== 'undefined') {
      return MOCK_PRODUCT_DETAIL_STATUS.slice();
    }
    return ['终审', '初审', '待审核', '已驳回'];
  }

  function getRecordSpecialAttrs(record) {
    if (record && Array.isArray(record.specialAttrs) && record.specialAttrs.length) {
      return record.specialAttrs.slice();
    }
    if (record && record.specialAttr) return [record.specialAttr];
    return ['普货'];
  }

  function formatSpecialAttrCell(row) {
    var attrs = getRecordSpecialAttrs(row);
    return escapeHtml(attrs.join('、'));
  }

  function normCode(s) {
    return String(s == null ? '' : s).trim().toUpperCase();
  }

  function needsBrandAuthBinding(category) {
    return BRAND_AUTH_BINDING_CATEGORIES.indexOf(category) !== -1;
  }

  function getBrandAuthById(id) {
    for (var i = 0; i < brandAuthList.length; i++) {
      if (brandAuthList[i].id === id) return brandAuthList[i];
    }
    return null;
  }

  function getBrandAuthOptionsForCustomer(customerCode) {
    var code = normCode(customerCode);
    return brandAuthList.filter(function (row) {
      return normCode(row.customerCode) === code;
    });
  }

  function formatBrandAuthOptionLabel(row) {
    return (row.brandCode || '-') + ' · ' + (row.brandName || '-');
  }

  function resetInspectionFileState() {
    editInspectionFiles = [];
    editPendingInspectionFiles = [];
    var input = document.getElementById('edit_inspection_file_input');
    if (input) input.value = '';
    renderInspectionFileTags();
  }

  function loadInspectionFilesFromRecord(record) {
    editInspectionFiles = (record && Array.isArray(record.productFiles) ? record.productFiles : []).map(function (f) {
      return {
        fileName: f.fileName || '',
        url: f.url || '',
        uploadedAt: f.uploadedAt || '',
        _removed: false
      };
    });
    editPendingInspectionFiles = [];
    renderInspectionFileTags();
    var input = document.getElementById('edit_inspection_file_input');
    if (input) input.value = '';
  }

  function renderInspectionFileTags() {
    var wrap = document.getElementById('edit_inspection_file_tags');
    if (!wrap) return;
    var html = '';

    editInspectionFiles.forEach(function (f, fi) {
      if (f._removed) return;
      var name = escapeHtml(f.fileName || '图片' + (fi + 1));
      var url = f.url || '';
      var label = url ?
        '<a href="' + escapeHtml(url) + '" target="_blank" rel="noopener">' + name + '</a>' :
        name;
      html += '<span class="product-edit-file-tag" data-type="existing" data-fi="' + fi + '">' +
        label +
        '<button type="button" class="product-edit-file-tag-remove" data-type="existing" data-fi="' + fi + '" aria-label="移除">&times;</button>' +
        '</span>';
    });

    editPendingInspectionFiles.forEach(function (f, fi) {
      html += '<span class="product-edit-file-tag" data-type="pending" data-fi="' + fi + '">' +
        escapeHtml(f.fileName || '待上传') + ' (待上传)' +
        '<button type="button" class="product-edit-file-tag-remove" data-type="pending" data-fi="' + fi + '" aria-label="移除">&times;</button>' +
        '</span>';
    });

    if (!html) {
      wrap.innerHTML = '<span class="product-edit-synced-empty">暂无查验图片</span>';
      return;
    }
    wrap.innerHTML = html;
  }

  function applyInspectionFilesToProduct(updated) {
    updated.productFiles = editInspectionFiles.map(function (f) {
      return {
        fileName: f.fileName || '',
        url: f.url || '',
        uploadedAt: f.uploadedAt || '',
        _removed: !!f._removed
      };
    });
    updated.pendingProductFiles = editPendingInspectionFiles.map(function (f) {
      return {
        fileName: f.fileName || '',
        dataUrl: f.dataUrl || ''
      };
    });
    var keptExisting = editInspectionFiles.filter(function (f) { return !f._removed; }).length;
    updated.hasFile = keptExisting > 0 || editPendingInspectionFiles.length > 0;
  }

  function bindInspectionFileInput() {
    var input = document.getElementById('edit_inspection_file_input');
    var tagsWrap = document.getElementById('edit_inspection_file_tags');
    if (!input) return;

    input.addEventListener('change', function () {
      var files = input.files;
      if (!files || !files.length) return;
      var tasks = [];
      for (var i = 0; i < files.length; i++) {
        (function (file) {
          tasks.push(new Promise(function (resolve) {
            var reader = new FileReader();
            reader.onload = function () {
              resolve({ fileName: file.name, dataUrl: reader.result });
            };
            reader.onerror = function () { resolve(null); };
            reader.readAsDataURL(file);
          }));
        })(files[i]);
      }
      Promise.all(tasks).then(function (results) {
        results.forEach(function (item) {
          if (item && item.dataUrl) editPendingInspectionFiles.push(item);
        });
        input.value = '';
        renderInspectionFileTags();
      });
    });

    if (tagsWrap) {
      tagsWrap.addEventListener('click', function (e) {
        var btn = e.target.closest('.product-edit-file-tag-remove');
        if (!btn) return;
        var type = btn.getAttribute('data-type');
        var fi = parseInt(btn.getAttribute('data-fi'), 10);
        if (type === 'existing' && editInspectionFiles[fi]) {
          editInspectionFiles[fi]._removed = true;
        } else if (type === 'pending') {
          editPendingInspectionFiles.splice(fi, 1);
        }
        renderInspectionFileTags();
      });
    }
  }

  function getBrandNameForProduct(row) {
    if (!row || !row.brandAuthId) return '';
    var auth = getBrandAuthById(row.brandAuthId);
    if (!auth) return '';
    var name = auth.brandName ? String(auth.brandName).trim() : '';
    var code = auth.brandCode ? String(auth.brandCode).trim() : '';
    if (name && code) return name + '（' + code + '）';
    return name || code;
  }

  function buildBrandAuthCodeCell(row) {
    var name = getBrandNameForProduct(row);
    if (!name) return formatCell('');
    return '<span class="product-brand-auth-code">' + escapeHtml(name) + '</span>';
  }

  function filterBrandAuthOptionsForQuery(keyword) {
    var options = getBrandAuthOptionsForCustomer(editCustomerCode);
    var k = norm(keyword);
    if (!k) return options;
    return options.filter(function (row) {
      return includesNormalized(row.brandCode, k) ||
        includesNormalized(row.brandName, k) ||
        includesNormalized(formatBrandAuthOptionLabel(row), k);
    });
  }

  function hideBrandAuthDropdown() {
    var dropdown = document.getElementById('edit_brand_auth_dropdown');
    if (dropdown) dropdown.style.display = 'none';
  }

  function selectBrandAuthOption(id) {
    var hidden = document.getElementById('edit_brand_auth_bind');
    var query = document.getElementById('edit_brand_auth_query');
    var auth = id ? getBrandAuthById(id) : null;
    if (hidden) hidden.value = auth ? auth.id : '';
    if (query) query.value = auth ? formatBrandAuthOptionLabel(auth) : '';
    hideBrandAuthDropdown();
    applyBrandAuthSync(auth);
    showEditError('');
  }

  function clearBrandAuthCombobox() {
    var hidden = document.getElementById('edit_brand_auth_bind');
    var query = document.getElementById('edit_brand_auth_query');
    if (hidden) hidden.value = '';
    if (query) query.value = '';
    hideBrandAuthDropdown();
    applyBrandAuthSync(null);
  }

  function renderBrandAuthDropdown(keyword) {
    var dropdown = document.getElementById('edit_brand_auth_dropdown');
    if (!dropdown) return;
    var options = filterBrandAuthOptionsForQuery(keyword);
    if (!options.length) {
      dropdown.innerHTML = '<li class="product-brand-auth-dropdown-empty">无匹配品牌授权</li>';
      dropdown.style.display = 'block';
      return;
    }
    dropdown.innerHTML = options.map(function (row) {
      return '<li class="product-brand-auth-dropdown-item" data-id="' + escapeHtml(row.id) + '" role="option">' +
        escapeHtml(formatBrandAuthOptionLabel(row)) + '</li>';
    }).join('');
    dropdown.style.display = 'block';
    dropdown.querySelectorAll('.product-brand-auth-dropdown-item').forEach(function (li) {
      li.addEventListener('mousedown', function (e) {
        e.preventDefault();
        selectBrandAuthOption(li.getAttribute('data-id'));
      });
    });
  }

  function setupBrandAuthCombobox(record) {
    clearBrandAuthCombobox();
    if (record && record.brandAuthId) {
      var auth = getBrandAuthById(record.brandAuthId);
      if (auth) {
        selectBrandAuthOption(record.brandAuthId);
      } else {
        var hidden = document.getElementById('edit_brand_auth_bind');
        var query = document.getElementById('edit_brand_auth_query');
        if (hidden) hidden.value = record.brandAuthId;
        if (query) query.value = record.brandAuthId;
      }
    }
  }

  function bindBrandAuthCombobox() {
    var query = document.getElementById('edit_brand_auth_query');
    var combobox = document.getElementById('edit_brand_auth_combobox');
    if (!query || query.getAttribute('data-combobox-bound') === '1') return;
    query.setAttribute('data-combobox-bound', '1');

    query.addEventListener('focus', function () {
      renderBrandAuthDropdown(query.value);
    });
    query.addEventListener('input', function () {
      var hidden = document.getElementById('edit_brand_auth_bind');
      if (hidden) hidden.value = '';
      applyBrandAuthSync(null);
      renderBrandAuthDropdown(query.value);
    });
    query.addEventListener('blur', function () {
      window.setTimeout(hideBrandAuthDropdown, 150);
    });

    document.addEventListener('click', function (e) {
      if (!combobox || combobox.contains(e.target)) return;
      hideBrandAuthDropdown();
    });
  }

  function applyBrandAuthSync(authRecord) {
    var expireEl = document.getElementById('edit_file_expire');
    if (!authRecord) {
      if (expireEl) expireEl.value = '';
      return;
    }
    if (expireEl) expireEl.value = authRecord.expireDate || '-';
  }

  function updateBrandAuthBindingVisibility(category) {
    var show = needsBrandAuthBinding(category);
    var authRow = document.getElementById('edit_brand_auth_row');
    var expireRow = document.getElementById('edit_synced_expire_row');
    if (authRow) authRow.style.display = show ? '' : 'none';
    if (expireRow) expireRow.style.display = show ? '' : 'none';
    if (!show) {
      clearBrandAuthCombobox();
    }
  }

  function fillBrandAuthBindingSelect(record) {
    setupBrandAuthCombobox(record);
  }

  function persistBrandAuthList(payload) {
    return fetch(BRAND_AUTH_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ list: payload || brandAuthList })
    }).then(function (res) { return res.json(); });
  }

  function syncProductCodeToBrandAuth(brandAuthId, productCode) {
    if (!brandAuthId || !productCode) return Promise.resolve();
    var working = JSON.parse(JSON.stringify(brandAuthList));
    var target = null;
    for (var i = 0; i < working.length; i++) {
      if (working[i].id === brandAuthId) {
        target = working[i];
        if (!Array.isArray(target.authorizedProducts)) target.authorizedProducts = [];
        var code = String(productCode).trim();
        if (code && target.authorizedProducts.indexOf(code) === -1) {
          target.authorizedProducts.push(code);
          target.updateTime = formatDateTime();
        }
        break;
      }
    }
    if (!target) return Promise.resolve();
    return persistBrandAuthList(working).then(function (body) {
      if (body && body.list) brandAuthList = body.list;
      else brandAuthList = working;
      return body;
    });
  }

  function isEditModalOpen() {
    var backdrop = document.getElementById('productEditModalBackdrop');
    return backdrop && backdrop.style.display === 'flex';
  }

  function refreshEditModalBrandAuthSync() {
    if (!isEditModalOpen()) return;
    var categoryEl = document.getElementById('edit_brand_category');
    if (!categoryEl || !needsBrandAuthBinding(categoryEl.value)) return;
    var bindEl = document.getElementById('edit_brand_auth_bind');
    if (!bindEl || !bindEl.value) {
      applyBrandAuthSync(null);
      return;
    }
    applyBrandAuthSync(getBrandAuthById(bindEl.value));
  }

  function reloadFromServer() {
    if (typeof fetch === 'undefined') return Promise.resolve();
    return Promise.all([
      fetch(API_PATH, { method: 'GET' }).then(function (res) { return res.json(); }),
      fetch(BRAND_AUTH_API, { method: 'GET' }).then(function (res) { return res.json(); })
    ]).then(function (results) {
      var productBody = results[0];
      var brandBody = results[1];
      if (productBody && Array.isArray(productBody.list)) {
        list = JSON.parse(JSON.stringify(productBody.list));
      }
      if (brandBody && Array.isArray(brandBody.list)) {
        brandAuthList = JSON.parse(JSON.stringify(brandBody.list));
      }
      refresh(false);
      refreshEditModalBrandAuthSync();
    }).catch(function () {});
  }

  function startSyncPolling() {
    if (syncPollTimer || typeof fetch === 'undefined') return;
    syncPollTimer = setInterval(function () {
      if (document.visibilityState === 'hidden') return;
      reloadFromServer();
    }, SYNC_POLL_MS);
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'visible') reloadFromServer();
    });
    window.addEventListener('focus', function () {
      reloadFromServer();
    });
  }

  function getSensitiveMark(row) {
    if (row.sensitiveMark) return row.sensitiveMark;
    return row.specialAttr === '带电' || row.specialAttr === '液体' ||
      row.specialAttr === '粉末' || row.specialAttr === '磁性' ? '是' : '否';
  }

  function fillSelect(id, options, keepAll) {
    var el = document.getElementById(id);
    if (!el) return;
    var html = keepAll ? '<option value="">全部</option>' : '';
    options.forEach(function (name) {
      html += '<option value="' + escapeHtml(name) + '">' + escapeHtml(name) + '</option>';
    });
    el.innerHTML = html;
  }

  function initFilters() {
    if (typeof MOCK_PRODUCT_CATEGORY_L1 !== 'undefined') {
      fillSelect('q_category_l1', MOCK_PRODUCT_CATEGORY_L1, true);
    }
    if (typeof MOCK_PRODUCT_CATEGORY_L2 !== 'undefined') {
      fillSelect('q_category_l2', MOCK_PRODUCT_CATEGORY_L2, true);
    }
    if (typeof MOCK_PRODUCT_CATEGORY_L3 !== 'undefined') {
      fillSelect('q_category_l3', MOCK_PRODUCT_CATEGORY_L3, true);
    }
    if (typeof MOCK_PRODUCT_MEASURE_STATUS !== 'undefined') {
      fillSelect('q_measure_status', MOCK_PRODUCT_MEASURE_STATUS, true);
    }
    if (typeof MOCK_PRODUCT_SPECIAL_ATTR !== 'undefined') {
      fillSelect('q_special_attr', MOCK_PRODUCT_SPECIAL_ATTR, true);
    }
    if (typeof MOCK_PRODUCT_SENSITIVE_MARK !== 'undefined') {
      fillSelect('q_sensitive_mark', MOCK_PRODUCT_SENSITIVE_MARK, true);
    }
  }

  function getFilters() {
    return {
      userCode: val('q_user_code').trim(),
      productCode: val('q_product_code').trim(),
      yundeNo: val('q_yunde_no').trim(),
      productName: val('q_product_name').trim(),
      upc: val('q_upc').trim(),
      categoryL1: val('q_category_l1'),
      categoryL2: val('q_category_l2'),
      categoryL3: val('q_category_l3'),
      measureStatus: val('q_measure_status'),
      specialAttr: val('q_special_attr'),
      sensitiveMark: val('q_sensitive_mark')
    };
  }

  function rowMatches(f, row) {
    if (!includesNormalized(row.userCode, f.userCode)) return false;
    if (!includesNormalized(row.productCode, f.productCode)) return false;
    if (!includesNormalized(row.yundeNo, f.yundeNo)) return false;
    if (!includesNormalized(row.productName, f.productName)) return false;
    if (!includesNormalized(row.upc, f.upc)) return false;
    if (f.categoryL1 && row.categoryL1 !== f.categoryL1) return false;
    if (f.categoryL2 && row.categoryL2 !== f.categoryL2) return false;
    if (f.categoryL3 && row.categoryL3 !== f.categoryL3) return false;
    if (f.measureStatus && row.measureStatus !== f.measureStatus) return false;
    if (f.specialAttr && row.specialAttr !== f.specialAttr) return false;
    if (f.sensitiveMark && getSensitiveMark(row) !== f.sensitiveMark) return false;
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

  function buildAuditStatus(row) {
    var auditText = row.auditStatus || '-';
    var measureText = row.measureStatus || '-';
    var cls = 'product-audit-status';
    if (row.auditStatus === '待审核') cls = 'product-audit-status-pending';
    else if (row.measureStatus === '测量中') cls = 'product-audit-status-measuring';
    return '<span class="' + cls + '">' + escapeHtml(auditText) + ' | ' + escapeHtml(measureText) + '</span>';
  }

  function buildImageLink(row) {
    if (row.hasImage) {
      return '<a href="#" class="product-link" data-action="viewImage" data-id="' + escapeHtml(row.id) + '">查看图片</a>';
    }
    return '<span class="product-link-muted">暂无图片</span>';
  }

  function buildFileLink(row) {
    var files = Array.isArray(row.productFiles) ? row.productFiles : [];
    if (row.hasFile || files.length) {
      return '<a href="#" class="product-link" data-action="viewFile" data-id="' + escapeHtml(row.id) + '">查看查验图片</a>';
    }
    return '<span class="product-link-muted">暂无查验图片</span>';
  }

  function buildOps(row) {
    return (
      '<a href="#" class="product-op-link" data-action="edit" data-id="' + escapeHtml(row.id) + '">编辑</a>' +
      '<a href="#" class="product-op-link" data-action="log" data-id="' + escapeHtml(row.id) + '">日志</a>'
    );
  }

  function renderTable(rows) {
    var tbody = document.getElementById('product-list-tbody');
    if (!tbody) return;

    var pageList = getPageList(rows);

    if (!pageList.length) {
      tbody.innerHTML =
        '<tr><td colspan="29"><p style="color:red;text-align:center;margin:12px 0;">暂无数据</p></td></tr>';
      return;
    }

    tbody.innerHTML = pageList
      .map(function (row) {
        return (
          '<tr>' +
          '<td>' + escapeHtml(row.userCode) + '</td>' +
          '<td>' + escapeHtml(row.productCode) + '</td>' +
          '<td>' + escapeHtml(row.yundeNo) + '</td>' +
          '<td class="td-left">' + escapeHtml(row.productName) + '</td>' +
          '<td class="td-left">' + formatCell(row.brand) + '</td>' +
          '<td>' + escapeHtml(row.category) + '</td>' +
          '<td>' + formatCell(row.model) + '</td>' +
          '<td>' + formatNumber(row.weightKg, 2) + '</td>' +
          '<td>' + formatNumber(row.chargeWeightKg, 2) + '</td>' +
          '<td>' + formatNumber(row.volumeM3, 4) + '</td>' +
          '<td>' + formatNumber(row.chargeVolumeM3, 4) + '</td>' +
          '<td>' + formatCell(row.packSpec) + '</td>' +
          '<td>' + formatCell(row.chargeSpec) + '</td>' +
          '<td>' + formatSpecialAttrCell(row) + '</td>' +
          '<td class="td-left">' + escapeHtml(row.nameCn) + '</td>' +
          '<td class="td-left">' + escapeHtml(row.nameEn) + '</td>' +
          '<td>' + formatNumber(row.declarePrice, 2) + '</td>' +
          '<td>' + formatCell(row.upc) + '</td>' +
          '<td>' + formatCell(row.hsCode) + '</td>' +
          '<td>' + formatCell(row.unCode) + '</td>' +
          '<td>' + formatCell(row.sizeType) + '</td>' +
          '<td>' + buildAuditStatus(row) + '</td>' +
          '<td>' + escapeHtml(row.status) + '</td>' +
          '<td>' + escapeHtml(row.sizeStandard) + '</td>' +
          '<td>' + buildImageLink(row) + '</td>' +
          '<td>' + buildFileLink(row) + '</td>' +
          '<td>' + buildBrandAuthCodeCell(row) + '</td>' +
          '<td>' + formatCell(row.fileExpireDate) + '</td>' +
          '<td class="button">' + buildOps(row) + '</td>' +
          '</tr>'
        );
      })
      .join('');

    tbody.querySelectorAll('[data-action]').forEach(function (a) {
      a.addEventListener('click', function (e) {
        e.preventDefault();
        var action = a.getAttribute('data-action');
        var id = a.getAttribute('data-id');
        var record = getById(id);
        if (action === 'edit') openEditModal(record);
        else if (action === 'log') openProductLogModal(record);
        else if (action === 'viewImage') window.alert('查看图片（原型）：产品 id=' + id);
        else if (action === 'viewFile') viewProductFiles(record);
      });
    });
  }

  function viewProductFiles(record) {
    if (!record) return;
    var files = Array.isArray(record.productFiles) ? record.productFiles : [];
    if (!files.length) {
      window.alert('暂无查验图片');
      return;
    }
    var msg = files.map(function (f, i) {
      return (i + 1) + '. ' + (f.fileName || f.url || '图片');
    }).join('\n');
    window.alert('查验图片：\n' + msg);
  }

  function showEditError(msg) {
    var el = document.getElementById('productEditError');
    if (!el) return;
    if (msg) {
      el.textContent = msg;
      el.style.display = 'block';
    } else {
      el.textContent = '';
      el.style.display = 'none';
    }
  }

  function initEditSelects() {
    var brandCat = document.getElementById('edit_brand_category');
    var status = document.getElementById('edit_product_status');
    if (brandCat && !brandCat.options.length) {
      getBrandCategoryOptions().forEach(function (opt) {
        brandCat.innerHTML += '<option value="' + escapeHtml(opt) + '">' + escapeHtml(opt) + '</option>';
      });
    }
    if (status && !status.options.length) {
      getProductStatusOptions().forEach(function (opt) {
        status.innerHTML += '<option value="' + escapeHtml(opt) + '">' + escapeHtml(opt) + '</option>';
      });
    }
  }

  function renderSpecialAttrCheckboxes(selected) {
    var wrap = document.getElementById('edit_special_attrs');
    if (!wrap) return;
    var selSet = {};
    (selected || []).forEach(function (s) { selSet[s] = true; });
    wrap.innerHTML = getSpecialAttrOptions().map(function (opt) {
      var checked = selSet[opt] ? ' checked' : '';
      return '<label><input type="checkbox" class="edit-special-attr-cb" value="' + escapeHtml(opt) + '"' + checked + ' />' +
        escapeHtml(opt) + '</label>';
    }).join('');
  }

  function openEditModal(record) {
    if (!record) return;
    editRecordId = record.id;
    editCustomerCode = record.userCode || '';

    initEditSelects();
    document.getElementById('edit_name_en').value = record.nameEn || '';
    renderSpecialAttrCheckboxes(getRecordSpecialAttrs(record));
    document.getElementById('edit_brand_category').value = record.brandCategory || '未设置';
    document.getElementById('edit_brand').value = record.brand || '';
    document.getElementById('edit_product_status').value = record.productStatus || record.auditStatus || '终审';
    updateBrandAuthBindingVisibility(record.brandCategory || '未设置');
    fillBrandAuthBindingSelect(record);
    loadInspectionFilesFromRecord(record);
    showEditError('');
    document.getElementById('productEditModalBackdrop').style.display = 'flex';
  }

  function closeEditModal() {
    document.getElementById('productEditModalBackdrop').style.display = 'none';
    editRecordId = '';
    editCustomerCode = '';
    resetInspectionFileState();
    showEditError('');
  }

  function collectEditForm() {
    var specialAttrs = [];
    document.querySelectorAll('.edit-special-attr-cb:checked').forEach(function (cb) {
      specialAttrs.push(cb.value);
    });
    var bindEl = document.getElementById('edit_brand_auth_bind');
    return {
      nameEn: document.getElementById('edit_name_en').value.trim(),
      specialAttrs: specialAttrs,
      brandCategory: document.getElementById('edit_brand_category').value,
      brand: document.getElementById('edit_brand').value.trim(),
      productStatus: document.getElementById('edit_product_status').value,
      brandAuthId: bindEl ? bindEl.value : ''
    };
  }

  function validateEditForm(form) {
    if (!form.nameEn) return '请填写英文申报名称';
    if (!form.specialAttrs.length) return '请至少选择一项特殊属性';
    if (form.brandCategory === '授权品牌' && !form.brand) return '授权品牌需填写涉及品牌';
    if (needsBrandAuthBinding(form.brandCategory) && !form.brandAuthId) {
      return '请选择品牌授权绑定';
    }
    if (needsBrandAuthBinding(form.brandCategory) && !getBrandAuthOptionsForCustomer(editCustomerCode).length) {
      return '当前客户暂无品牌授权记录，请先在品牌授权文件管理中维护';
    }
    return '';
  }

  function persistList(payload) {
    return fetch(API_PATH, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ list: payload || list })
    }).then(function (res) { return res.json(); });
  }

  function saveEditModal() {
    var form = collectEditForm();
    var err = validateEditForm(form);
    if (err) {
      showEditError(err);
      return;
    }
    var workingList = JSON.parse(JSON.stringify(list));
    var idx = -1;
    for (var i = 0; i < workingList.length; i++) {
      if (workingList[i].id === editRecordId) { idx = i; break; }
    }
    if (idx < 0) {
      showEditError('产品不存在或已被删除');
      return;
    }
    var updated = JSON.parse(JSON.stringify(workingList[idx]));
    var oldRecord = JSON.parse(JSON.stringify(workingList[idx]));
    updated.nameEn = form.nameEn;
    updated.specialAttrs = form.specialAttrs.slice();
    updated.specialAttr = form.specialAttrs[0] || '普货';
    updated.brandCategory = form.brandCategory;
    updated.brand = form.brand;
    updated.productStatus = form.productStatus;
    updated.auditStatus = form.productStatus === '终审' || form.productStatus === '初审' ?
      '已审核' : (form.productStatus === '已驳回' ? '已驳回' : '待审核');
    updated.sensitiveMark = form.specialAttrs.some(function (s) {
      return s.indexOf('电') !== -1 || s === '液体' || s === '粉末' || s.indexOf('磁性') !== -1;
    }) ? '是' : '否';

    if (needsBrandAuthBinding(form.brandCategory)) {
      var authRecord = getBrandAuthById(form.brandAuthId);
      if (!authRecord) {
        showEditError('所选品牌授权不存在');
        return;
      }
      updated.brandAuthId = form.brandAuthId;
      updated.fileExpireDate = authRecord.expireDate || '';
    } else {
      updated.brandAuthId = '';
      updated.fileExpireDate = '';
    }

    applyInspectionFilesToProduct(updated);

    var brandAuthChanges = buildProductBrandAuthChanges(oldRecord, updated);
    if (brandAuthChanges.length) {
      appendProductOperationLog(updated, '编辑', brandAuthChanges, {
        relationDesc: buildProductEditRelationDesc(brandAuthChanges)
      });
    }

    workingList[idx] = updated;
    var productCode = updated.productCode || '';
    var brandAuthId = form.brandAuthId;

    var saveBtn = document.getElementById('productEditSave');
    if (saveBtn) saveBtn.disabled = true;
    persistList(workingList)
      .then(function (body) {
        if (body && body.error) throw new Error(body.error);
        if (body && body.list) list = body.list;
        else list = workingList;
        if (needsBrandAuthBinding(form.brandCategory) && brandAuthId && productCode) {
          return syncProductCodeToBrandAuth(brandAuthId, productCode);
        }
      })
      .then(function () {
        closeEditModal();
        refresh(false);
      })
      .catch(function (e) {
        showEditError(e.message || '保存失败，请重试');
      })
      .finally(function () {
        if (saveBtn) saveBtn.disabled = false;
      });
  }

  function openProductLogModal(record) {
    if (!record) return;
    var title = document.getElementById('productLogModalTitle');
    var subtitle = document.getElementById('productLogSubtitle');
    var tbody = document.getElementById('productLogTbody');
    if (title) {
      title.textContent = '操作日志 · ' + (record.productCode || record.yundeNo || '-');
    }
    if (subtitle) {
      subtitle.textContent = '产品编号：' + (record.productCode || '-') +
        '　运德编号：' + (record.yundeNo || '-') +
        '　用户编号：' + (record.userCode || '-');
    }
    var logs = (record.operationLogs || []).slice().sort(function (a, b) {
      return String(b.time || '').localeCompare(String(a.time || ''));
    });
    if (!tbody) return;
    if (!logs.length) {
      tbody.innerHTML = '<tr><td colspan="4" class="product-log-empty">暂无操作日志</td></tr>';
    } else {
      tbody.innerHTML = logs.map(function (log) {
        var relationHtml = log.relationDesc ?
          '<p class="product-log-relation">' + escapeHtml(log.relationDesc) + '</p>' : '';
        return (
          '<tr>' +
          '<td>' + formatCell(log.time) + '</td>' +
          '<td>' + formatCell(log.operator) + '</td>' +
          '<td>' + formatCell(log.action) + '</td>' +
          '<td>' + relationHtml + formatProductChangesHtml(log.changes) + '</td>' +
          '</tr>'
        );
      }).join('');
    }
    document.getElementById('productLogModalBackdrop').style.display = 'flex';
  }

  function closeProductLogModal() {
    document.getElementById('productLogModalBackdrop').style.display = 'none';
  }

  function bindEditModal() {
    ['productEditModalClose', 'productEditCancel'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.addEventListener('click', closeEditModal);
    });
    var backdrop = document.getElementById('productEditModalBackdrop');
    if (backdrop) {
      backdrop.addEventListener('click', function (e) {
        if (e.target === backdrop) closeEditModal();
      });
    }
    var saveBtn = document.getElementById('productEditSave');
    if (saveBtn) saveBtn.addEventListener('click', saveEditModal);

    var brandCat = document.getElementById('edit_brand_category');
    if (brandCat) {
      brandCat.addEventListener('change', function () {
        updateBrandAuthBindingVisibility(brandCat.value);
        fillBrandAuthBindingSelect(null);
      });
    }

    var bindSel = document.getElementById('edit_brand_auth_bind');
    if (bindSel) bindBrandAuthCombobox();

    ['productLogModalClose', 'productLogModalOk'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.addEventListener('click', closeProductLogModal);
    });
    var logBackdrop = document.getElementById('productLogModalBackdrop');
    if (logBackdrop) {
      logBackdrop.addEventListener('click', function (e) {
        if (e.target === logBackdrop) closeProductLogModal();
      });
    }

    bindInspectionFileInput();
  }

  function renderPagination(total) {
    var paginationEl = document.getElementById('product-pagination');
    if (!paginationEl) return;

    var totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    if (currentPage > totalPages) currentPage = totalPages;

    var start = total === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1;
    var end = Math.min(currentPage * PAGE_SIZE, total);

    var html = '<span style="color:#878787;">共 ' + total + ' 条，每页 ' + PAGE_SIZE + ' 条，显示 ' + start + '-' + end + '，第 ' + currentPage + '/' + totalPages + ' 页</span>';

    html +=
      '<button type="button" data-page="prev"' +
      (currentPage <= 1 ? ' disabled' : '') +
      '>上一页</button>';

    var maxButtons = 7;
    var startPage = Math.max(1, currentPage - Math.floor(maxButtons / 2));
    var endPage = Math.min(totalPages, startPage + maxButtons - 1);
    if (endPage - startPage < maxButtons - 1) {
      startPage = Math.max(1, endPage - maxButtons + 1);
    }

    for (var i = startPage; i <= endPage; i++) {
      html +=
        '<button type="button" data-page="' + i + '"' +
        (i === currentPage ? ' style="background-color:#007fbf;"' : '') +
        '>' + i + '</button>';
    }

    html +=
      '<button type="button" data-page="next"' +
      (currentPage >= totalPages ? ' disabled' : '') +
      '>下一页</button>';

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
    var hint = document.getElementById('product-result-hint');
    if (hint) {
      var totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
      hint.textContent =
        '共 ' + rows.length + ' 条，每页 ' + PAGE_SIZE + ' 条，当前第 ' + currentPage + ' / ' + totalPages + ' 页';
    }
  }

  function resetForm() {
    [
      'q_user_code', 'q_product_code', 'q_yunde_no', 'q_product_name', 'q_upc',
      'q_category_l1', 'q_category_l2', 'q_category_l3',
      'q_measure_status', 'q_special_attr', 'q_sensitive_mark'
    ].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.value = '';
    });
    refresh(true);
  }

  function bind() {
    bindEditModal();
    var q = document.getElementById('btn_product_query');
    var r = document.getElementById('btn_product_reset');
    if (q) q.addEventListener('click', function () { refresh(true); });
    if (r) r.addEventListener('click', resetForm);

    ['q_user_code', 'q_product_code', 'q_yunde_no', 'q_product_name', 'q_upc'].forEach(function (id) {
      var el = document.getElementById(id);
      if (!el) return;
      el.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') {
          e.preventDefault();
          refresh(true);
        }
      });
    });

    [
      'q_category_l1', 'q_category_l2', 'q_category_l3',
      'q_measure_status', 'q_special_attr', 'q_sensitive_mark'
    ].forEach(function (id) {
      var el = document.getElementById(id);
      if (!el) return;
      el.addEventListener('change', function () { refresh(true); });
    });

    var batchBtn = document.getElementById('btn_batch_import_sensitive');
    var exportBtn = document.getElementById('btn_export');
    var exportMeasureBtn = document.getElementById('btn_export_measure');
    if (batchBtn) {
      batchBtn.addEventListener('click', function () {
        window.alert('批量导入涉腾标识（原型）：请选择 Excel 文件上传');
      });
    }
    if (exportBtn) {
      exportBtn.addEventListener('click', function () {
        window.alert('导出（原型）：将导出当前筛选结果 ' + filtered().length + ' 条产品信息');
      });
    }
    if (exportMeasureBtn) {
      exportMeasureBtn.addEventListener('click', function () {
        window.alert('导出测量记录（原型）：将导出已测量产品的尺寸/重量记录');
      });
    }
  }

  function init() {
    initFilters();
    bind();
    if (typeof fetch !== 'undefined') {
      Promise.all([
        fetch(API_PATH, { method: 'GET' }).then(function (res) { return res.json(); }),
        fetch(BRAND_AUTH_API, { method: 'GET' }).then(function (res) { return res.json(); })
      ])
        .then(function (results) {
          var productBody = results[0];
          var brandBody = results[1];
          if (productBody && Array.isArray(productBody.list)) {
            list = JSON.parse(JSON.stringify(productBody.list));
          }
          if (brandBody && Array.isArray(brandBody.list)) {
            brandAuthList = JSON.parse(JSON.stringify(brandBody.list));
          }
          refresh(true);
          startSyncPolling();
        })
        .catch(function () {
          refresh(true);
          startSyncPolling();
        });
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
