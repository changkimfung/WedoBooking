/**
 * 运德物流系统 · 装柜清单管理
 */
(function () {
  var PAGE_SIZE = 10;
  var currentPage = 1;
  var currentModalItem = null;

  function val(id) {
    var el = document.getElementById(id);
    return el ? String(el.value || '').trim() : '';
  }

  function norm(s) {
    return String(s == null ? '' : s).trim().toLowerCase();
  }

  function escapeHtml(s) {
    if (s == null || s === '') return '';
    var d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
  }

  function formatNumber(num, digits) {
    if (num === undefined || num === null || num === '') return '-';
    return Number(num).toFixed(digits);
  }

  function getList() {
    return typeof MOCK_CONTAINER_LOADING_LIST !== 'undefined' ? MOCK_CONTAINER_LOADING_LIST : [];
  }

  function resolveDestinationWarehouse(raw) {
    var value = String(raw || '').trim();
    if (!value) return '-';
    return value.toLowerCase().indexOf('cn') === 0 ? 'FBA' : value;
  }

  function fillSelect(id, values) {
    var el = document.getElementById(id);
    if (!el) return;
    var existed = {};
    values.forEach(function (value) {
      if (!value || existed[value]) return;
      existed[value] = true;
      var opt = document.createElement('option');
      opt.value = value;
      opt.textContent = value;
      el.appendChild(opt);
    });
  }

  function initFilters() {
    var ports = [];
    var destinations = [];
    var statuses = [];
    getList().forEach(function (item) {
      ports.push(item.portOfLoading);
      destinations.push(item.destinationPort);
      statuses.push(item.status);
    });
    fillSelect('q_port_of_loading', ports);
    fillSelect('q_destination_port', destinations);
    fillSelect('q_status', statuses);
  }

  function inDateRange(etd, start, end) {
    var date = String(etd || '').slice(0, 10);
    if (start && date < start) return false;
    if (end && date > end) return false;
    return true;
  }

  function filtered() {
    var f = {
      containerNo: val('q_container_no'),
      portOfLoading: val('q_port_of_loading'),
      destinationPort: val('q_destination_port'),
      status: val('q_status'),
      etdStart: val('q_etd_start'),
      etdEnd: val('q_etd_end'),
      keyword: val('q_keyword')
    };
    return getList().filter(function (item) {
      if (f.containerNo && norm(item.containerNo).indexOf(norm(f.containerNo)) === -1) return false;
      if (f.portOfLoading && item.portOfLoading !== f.portOfLoading) return false;
      if (f.destinationPort && item.destinationPort !== f.destinationPort) return false;
      if (f.status && item.status !== f.status) return false;
      if (!inDateRange(item.etd, f.etdStart, f.etdEnd)) return false;
      if (f.keyword) {
        var haystack = [
          item.billOfLadingNo,
          item.bookingNo,
          item.vesselVoyage,
          item.carrier,
          item.operator,
          item.sealNo
        ].join(' ');
        if (norm(haystack).indexOf(norm(f.keyword)) === -1) return false;
      }
      return true;
    });
  }

  function renderTable(rows) {
    var tbody = document.getElementById('container-list-tbody');
    var start = (currentPage - 1) * PAGE_SIZE;
    var pageList = rows.slice(start, start + PAGE_SIZE);
    if (!pageList.length) {
      tbody.innerHTML = '<tr><td colspan="18"><p class="container-empty">暂无数据</p></td></tr>';
      return;
    }
    tbody.innerHTML = pageList.map(function (item) {
      return '<tr>' +
        '<td><input type="checkbox"></td>' +
        '<td><a href="javascript:void(0)" class="container-no-link" data-view="' + escapeHtml(item.containerNo) + '">' +
          escapeHtml(item.containerNo) + '</a></td>' +
        '<td>' + escapeHtml(item.containerType) + '</td>' +
        '<td>' + escapeHtml(item.billOfLadingNo) + '</td>' +
        '<td>' + escapeHtml(item.vesselVoyage) + '</td>' +
        '<td>' + escapeHtml(item.portOfLoading) + '</td>' +
        '<td>' + escapeHtml(item.etd) + '</td>' +
        '<td>' + escapeHtml(item.sealNo) + '</td>' +
        '<td>' + escapeHtml(item.destinationPort) + '</td>' +
        '<td><span class="container-tag container-tag-normal">' + escapeHtml(item.status) + '</span></td>' +
        '<td>' + escapeHtml(item.actualLoadedAt) + '</td>' +
        '<td>' + escapeHtml(item.createdAt) + '</td>' +
        '<td>' + escapeHtml(item.preloadedCartons) + '</td>' +
        '<td>' + escapeHtml(item.actualCartons) + '</td>' +
        '<td>' + formatNumber(item.weight, 4) + '</td>' +
        '<td>' + formatNumber(item.volume, 4) + '</td>' +
        '<td>' + escapeHtml(item.operator) + '</td>' +
        '<td class="button"><span class="container-op-stack">' +
          '<a href="javascript:void(0)" class="container-op-link" data-view="' + escapeHtml(item.containerNo) + '">票号详情</a>' +
        '</span></td>' +
        '</tr>';
    }).join('');
    tbody.querySelectorAll('[data-view]').forEach(function (link) {
      link.addEventListener('click', function (e) {
        e.preventDefault();
        openTicketModal(link.getAttribute('data-view'));
      });
    });
  }

  function renderPagination(total) {
    var el = document.getElementById('container-pagination');
    var totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    if (currentPage > totalPages) currentPage = totalPages;
    var html = '<span style="color:#878787;">共 ' + total + ' 条</span>';
    html += '<button type="button" data-page="prev"' + (currentPage <= 1 ? ' disabled' : '') + '>上一页</button>';
    for (var i = 1; i <= totalPages; i++) {
      html += '<button type="button" data-page="' + i + '"' +
        (i === currentPage ? ' style="background-color:#007fbf;"' : '') + '>' + i + '</button>';
    }
    html += '<button type="button" data-page="next"' +
      (currentPage >= totalPages ? ' disabled' : '') + '>下一页</button>';
    el.innerHTML = html;
    el.querySelectorAll('[data-page]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (btn.disabled) return;
        var p = btn.getAttribute('data-page');
        if (p === 'prev') currentPage--;
        else if (p === 'next') currentPage++;
        else currentPage = parseInt(p, 10);
        refresh(false);
      });
    });
  }

  function renderHint(total) {
    var el = document.getElementById('container-result-hint');
    if (!el) return;
    el.textContent = '共 ' + total + ' 条，点击实装箱号可查看实装票号列表；预装箱数与实装箱数在当前原型中保持一致。';
  }

  function findByContainerNo(containerNo) {
    var target = norm(containerNo);
    var list = getList();
    for (var i = 0; i < list.length; i++) {
      if (norm(list[i].containerNo) === target) return list[i];
    }
    return null;
  }

  function renderTicketModal(item) {
    var summary = document.getElementById('container-ticket-summary');
    var tbody = document.getElementById('container-ticket-tbody');
    document.getElementById('container-ticket-title').textContent = '票号详情 - ' + item.containerNo;
    summary.innerHTML =
      '<span>实装箱号：<strong>' + escapeHtml(item.containerNo) + '</strong></span>' +
      '<span>目的港：' + escapeHtml(item.destinationPort) + '</span>' +
      '<span>票号数：' + (item.tickets || []).length + '</span>' +
      '<span>实装箱数：' + escapeHtml(item.actualCartons) + '</span>' +
      '<span>重量：' + formatNumber(item.weight, 4) + ' KG</span>' +
      '<span>体积：' + formatNumber(item.volume, 4) + ' CBM</span>';
    if (!item.tickets || !item.tickets.length) {
      tbody.innerHTML = '<tr><td colspan="11"><p class="container-empty">暂无票号</p></td></tr>';
      return;
    }
    tbody.innerHTML = item.tickets.map(function (ticket) {
      return '<tr>' +
        '<td>' + escapeHtml(ticket.ticketNo) + '</td>' +
        '<td>' + escapeHtml(ticket.customerCode) + '</td>' +
        '<td>' + escapeHtml(ticket.customerOrderNo) + '</td>' +
        '<td>' + escapeHtml(ticket.uploadedAt) + '</td>' +
        '<td>' + escapeHtml(ticket.shippingMethod) + '</td>' +
        '<td>' + escapeHtml(ticket.trackingNo) + '</td>' +
        '<td>' + escapeHtml(ticket.destinationPort) + '</td>' +
        '<td>' + escapeHtml(resolveDestinationWarehouse(ticket.rawDestinationWarehouse)) + '</td>' +
        '<td>' + escapeHtml(ticket.cartons) + '</td>' +
        '<td>' + formatNumber(ticket.weight, 4) + '</td>' +
        '<td>' + formatNumber(ticket.volume, 4) + '</td>' +
        '</tr>';
    }).join('');
  }

  function openTicketModal(containerNo) {
    var item = findByContainerNo(containerNo);
    if (!item) return;
    currentModalItem = item;
    renderTicketModal(item);
    var modal = document.getElementById('container-ticket-modal');
    modal.className = 'container-modal-mask show';
    modal.setAttribute('aria-hidden', 'false');
  }

  function closeTicketModal() {
    currentModalItem = null;
    var modal = document.getElementById('container-ticket-modal');
    modal.className = 'container-modal-mask';
    modal.setAttribute('aria-hidden', 'true');
  }

  function refresh(resetPage) {
    if (resetPage !== false) currentPage = 1;
    var rows = filtered();
    renderTable(rows);
    renderPagination(rows.length);
    renderHint(rows.length);
  }

  function bind() {
    document.getElementById('btn_container_query').addEventListener('click', function () { refresh(true); });
    document.getElementById('btn_container_reset').addEventListener('click', function () {
      [
        'q_container_no',
        'q_port_of_loading',
        'q_destination_port',
        'q_status',
        'q_etd_start',
        'q_etd_end',
        'q_keyword'
      ].forEach(function (id) {
        var el = document.getElementById(id);
        if (el) el.value = '';
      });
      refresh(true);
    });
    document.getElementById('btn_container_modal_close').addEventListener('click', closeTicketModal);
    document.getElementById('btn_container_modal_ok').addEventListener('click', closeTicketModal);
    document.getElementById('container-ticket-modal').addEventListener('click', function (e) {
      if (e.target && e.target.id === 'container-ticket-modal') closeTicketModal();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && currentModalItem) closeTicketModal();
    });
  }

  function init() {
    initFilters();
    bind();
    refresh(true);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
