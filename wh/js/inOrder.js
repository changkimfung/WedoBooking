/**
 * 仓储中台 · 入库单管理列表
 * 依赖：MOCK_IN_ORDER_LIST、MOCK_IN_ORDER_WAREHOUSES、MOCK_IN_ORDER_SHIPPING_METHODS
 */
(function () {
  var PAGE_SIZE = 10;
  var currentPage = 1;

  var raw = typeof MOCK_IN_ORDER_LIST !== 'undefined' ? MOCK_IN_ORDER_LIST : [];
  var list = JSON.parse(JSON.stringify(raw));

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

  function getStatusClass(status) {
    var pending = ['待提交', '待国内收货'];
    var transit = ['运输在途'];
    var received = ['国内已收货', '海外仓已收货'];
    if (pending.indexOf(status) !== -1) return 'inorder-status-pending';
    if (transit.indexOf(status) !== -1) return 'inorder-status-transit';
    if (received.indexOf(status) !== -1) return 'inorder-status-received';
    if (status === '已取消') return 'inorder-status-cancelled';
    if (status === '异常') return 'inorder-status-error';
    return 'inorder-status-default';
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
    if (typeof MOCK_IN_ORDER_WAREHOUSES !== 'undefined') {
      fillSelect('q_warehouse', MOCK_IN_ORDER_WAREHOUSES, true);
    }
    if (typeof MOCK_IN_ORDER_SHIPPING_METHODS !== 'undefined') {
      fillSelect('q_shipping_method', MOCK_IN_ORDER_SHIPPING_METHODS, true);
    }
    var statusSet = {};
    list.forEach(function (row) {
      if (row.status) statusSet[row.status] = true;
    });
    fillSelect('q_status', Object.keys(statusSet), true);
  }

  function getFilters() {
    return {
      orderNo: val('q_order_no').trim(),
      warehouse: val('q_warehouse'),
      shippingMethod: val('q_shipping_method'),
      trackingNo: val('q_tracking_no').trim(),
      status: val('q_status')
    };
  }

  function rowMatches(f, row) {
    if (!includesNormalized(row.orderNo, f.orderNo)) return false;
    if (f.warehouse && row.warehouse !== f.warehouse) return false;
    if (f.shippingMethod && row.shippingMethod !== f.shippingMethod) return false;
    if (f.trackingNo && !includesNormalized(row.trackingNo, f.trackingNo)) return false;
    if (f.status && row.status !== f.status) return false;
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

  function buildOps(row) {
    var html =
      '<a href="#" class="inorder-op-link" data-action="view" data-id="' + escapeHtml(row.id) + '">查看</a>' +
      '<a href="#" class="inorder-op-link" data-action="log" data-id="' + escapeHtml(row.id) + '">日志</a>';
    if (row.status === '待提交' || row.status === '待国内收货') {
      html +=
        '<a href="#" class="inorder-op-link" data-action="audit" data-id="' + escapeHtml(row.id) + '">审核</a>';
    }
    return html;
  }

  function renderTable(rows) {
    var tbody = document.getElementById('inorder-list-tbody');
    if (!tbody) return;

    var pageList = getPageList(rows);

    if (!pageList.length) {
      tbody.innerHTML =
        '<tr><td colspan="15"><p style="color:red;text-align:center;margin:12px 0;">暂无数据</p></td></tr>';
      return;
    }

    tbody.innerHTML = pageList
      .map(function (row) {
        var statusCls = getStatusClass(row.status);
        var sub = row.subStatus ? '（' + escapeHtml(row.subStatus) + '）' : '';
        return (
          '<tr>' +
          '<td>' + escapeHtml(row.orderNo) + '</td>' +
          '<td>' + escapeHtml(row.userCode || 'CN0000438') + '</td>' +
          '<td>' + escapeHtml(row.warehouse) + '</td>' +
          '<td class="td-left">' + escapeHtml(row.shippingMethod) + '</td>' +
          '<td>' + formatCell(row.trackingNo) + '</td>' +
          '<td>' + formatCell(row.logisticsQuoteNo) + '</td>' +
          '<td>' + formatNumber(row.grossWeight, 4) + '</td>' +
          '<td>' + formatNumber(row.chargeableWeight, 4) + '</td>' +
          '<td>' + formatNumber(row.volume, 4) + '</td>' +
          '<td>' + escapeHtml(row.totalQty) + '</td>' +
          '<td>' + escapeHtml(row.receivedQty) + '</td>' +
          '<td>' + escapeHtml(row.createDate) + '</td>' +
          '<td><span class="inorder-status ' + statusCls + '">' + escapeHtml(row.status) + sub + '</span></td>' +
          '<td class="td-left">' + formatCell(row.remark) + '</td>' +
          '<td class="button">' + buildOps(row) + '</td>' +
          '</tr>'
        );
      })
      .join('');

    tbody.querySelectorAll('.inorder-op-link').forEach(function (a) {
      a.addEventListener('click', function (e) {
        e.preventDefault();
        var action = a.getAttribute('data-action');
        var id = a.getAttribute('data-id');
        var labels = { view: '查看', log: '操作日志', audit: '审核' };
        window.alert((labels[action] || action) + '（原型）：入库单 id=' + id);
      });
    });
  }

  function renderPagination(total) {
    var paginationEl = document.getElementById('inorder-pagination');
    if (!paginationEl) return;

    var totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    if (currentPage > totalPages) currentPage = totalPages;

    var html = '<span style="color:#878787;">共 ' + total + ' 条</span>';

    html +=
      '<button type="button" data-page="prev"' +
      (currentPage <= 1 ? ' disabled' : '') +
      '>上一页</button>';

    for (var i = 1; i <= totalPages; i++) {
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
    var hint = document.getElementById('inorder-result-hint');
    if (hint) {
      hint.textContent =
        '共 ' + rows.length + ' 条，当前第 ' + currentPage + ' / ' + Math.max(1, Math.ceil(rows.length / PAGE_SIZE)) + ' 页（每页 ' + PAGE_SIZE + ' 条）';
    }
  }

  function resetForm() {
    ['q_order_no', 'q_warehouse', 'q_shipping_method', 'q_tracking_no', 'q_status'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.value = '';
    });
    refresh(true);
  }

  function bind() {
    var q = document.getElementById('btn_inorder_query');
    var r = document.getElementById('btn_inorder_reset');
    if (q) q.addEventListener('click', function () { refresh(true); });
    if (r) r.addEventListener('click', resetForm);

    ['q_order_no', 'q_tracking_no'].forEach(function (id) {
      var el = document.getElementById(id);
      if (!el) return;
      el.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') {
          e.preventDefault();
          refresh(true);
        }
      });
    });

    ['q_warehouse', 'q_shipping_method', 'q_status'].forEach(function (id) {
      var el = document.getElementById(id);
      if (!el) return;
      el.addEventListener('change', function () { refresh(true); });
    });
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
