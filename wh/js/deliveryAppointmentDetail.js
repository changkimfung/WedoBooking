(function () {
  var C = DeliveryAppointmentCommon;

  function getQueryId() {
    var m = window.location.search.match(/[?&]id=([^&]+)/);
    return m ? decodeURIComponent(m[1]) : '';
  }

  function escapeHtml(s) {
    if (s == null || s === '') return '';
    var d = document.createElement('div');
    d.textContent = String(s);
    return d.innerHTML;
  }

  function renderInfoGrid(item) {
    document.getElementById('detailCustomer').innerHTML =
      '客户编号：<strong>' + escapeHtml(item.customerCode) + '</strong>';

    var wh = item.warehouse || '';
    var fields = [
      ['预约仓库', item.warehouse],
      ['预约单号', item.appointmentNo || '-'],
      ['送仓码', item.deliveryCode || '-'],
      ['状态', item.status],
      ['送仓类型', item.deliveryType],
      ['送仓总箱数', C.formatEstimatedCartons(item)],
      ['是否打托', C.formatPalletized(item)],
      ['送仓总托数', C.formatTotalPallets(item)],
      ['集装箱号', item.containerNo || '-'],
      ['柜型', item.containerType || item.containerSeq || '-'],
      ['货代公司', item.forwarder || '-'],
      ['联系邮箱', (item.emails || []).join('、') || '-'],
      [C.localTimeFieldLabel('期望送仓日期', wh), C.formatUsWarehouseTime(item.expectedInboundTime, wh)],
      ['货代备注', String(item.remark || '').trim() || '-'],
      ['提交时间', item.submitTime || '-'],
      ['预约链接', C.buildBookingLinkHtml(item), true]
    ];
    document.getElementById('detailGrid').innerHTML = fields.map(function (f) {
      var isHtml = f[2] === true;
      return '<div class="wh-detail-item"><label>' + f[0] + '</label><span>' +
        (isHtml ? f[1] : escapeHtml(f[1])) + '</span></div>';
    }).join('');
  }

  function renderWhConfirmGrid(item) {
    var wh = item.warehouse || item.confirmedWarehouse || '';
    var fields = [
      ['仓库确认地址', item.warehouseConfirmedAddress || '待确认'],
      [C.localTimeFieldLabel('仓库确认时段', wh),
        C.formatUsWarehouseTime(item.warehouseConfirmedInboundTime, wh) !== '-' ?
          C.formatUsWarehouseTime(item.warehouseConfirmedInboundTime, wh) : '待确认'],
      ['仓库审核备注', String(item.auditRemark || '').trim() || '-']
    ];
    document.getElementById('whConfirmGrid').innerHTML = fields.map(function (f) {
      return '<div class="wh-detail-item"><label>' + f[0] + '</label><span>' +
        escapeHtml(f[1]) + '</span></div>';
    }).join('');
  }

  function renderArrivalUnloadGrid(item) {
    var wh = item.warehouse || item.confirmedWarehouse || '';
    var actualTime = item.actualDeliveryTime
      ? C.formatUsWarehouseTime(item.actualDeliveryTime, wh)
      : '-';
    var fields = [
      [C.localTimeFieldLabel('实际到仓时间', wh), actualTime],
      ['收货总箱数', C.formatCell(item.receivedCartons)],
      ['收货总托数', C.formatCell(item.receivedPallets)],
      ['到仓拍照', C.buildArrivalPhotosHtml(item, {
        listClass: 'wh-detail-photo-list',
        thumbClass: 'wh-detail-photo-thumb'
      }), true]
    ];
    document.getElementById('arrivalUnloadGrid').innerHTML = fields.map(function (f) {
      var isHtml = f[2] === true;
      var value = isHtml ? f[1] : escapeHtml(f[1]);
      var cls = isHtml ? ' wh-detail-item-full' : '';
      return '<div class="wh-detail-item' + cls + '"><label>' + f[0] + '</label><span>' +
        value + '</span></div>';
    }).join('');
  }

  function renderInbound(item) {
    var tbody = document.getElementById('detailInOrders');
    var orders = item.inboundOrders || [];
    if (!orders.length) {
      tbody.innerHTML = '<tr><td colspan="8"><p style="color:#999;text-align:center;margin:12px 0;">无关联入库单</p></td></tr>';
      return;
    }
    tbody.innerHTML = orders.map(function (row) {
      var enriched = C.enrichInboundRow(row);
      return '<tr><td>' + escapeHtml(row.orderNo) + '</td><td>' + escapeHtml(row.status) +
        '</td><td>' + escapeHtml(row.warehouse) + '</td><td>' + escapeHtml(row.shippingMethod) +
        '</td><td>' + escapeHtml(enriched.cartons != null ? enriched.cartons : '-') +
        '</td><td>' + escapeHtml(enriched.deliveryCartons != null ? enriched.deliveryCartons : '-') +
        '</td><td>' + escapeHtml(enriched.receivedCartons != null ? enriched.receivedCartons : '-') +
        '</td><td>' + escapeHtml(row.createDate) + '</td></tr>';
    }).join('');
  }

  function renderLogs(item) {
    document.getElementById('logList').innerHTML = C.buildOperationLogListHtml(item, {
      emptyClass: 'wh-detail-log-empty',
      timeClass: 'wh-detail-log-time'
    });
  }

  function render(item) {
    renderInfoGrid(item);
    renderWhConfirmGrid(item);
    renderArrivalUnloadGrid(item);
    renderInbound(item);
    renderLogs(item);
  }

  function bindTabs() {
    var nav = document.getElementById('detailTabs');
    if (!nav) return;
    nav.querySelectorAll('a[data-tab]').forEach(function (link) {
      link.addEventListener('click', function (e) {
        e.preventDefault();
        var tab = link.getAttribute('data-tab');
        nav.querySelectorAll('li').forEach(function (li) { li.classList.remove('active'); });
        link.parentElement.classList.add('active');
        document.querySelectorAll('.wh-detail-tab-pane').forEach(function (pane) {
          pane.classList.remove('active');
        });
        if (tab === 'logs') {
          document.getElementById('paneLogs').classList.add('active');
        } else {
          document.getElementById('paneInbound').classList.add('active');
        }
      });
    });
  }

  function loadDetail() {
    var id = getQueryId();
    var item = C.getById(id, true);
    if (!item) {
      document.getElementById('detailMain').style.display = 'none';
      document.getElementById('detailEmpty').style.display = 'block';
      return;
    }
    document.getElementById('detailMain').style.display = '';
    document.getElementById('detailEmpty').style.display = 'none';
    render(item);
  }

  function init() {
    bindTabs();
    C.bindAppointmentStorageSync(loadDetail);
    loadDetail();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
