/**
 * 海外仓 · 入库预约详情
 */
(function ($) {
  'use strict';

  var C = DeliveryAppointmentCommon;
  var currentItem = null;
  var STATUS_WH_PENDING = '\u4ed3\u5e93\u5f85\u5ba1\u6838';
  var STATUS_FAILED = '\u9884\u7ea6\u5931\u8d25';

  function getQueryId() {
    var m = window.location.search.match(/[?&]id=([^&]+)/);
    return m ? decodeURIComponent(m[1]) : '';
  }

  function escapeHtml(s) {
    if (s == null || s === '') return '';
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function gridItem(label, valueHtml, fullWidth) {
    var cls = 'recv-detail-item' + (fullWidth ? ' recv-detail-item-full' : '');
    return '<div class="' + cls + '"><label>' + escapeHtml(label) + '</label><span>' +
      valueHtml + '</span></div>';
  }

  function statusClass(status) {
    if (status === STATUS_WH_PENDING) return 'wh-pending';
    if (status === '\u5ba2\u6237\u5f85\u786e\u8ba4') return 'customer-pending';
    if (status === '\u5df2\u9001\u4ed3') return 'delivered';
    if (status === STATUS_FAILED) return 'failed';
    return '';
  }

  function renderHeader(item) {
    $('#hdrAppointmentNo').text('#' + (item.appointmentNo || '-'));
    var $st = $('#hdrStatus');
    $st.text(item.status || '-').attr('class', 'recv-detail-status ' + statusClass(item.status));
    var auditApi = window.UsRecvAppointmentAudit;
    var whPending = auditApi ? auditApi.STATUS_WH_PENDING : STATUS_WH_PENDING;
    var customerPending = auditApi ? auditApi.STATUS_CUSTOMER_PENDING : '\u5ba2\u6237\u5f85\u786e\u8ba4';
    $('#btnAudit').toggle(item.status === whPending);
    $('#btnAuditUpdate').toggle(item.status === customerPending);
    $('#btnSignOff').toggle(C.isEligibleForUsSignOff(item));
  }

  function renderCustomerBanner(item) {
    $('#detailCustomer').html(
      '\u5ba2\u6237\u7f16\u53f7\uff1a<strong>' + escapeHtml(item.customerCode || '-') + '</strong>'
    );
  }

  function renderApplyGrid(item) {
    var wh = item.warehouse || '';
    var linkHtml = C.isDeliveryCodePublished(item) ? C.buildBookingLinkHtml(item) : '-';
    var fields = [
      ['预约仓库', escapeHtml(item.warehouse || '-')],
      ['预约单号', escapeHtml(item.appointmentNo || '-')],
      ['送仓码', escapeHtml(C.formatDeliveryCodeCell(item))],
      ['状态', escapeHtml(item.status || '-')],
      ['送仓类型', escapeHtml(item.deliveryType || '-')],
      ['送仓总箱数', escapeHtml(C.formatEstimatedCartons(item))],
      ['总体积（m³）', escapeHtml(C.formatTotalVolume(item))],
      ['总重量（kg）', escapeHtml(C.formatTotalWeight(item))],
      ['是否打托', escapeHtml(C.formatPalletized(item))],
      ['送仓总托数', escapeHtml(C.formatTotalPallets(item))],
      ['集装箱号', escapeHtml(item.containerNo || '-')],
      ['柜型', escapeHtml(item.containerType || item.containerSeq || '-')],
      ['货代联系邮箱', escapeHtml(C.formatContactEmailsDisplay(item))],
      ['联系电话', escapeHtml(C.formatFgContactPhone(item))],
      [C.localTimeFieldLabel('期望送仓日期', wh),
        escapeHtml(C.formatExpectedInboundDatesDisplay(item, wh))],
      ['货代备注', escapeHtml(String(item.remark || '').trim() || '-')],
      ['提交时间', escapeHtml(item.submitTime || '-')],
      ['预约链接', linkHtml]
    ];
    $('#applyGrid').html(fields.map(function (f) {
      return gridItem(f[0], f[1]);
    }).join(''));
  }

  function renderWhConfirmGrid(item) {
    var wh = item.warehouse || item.confirmedWarehouse || '';
    var confirmedSlot = C.formatUsWarehouseTime(item.warehouseConfirmedInboundTime, wh);
    var wPod = C.getWPodDocumentUrl(item, '../fg/') || item.wPodUrl;
    var wPodHtml = wPod
      ? '<a href="' + escapeHtml(wPod) + '" target="_blank" rel="noopener">\u4e0b\u8f7d W.BOL</a>'
      : '-';
    var fields = [
      ['仓库确认地址', escapeHtml(item.warehouseConfirmedAddress || '\u5f85\u786e\u8ba4')],
      [C.localTimeFieldLabel('仓库确认时段', wh),
        escapeHtml(confirmedSlot !== '-' ? confirmedSlot : '\u5f85\u786e\u8ba4')],
      ['仓库审核备注', escapeHtml(String(item.auditRemark || '').trim() || '-')],
      ['W.BOL \u4e0b\u8f7d', wPodHtml]
    ];
    $('#whConfirmGrid').html(fields.map(function (f) {
      return gridItem(f[0], f[1]);
    }).join(''));
  }

  function renderArrivalUnloadGrid(item) {
    var wh = item.warehouse || item.confirmedWarehouse || '';
    var fields = [
      [C.localTimeFieldLabel('实际到仓时间', wh), escapeHtml(C.formatUsWarehouseTime(item.actualDeliveryTime, wh) || '-')],
      ['收货总箱数', escapeHtml(C.formatCell(item.receivedCartons))],
      ['收货总托数', escapeHtml(C.formatCell(item.receivedPallets))],
      ['到仓拍照', C.buildArrivalPhotosHtml(item, {
        listClass: 'recv-detail-photo-list',
        thumbClass: 'recv-detail-photo-thumb'
      }), true]
    ];
    $('#arrivalUnloadGrid').html(fields.map(function (f) {
      return gridItem(f[0], f[1], f[2]);
    }).join(''));
  }

  function renderInbound(item) {
    var orders = item.inboundOrders || [];
    var $body = $('#inboundBody');
    if (!orders.length) {
      $body.html('<tr><td colspan="8" class="recv-detail-empty">\u65e0\u5173\u8054\u5165\u5e93\u5355</td></tr>');
      return;
    }
    $body.html(orders.map(function (row) {
      var enriched = C.enrichInboundRow(row);
      return '<tr>' +
        '<td>' + escapeHtml(row.orderNo) + '</td>' +
        '<td>' + escapeHtml(row.status) + '</td>' +
        '<td>' + escapeHtml(row.warehouse) + '</td>' +
        '<td>' + escapeHtml(row.shippingMethod) + '</td>' +
        '<td>' + escapeHtml(enriched.cartons != null ? enriched.cartons : '-') + '</td>' +
        '<td>' + escapeHtml(enriched.deliveryCartons != null ? enriched.deliveryCartons : '-') + '</td>' +
        '<td>' + escapeHtml(enriched.receivedCartons != null ? enriched.receivedCartons : '-') + '</td>' +
        '<td>' + escapeHtml(row.createDate) + '</td>' +
        '</tr>';
    }).join(''));
  }

  function renderLogs(item) {
    $('#logList').html(C.buildOperationLogListHtml(item, {
      portal: 'warehouse',
      sort: 'desc',
      emptyClass: 'recv-detail-empty',
      timeClass: 'recv-detail-log-time',
      emptyText: '\u6682\u65e0\u65e5\u5fd7'
    }));
  }

  function renderAll(item) {
    currentItem = item;
    renderHeader(item);
    renderCustomerBanner(item);
    renderApplyGrid(item);
    renderWhConfirmGrid(item);
    renderArrivalUnloadGrid(item);
    renderInbound(item);
    renderLogs(item);
  }

  function bindTabs() {
    $('#detailTabs a').on('click', function (e) {
      e.preventDefault();
      var tab = $(this).attr('data-tab');
      $('#detailTabs li').removeClass('active');
      $(this).parent().addClass('active');
      $('.recv-detail-tab-pane').removeClass('active');
      if (tab === 'logs') {
        $('#paneLogs').addClass('active');
      } else {
        $('#paneInbound').addClass('active');
      }
    });
  }

  function loadAndRender() {
    var id = getQueryId();
    var item = C.getReceivingById(id);
    if (!item) {
      $('#detailMain').hide();
      $('#detailEmpty').show();
      currentItem = null;
      return;
    }
    currentItem = item;
    $('#detailMain').show();
    $('#detailEmpty').hide();
    renderAll(item);
  }

  function init() {
    if (typeof DeliveryAppointmentCommon === 'undefined') {
      window.alert('\u672a\u52a0\u8f7d\u9884\u7ea6\u9001\u4ed3\u6a21\u62df\u6570\u636e\u3002');
      return;
    }
    bindTabs();
    if (window.UsRecvAppointmentAudit) {
      UsRecvAppointmentAudit.init({
        detailBtn: '#btnAudit',
        detailUpdateBtn: '#btnAuditUpdate',
        getCurrentItem: function () { return currentItem; },
        onSuccess: function (updated) {
          currentItem = updated;
          renderAll(updated);
        }
      });
    }
    if (window.UsRecvAppointmentSignOff) {
      UsRecvAppointmentSignOff.init({
        detailBtn: '#btnSignOff',
        getCurrentItem: function () { return currentItem; },
        onSuccess: function (updated) {
          currentItem = updated;
          renderAll(updated);
        }
      });
    }
    C.bindAppointmentStorageSync(loadAndRender);
    loadAndRender();
  }

  $(init);
})(jQuery);
