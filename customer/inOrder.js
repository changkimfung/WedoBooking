(function () {
  var PAGE_SIZE = 10;

  var state = {
    activeTabKey: "",
    currentPage: 1,
    filteredList: []
  };

  function getStatusClass(status) {
    var pending = ["待提交", "待国内收货"];
    var processing = ["国内已收货", "运输在途", "海外仓已收货"];
    if (pending.indexOf(status) !== -1) return "pending";
    if (processing.indexOf(status) !== -1) return "processing";
    if (status === "已取消") return "cancelled";
    if (status === "异常") return "error";
    return "default";
  }

  function formatCell(value) {
    if (value === undefined || value === null || value === "") return "-";
    return value;
  }

  function formatNumber(num, digits) {
    if (num === undefined || num === null || num === "") return "-";
    return Number(num).toFixed(digits);
  }

  function getOperations(status) {
    var html = '<a href="javascript:void(0)" class="op-btn" data-action="view">查看</a>';
    if (status === "待提交" || status === "待国内收货") {
      html += '<a href="javascript:void(0)" class="op-btn" data-action="edit">编辑</a>';
    } else if (status === "海外仓已收货") {
      html += '<a href="javascript:void(0)" class="op-btn" data-action="print">打印</a>';
    }
    return html;
  }

  function getFilterValues() {
    return {
      orderNo: document.getElementById("orderNo").value.trim(),
      warehouse: document.getElementById("warehouse").value,
      shippingType: document.getElementById("shippingType").value,
      expressNo: document.getElementById("expressNo").value.trim(),
      status: document.getElementById("status").value
    };
  }

  function applyFilters() {
    var filters = getFilterValues();
    var tabKey = state.activeTabKey;

    state.filteredList = MOCK_IN_ORDER_LIST.filter(function (item) {
      if (tabKey && item.status !== tabKey) return false;
      if (filters.orderNo && item.orderNo.indexOf(filters.orderNo) === -1) return false;
      if (filters.warehouse && item.warehouse !== filters.warehouse) return false;
      if (filters.shippingType && item.shippingMethod !== filters.shippingType) return false;
      if (filters.expressNo && (!item.trackingNo || item.trackingNo.indexOf(filters.expressNo) === -1)) {
        return false;
      }
      if (filters.status && item.status !== filters.status) return false;
      return true;
    });

    state.currentPage = 1;
    renderTable();
    renderPagination();
    bindRowCheckboxes();
  }

  function renderFilterOptions() {
    var warehouseSelect = document.getElementById("warehouse");
    var shippingSelect = document.getElementById("shippingType");
    var statusSelect = document.getElementById("status");

    MOCK_IN_ORDER_WAREHOUSES.forEach(function (name) {
      var opt = document.createElement("option");
      opt.value = name;
      opt.textContent = name;
      warehouseSelect.appendChild(opt);
    });

    MOCK_IN_ORDER_SHIPPING_METHODS.forEach(function (name) {
      var opt = document.createElement("option");
      opt.value = name;
      opt.textContent = name;
      shippingSelect.appendChild(opt);
    });

    var statusSet = {};
    MOCK_IN_ORDER_LIST.forEach(function (item) {
      statusSet[item.status] = true;
    });
    Object.keys(statusSet).forEach(function (name) {
      var opt = document.createElement("option");
      opt.value = name;
      opt.textContent = name;
      statusSelect.appendChild(opt);
    });
  }

  function renderTabs() {
    var tabsEl = document.getElementById("tabs");
    tabsEl.innerHTML = "";

    MOCK_IN_ORDER_STATUS_TABS.forEach(function (tab, index) {
      var el = document.createElement("div");
      el.className = "tab" + (index === 0 ? " active" : "");
      el.dataset.key = tab.key;
      el.textContent = tab.label;
      tabsEl.appendChild(el);
    });

    tabsEl.querySelectorAll(".tab").forEach(function (tab) {
      tab.addEventListener("click", function () {
        tabsEl.querySelectorAll(".tab").forEach(function (t) {
          t.classList.remove("active");
        });
        this.classList.add("active");
        state.activeTabKey = this.dataset.key;
        applyFilters();
      });
    });
  }

  function renderTable() {
    var tbody = document.getElementById("tableBody");
    var list = state.filteredList;
    var start = (state.currentPage - 1) * PAGE_SIZE;
    var pageList = list.slice(start, start + PAGE_SIZE);

    if (!pageList.length) {
      tbody.innerHTML = '<tr class="empty-row"><td colspan="12">暂无数据</td></tr>';
      document.getElementById("checkAll").checked = false;
      return;
    }

    tbody.innerHTML = pageList
      .map(function (item) {
        var statusClass = getStatusClass(item.status);
        return (
          '<tr data-id="' + item.id + '">' +
          '<td><input class="checkbox row-check" type="checkbox" /></td>' +
          "<td>" + item.orderNo + "</td>" +
          "<td>" + item.warehouse + "</td>" +
          "<td>" + item.shippingMethod + "</td>" +
          "<td>" + formatCell(item.trackingNo) + "</td>" +
          "<td>" + formatCell(item.cartons) + "</td>" +
          "<td>" + item.totalQty + "</td>" +
          "<td>" + formatNumber(item.grossWeight, 4) + "</td>" +
          "<td>" + formatNumber(item.volume, 4) + "</td>" +
          "<td>" + item.createDate + "</td>" +
          '<td><span class="status ' + statusClass + '">' + item.status + "</span></td>" +
          "<td>" + getOperations(item.status) + "</td>" +
          "</tr>"
        );
      })
      .join("");

    document.getElementById("checkAll").checked = false;
  }

  function renderPagination() {
    var total = state.filteredList.length;
    var totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    if (state.currentPage > totalPages) state.currentPage = totalPages;

    var paginationEl = document.getElementById("pagination");
    var html = '<span class="muted">共 ' + total + " 条</span>";

    html +=
      '<div class="page-btn' +
      (state.currentPage <= 1 ? " disabled" : "") +
      '" data-page="prev">上一页</div>';

    for (var i = 1; i <= totalPages; i++) {
      html +=
        '<div class="page-num' +
        (i === state.currentPage ? " active" : "") +
        '" data-page="' +
        i +
        '">' +
        i +
        "</div>";
    }

    html +=
      '<div class="page-btn' +
      (state.currentPage >= totalPages ? " disabled" : "") +
      '" data-page="next">下一页</div>';

    paginationEl.innerHTML = html;

    paginationEl.querySelectorAll("[data-page]").forEach(function (btn) {
      if (btn.classList.contains("disabled")) return;
      btn.addEventListener("click", function () {
        var page = this.dataset.page;
        if (page === "prev") {
          state.currentPage -= 1;
        } else if (page === "next") {
          state.currentPage += 1;
        } else {
          state.currentPage = parseInt(page, 10);
        }
        renderTable();
        renderPagination();
        bindRowCheckboxes();
      });
    });
  }

  function bindRowCheckboxes() {
    var checkAll = document.getElementById("checkAll");
    var rowChecks = document.querySelectorAll(".row-check");

    rowChecks.forEach(function (item) {
      item.addEventListener("change", function () {
        var allChecked = Array.prototype.every.call(rowChecks, function (i) {
          return i.checked;
        });
        checkAll.checked = allChecked;
      });
    });
  }

  function initCheckAll() {
    var checkAll = document.getElementById("checkAll");
    checkAll.addEventListener("change", function () {
      document.querySelectorAll(".row-check").forEach(function (item) {
        item.checked = checkAll.checked;
      });
    });
  }

  function initMenu() {
    var docManageBtn = document.getElementById("docManageBtn");
    var docManageSubmenu = document.getElementById("docManageSubmenu");
    docManageBtn.addEventListener("click", function () {
      docManageSubmenu.classList.toggle("show");
    });
  }

  function initButtons() {
    document.getElementById("searchBtn").addEventListener("click", applyFilters);
    document.getElementById("resetBtn").addEventListener("click", function () {
      document.getElementById("orderNo").value = "";
      document.getElementById("warehouse").value = "";
      document.getElementById("shippingType").value = "";
      document.getElementById("expressNo").value = "";
      document.getElementById("status").value = "";
      applyFilters();
    });
  }

  function init() {
    initMenu();
    initCheckAll();
    initButtons();
    renderFilterOptions();
    renderTabs();
    state.filteredList = MOCK_IN_ORDER_LIST.slice();
    renderTable();
    renderPagination();
    bindRowCheckboxes();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
