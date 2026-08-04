(function () {
  var PAGE_SIZE = 10;
  var C = ProductCommon;
  var state = { activeTab: '已审核', currentPage: 1, filteredList: [], selectedIds: {} };

  function parseMultiInput(text) {
    if (!text || !String(text).trim()) return [];
    return String(text).split(/[\s,，;；\n]+/).map(function (s) { return s.trim(); }).filter(Boolean);
  }

  function includesNormalized(text, keyword) {
    if (!keyword) return true;
    return String(text == null ? '' : text).toLowerCase().indexOf(String(keyword).toLowerCase()) !== -1;
  }

  function getSensitiveMark(row) {
    if (row.sensitiveMark) return row.sensitiveMark;
    return row.specialAttr === '带电' || row.specialAttr === '液体' ||
      row.specialAttr === '粉末' || row.specialAttr === '磁性' ? '是' : '否';
  }

  function specDiff(row) {
    if (!row.packSpec || !row.chargeSpec || row.packSpec === row.chargeSpec) return 0;
    return 1;
  }

  function getFilters() {
    return {
      skus: parseMultiInput(document.getElementById('filterSku').value),
      productCodes: parseMultiInput(document.getElementById('filterProductCode').value),
      productName: document.getElementById('filterProductName').value.trim(),
      upc: document.getElementById('filterUpc').value.trim(),
      specialAttr: document.getElementById('filterSpecialAttr').value,
      category: document.getElementById('filterCategory').value,
      sizeType: document.getElementById('filterSizeType').value,
      auditStatus: document.getElementById('filterAuditStatus').value,
      weightGt: document.getElementById('filterWeightGt').value,
      sizeDiff: document.getElementById('filterSizeDiff').value,
      showImage: document.getElementById('filterShowImage').checked
    };
  }

  function rowMatches(f, row) {
    if (f.skus.length && f.skus.indexOf(row.skuCode || row.productCode) === -1 &&
        !f.skus.some(function (s) { return includesNormalized(row.skuCode || row.productCode, s); })) {
      return false;
    }
    if (f.productCodes.length && f.productCodes.indexOf(row.productCode) === -1 &&
        !f.productCodes.some(function (s) { return includesNormalized(row.productCode, s); })) {
      return false;
    }
    if (!includesNormalized(row.productName, f.productName)) return false;
    if (!includesNormalized(row.upc, f.upc)) return false;
    if (f.specialAttr && row.specialAttr !== f.specialAttr) return false;
    if (f.category && row.category !== f.category) return false;
    if (f.sizeType && row.sizeType !== f.sizeType) return false;
    if (f.auditStatus && row.auditStatus !== f.auditStatus) return false;
    if (state.activeTab && row.auditStatus !== state.activeTab) return false;
    if (f.weightGt && Number(row.weightKg) <= Number(f.weightGt)) return false;
    if (f.sizeDiff && specDiff(row) === 0) return false;
    if (f.showImage && !row.hasImage) return false;
    return true;
  }

  function applyFilters() {
    var f = getFilters();
    state.filteredList = C.getCustomerProducts().filter(function (row) {
      return rowMatches(f, row);
    });
  }

  function renderTabs() {
    var tabsEl = document.getElementById('tabs');
    if (!tabsEl) return;
    var counts = C.countByAuditStatus();
    var tabs = typeof MOCK_PRODUCT_STATUS_TABS !== 'undefined' ? MOCK_PRODUCT_STATUS_TABS : [
      { key: '待审核', label: '待审核' },
      { key: '已审核', label: '已审核' },
      { key: '已驳回', label: '已驳回' }
    ];
    tabsEl.innerHTML = tabs.map(function (tab) {
      var cnt = counts[tab.key] || 0;
      var active = tab.key === state.activeTab ? ' active' : '';
      return '<div class="tab' + active + '" data-key="' + C.escapeHtml(tab.key) + '">' +
        C.escapeHtml(tab.label) + '<span class="product-tab-count">' + cnt + '</span></div>';
    }).join('');
    tabsEl.querySelectorAll('.tab').forEach(function (el) {
      el.addEventListener('click', function () {
        state.activeTab = el.getAttribute('data-key');
        document.getElementById('filterAuditStatus').value = state.activeTab;
        state.currentPage = 1;
        refresh();
      });
    });
  }

  function formatCell(v) {
    if (v === undefined || v === null || v === '') return '-';
    return C.escapeHtml(String(v));
  }

  function formatNum(n, d) {
    if (n === undefined || n === null || n === '') return '-';
    return Number(n).toFixed(d);
  }

  function buildChargeSpecCell(row) {
    var cls = row.packSpec === row.chargeSpec ? 'spec-diff' : 'spec-diff-warn';
    return '<span class="' + cls + '">' + formatCell(row.chargeSpec) + '</span>';
  }

  function buildOps(row) {
    return (
      '<div class="op-dropdown-wrap">' +
      '<button type="button" class="op-dropdown-btn" data-id="' + C.escapeHtml(row.id) + '">操作 ▾</button>' +
      '<div class="op-dropdown-menu">' +
      '<a href="#" data-action="view" data-id="' + C.escapeHtml(row.id) + '">查看</a>' +
      '<a href="#" data-action="edit" data-id="' + C.escapeHtml(row.id) + '">编辑</a>' +
      (row.auditStatus === '已驳回' ? '<a href="#" data-action="resubmit" data-id="' + C.escapeHtml(row.id) + '">重新提交</a>' : '') +
      '<a href="#" data-action="delete" data-id="' + C.escapeHtml(row.id) + '">删除</a>' +
      '</div></div>'
    );
  }

  function renderTable() {
    var tbody = document.getElementById('tableBody');
    if (!tbody) return;
    var start = (state.currentPage - 1) * PAGE_SIZE;
    var pageList = state.filteredList.slice(start, start + PAGE_SIZE);

    if (!pageList.length) {
      tbody.innerHTML = '<tr class="empty-row"><td colspan="23">暂无数据</td></tr>';
      return;
    }

    tbody.innerHTML = pageList.map(function (row) {
      var checked = state.selectedIds[row.id] ? ' checked' : '';
      var imgCell = row.hasImage
        ? '<span class="muted">有图</span>'
        : '<span class="muted">-</span>';
      return (
        '<tr>' +
        '<td><input type="checkbox" class="checkbox row-check" data-id="' + C.escapeHtml(row.id) + '"' + checked + ' /></td>' +
        '<td>' + formatCell(row.productCode) + '</td>' +
        '<td>' + formatCell(row.skuCode || row.productCode) + '</td>' +
        '<td>' + formatCell(row.productName) + '</td>' +
        '<td>' + formatCell(row.category) + '</td>' +
        '<td>' + formatCell(row.productStyle) + '</td>' +
        '<td>' + formatNum(row.weightKg, 2) + '</td>' +
        '<td>' + formatNum(row.chargeWeightKg, 2) + '</td>' +
        '<td>' + formatCell(row.packSpec) + '</td>' +
        '<td>' + buildChargeSpecCell(row) + '</td>' +
        '<td>' + formatCell(row.specialAttr) + '</td>' +
        '<td>' + formatCell(row.nameCn) + '</td>' +
        '<td>' + formatCell(row.nameEn) + '</td>' +
        '<td>' + formatCell(row.upc) + '</td>' +
        '<td>' + formatNum(row.declarePrice, 2) + '</td>' +
        '<td>' + formatCell(row.sizeType) + '</td>' +
        '<td>' + formatCell(row.hsCode) + '</td>' +
        '<td>' + formatCell(getSensitiveMark(row)) + '</td>' +
        '<td>' + (row.hasFile ? '查看文件' : '暂无文件') + '</td>' +
        '<td>' + formatCell(row.fileExpireDate) + '</td>' +
        '<td><span class="status ' + (row.auditStatus === '已审核' ? 'done' : row.auditStatus === '待审核' ? 'pending' : 'error') + '">' + formatCell(row.auditStatus) + '</span></td>' +
        '<td>' + formatCell(row.subBoxNo) + '</td>' +
        '<td>' + buildOps(row) + imgCell + '</td>' +
        '</tr>'
      );
    }).join('');

    tbody.querySelectorAll('.op-dropdown-btn').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        document.querySelectorAll('.op-dropdown-menu.show').forEach(function (m) { m.classList.remove('show'); });
        var menu = btn.nextElementSibling;
        if (menu) menu.classList.toggle('show');
      });
    });

    tbody.querySelectorAll('[data-action]').forEach(function (a) {
      a.addEventListener('click', function (e) {
        e.preventDefault();
        var action = a.getAttribute('data-action');
        var id = a.getAttribute('data-id');
        if (action === 'delete') {
          if (window.confirm('确认删除该产品？')) deleteProduct(id);
          return;
        }
        if (action === 'resubmit') {
          resubmitProduct(id);
          return;
        }
        window.alert((action === 'view' ? '查看' : '编辑') + '（原型）：产品 id=' + id);
      });
    });

    tbody.querySelectorAll('.row-check').forEach(function (cb) {
      cb.addEventListener('change', function () {
        var id = cb.getAttribute('data-id');
        if (cb.checked) state.selectedIds[id] = true;
        else delete state.selectedIds[id];
      });
    });
  }

  function deleteProduct(id) {
    var list = C.getBaseList().filter(function (row) { return row.id !== id; });
    C.persistList(list);
    C.persistListToSource(function (err) {
      if (err) window.alert('删除失败：' + err.message);
      refresh(true);
    });
  }

  function resubmitProduct(id) {
    var list = C.getBaseList();
    var row = list.find(function (r) { return r.id === id; });
    if (!row) return;
    row.auditStatus = '待审核';
    row.rejectReason = '';
    C.persistList(list);
    C.persistListToSource(function (err) {
      if (err) window.alert('提交失败：' + err.message);
      else window.alert('已重新提交，等待中台审核');
      refresh(true);
    });
  }

  function renderPagination() {
    var el = document.getElementById('pagination');
    if (!el) return;
    var total = state.filteredList.length;
    var totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    if (state.currentPage > totalPages) state.currentPage = totalPages;

    var html = '<span class="muted">共 ' + total + ' 条</span>';
    html += '<button type="button" class="page-btn' + (state.currentPage <= 1 ? ' disabled' : '') + '" data-page="prev">上一页</button>';
    for (var i = 1; i <= totalPages; i++) {
      html += '<button type="button" class="page-num' + (i === state.currentPage ? ' active' : '') + '" data-page="' + i + '">' + i + '</button>';
    }
    html += '<button type="button" class="page-btn' + (state.currentPage >= totalPages ? ' disabled' : '') + '" data-page="next">下一页</button>';
    el.innerHTML = html;

    el.querySelectorAll('[data-page]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (btn.classList.contains('disabled')) return;
        var p = btn.getAttribute('data-page');
        if (p === 'prev') state.currentPage -= 1;
        else if (p === 'next') state.currentPage += 1;
        else state.currentPage = parseInt(p, 10);
        renderTable();
        renderPagination();
      });
    });
  }

  function initFilters() {
    var specialSel = document.getElementById('filterSpecialAttr');
    var catSel = document.getElementById('filterCategory');
    var sizeSel = document.getElementById('filterSizeType');
    if (typeof MOCK_PRODUCT_SPECIAL_ATTR !== 'undefined' && specialSel) {
      MOCK_PRODUCT_SPECIAL_ATTR.forEach(function (v) {
        specialSel.innerHTML += '<option value="' + C.escapeHtml(v) + '">' + C.escapeHtml(v) + '</option>';
      });
    }
    if (typeof MOCK_PRODUCT_CUSTOMER_CATEGORIES !== 'undefined' && catSel) {
      MOCK_PRODUCT_CUSTOMER_CATEGORIES.forEach(function (v) {
        catSel.innerHTML += '<option value="' + C.escapeHtml(v) + '">' + C.escapeHtml(v) + '</option>';
      });
    }
    if (typeof MOCK_PRODUCT_SIZE_CATEGORIES !== 'undefined' && sizeSel) {
      MOCK_PRODUCT_SIZE_CATEGORIES.forEach(function (v) {
        sizeSel.innerHTML += '<option value="' + C.escapeHtml(v) + '">' + C.escapeHtml(v) + '</option>';
      });
    }
  }

  function resetFilters() {
    ['filterSku', 'filterProductCode', 'filterProductName', 'filterUpc',
      'filterSpecialAttr', 'filterCategory', 'filterSizeType', 'filterAuditStatus',
      'filterWeightGt', 'filterSizeDiff'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.value = '';
    });
    document.getElementById('filterShowImage').checked = false;
    state.activeTab = '';
    document.getElementById('filterAuditStatus').value = '';
    state.currentPage = 1;
    refresh();
  }

  function refresh(fromSource) {
    function renderAll() {
      applyFilters();
      renderTabs();
      renderTable();
      renderPagination();
    }
    if (fromSource) {
      C.fetchAndApplyMockSource(function (err) {
        if (err) console.warn('拉取源文件失败，使用本地 mock', err);
        renderAll();
      });
    } else {
      renderAll();
    }
  }

  function bind() {
    C.initSidebarMenus();
    document.getElementById('searchBtn').addEventListener('click', function () {
      state.currentPage = 1;
      refresh(false);
    });
    document.getElementById('resetBtn').addEventListener('click', resetFilters);
    document.getElementById('checkAll').addEventListener('change', function (e) {
      var checked = e.target.checked;
      state.filteredList.forEach(function (row) {
        if (checked) state.selectedIds[row.id] = true;
        else delete state.selectedIds[row.id];
      });
      renderTable();
    });

    ['btnBatchImport', 'btnBatchExport', 'btnBatchDelete', 'btnSizeDiffConfirm', 'btnBatchUpdateImport'].forEach(function (id) {
      document.getElementById(id).addEventListener('click', function () {
        window.alert(this.textContent + '（原型）');
      });
    });

    document.addEventListener('click', function () {
      document.querySelectorAll('.op-dropdown-menu.show').forEach(function (m) { m.classList.remove('show'); });
    });

    var params = new URLSearchParams(window.location.search);
    if (params.get('created') === '1') {
      state.activeTab = '待审核';
      document.getElementById('filterAuditStatus').value = '待审核';
    }
  }

  function init() {
    initFilters();
    bind();
    refresh(true);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
