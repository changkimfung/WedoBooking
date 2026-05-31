/**
 * W.BOL 文档渲染（散货 LCL / 整柜 FCL，数据来自预约送仓 mock）
 */
var WpodRender = (function () {
  var OR = typeof OfficialReservation !== 'undefined' ? OfficialReservation : null;
  var C = typeof DeliveryAppointmentCommon !== 'undefined' ? DeliveryAppointmentCommon : null;
  var DEFAULT_WAREHOUSE_PHONE = '(848) 667-1949';

  function getQueryCode() {
    var m = window.location.search.match(/[?&]code=([^&]+)/i);
    return m ? decodeURIComponent(m[1]).trim() : '';
  }

  function getDocumentUrl(item) {
    if (C && C.getWPodDocumentUrl) return C.getWPodDocumentUrl(item, '');
    return '';
  }

  function isFclTemplate() {
    return !!document.getElementById('wpodFclBody');
  }

  function formatDeliveryType(item) {
    return item.deliveryType === '\u6574\u67dc'
      ? '\u6574\u67dc (Full Container)'
      : '\u6563\u8d27 (LCL)';
  }

  function formatPalletized(item) {
    if (C && C.formatPalletized) return C.formatPalletized(item);
    return Number(item.totalPallets) > 0 ? '\u662f' : '\u5426';
  }

  function formatTotalPallets(item) {
    if (C && C.formatTotalPallets) return C.formatTotalPallets(item);
    return Number(item.totalPallets) > 0 ? item.totalPallets : '-';
  }

  function formatEstimatedCartons(item) {
    if (item && item.estimatedCartons != null && item.estimatedCartons !== '') {
      return item.estimatedCartons;
    }
    if (C && C.formatEstimatedCartons) return C.formatEstimatedCartons(item);
    return calcTotalCartons(item) || '-';
  }

  function formatOrigin(item, forFcl) {
    if (forFcl) {
      var rows = C && C.buildInboundDetailRows ? C.buildInboundDetailRows(item) : [];
      if (!rows.length) return '\u5de5\u5382\u67dc\u76f4\u53d1';
    }
    if (C && C.buildInboundDetailRows) {
      var list = C.buildInboundDetailRows(item);
      if (list.length) {
        var parts = [];
        var seen = {};
        list.forEach(function (r) {
          var hm = r.handleMethod || '-';
          var wh = r.warehouse || item.warehouse || '-';
          var key = hm + '=' + wh;
          if (!seen[key]) {
            seen[key] = true;
            parts.push(key);
          }
        });
        if (parts.length) return parts.join(' / ');
      }
    }
    return item.warehouse || '-';
  }

  function formatBooker(item) {
    if (C && C.getBookerParty) return C.getBookerParty(item);
    return item.customerCode || '-';
  }

  function formatContact(item) {
    var emails = item.emails || [];
    return emails.length ? emails.join(', ') : '-';
  }

  function formatDeliveryTime(item) {
    return item.warehouseConfirmedInboundTime ||
      item.expectedInboundTime ||
      '-';
  }

  function formatWarehouseAddress(item) {
    var addr = item.warehouseConfirmedAddress;
    return addr && String(addr).trim() ? String(addr).trim() : '-';
  }

  function formatWarehousePhone(item) {
    var phone = item.warehousePhone || item.warehouseConfirmedPhone;
    return phone && String(phone).trim() ? String(phone).trim() : DEFAULT_WAREHOUSE_PHONE;
  }

  function formatWeight(n, useComma) {
    if (n === undefined || n === null || n === '') return '-';
    var num = Number(n);
    if (isNaN(num)) return '-';
    if (useComma) {
      return num.toLocaleString('en-US', { maximumFractionDigits: 2 }) + ' kgs';
    }
    return num.toFixed(2) + ' kgs';
  }

  function formatVolume(n) {
    if (n === undefined || n === null || n === '') return '-';
    var num = Number(n);
    if (isNaN(num)) return '-';
    return num.toLocaleString('en-US', { maximumFractionDigits: 2 }) + ' CBM';
  }

  function formatCartonsPlain(n) {
    if (n === undefined || n === null || n === '') return '-';
    var num = Number(n);
    if (isNaN(num)) return '-';
    return String(Math.round(num));
  }

  function formatCartonsLcl(n) {
    if (n === undefined || n === null || n === '') return '-';
    return Number(n) + ' CTNS';
  }

  function calcTotalCartons(item) {
    if (C && C.calcTotalCartons) return C.calcTotalCartons(item);
    if (!OR) return 0;
    return OR.sumField(OR.buildCargoRows(item), 'deliveryCartons');
  }

  function formatContainerType(item) {
    var t = (item.containerType || '').trim();
    if (t) return t;
    return '-';
  }

  function buildGoodsRows(item) {
    if (!OR) return [];
    return OR.buildCargoRows(item);
  }

  function setText(id, text) {
    var el = document.getElementById(id);
    if (el) el.textContent = text == null || text === '' ? '-' : String(text);
  }

  function renderBarcode(code) {
    if (typeof JsBarcode === 'undefined' || !code) return;
    try {
      JsBarcode('#barcode', String(code), {
        format: 'CODE128',
        lineColor: '#000',
        width: 2,
        height: 50,
        displayValue: false
      });
    } catch (e) { /* ignore */ }
  }

  function escapeHtml(str) {
    if (str == null) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function renderLclGoodsTable(item) {
    var tbody = document.getElementById('wpodGoodsBody');
    if (!tbody) return;
    var rows = buildGoodsRows(item);
    if (!rows.length) {
      tbody.innerHTML = '<tr><td colspan="4">\u6682\u65e0\u8d27\u7269\u660e\u7ec6</td></tr>';
      return;
    }
    tbody.innerHTML = rows.map(function (row) {
      return '<tr>' +
        '<td>' + escapeHtml(row.orderNo) + '</td>' +
        '<td>' + escapeHtml(row.shippingMethod || '-') + '</td>' +
        '<td>' + escapeHtml(row.createDate != null && row.createDate !== '' ? row.createDate : '-') + '</td>' +
        '<td>' + formatCartonsLcl(row.deliveryCartons != null ? row.deliveryCartons : row.cartons) + '</td>' +
        '</tr>';
    }).join('');
  }

  function renderFclContainerTable(item) {
    setText('wpodContainerNo', item.containerNo || '-');
    setText('wpodContainerType', formatContainerType(item));
    setText('wpodCartons', formatEstimatedCartons(item));
    var hint = document.getElementById('wpodEmailSubjectHint');
    if (hint) {
      var code = item.customerCode || '';
      var cntr = item.containerNo || '-';
      hint.textContent = code ? code + '--' + cntr : cntr;
    }
  }

  function renderLclPage(item) {
    var bookingCode = item.deliveryCode || item.appointmentNo || '-';
    setText('wpodBookingCode', bookingCode);
    setText('wpodAppointmentNo', item.appointmentNo || '-');
    setText('wpodForwarder', item.forwarder || '-');
    setText('wpodOrigin', formatOrigin(item, false));
    setText('wpodDeliveryTime', formatDeliveryTime(item));
    setText('wpodBooker', formatBooker(item));
    setText('wpodContact', formatContact(item));
    setText('wpodWarehouse', item.confirmedWarehouse || item.warehouse || '-');
    setText('wpodDeliveryType', formatDeliveryType(item));
    setText('wpodEstimatedCartons', formatEstimatedCartons(item));
    setText('wpodTotalPallets', formatTotalPallets(item));
    setText('wpodWarehouseAddress', formatWarehouseAddress(item));
    setText('wpodWarehousePhone', formatWarehousePhone(item));
    renderLclGoodsTable(item);
    renderBarcode(bookingCode);
    document.title = 'W.BOL LCL - ' + (item.appointmentNo || bookingCode);
  }

  function renderFclPage(item) {
    var bookingCode = item.deliveryCode || item.appointmentNo || '-';
    setText('wpodBookingCode', bookingCode);
    setText('wpodAppointmentNo', item.appointmentNo || '-');
    setText('wpodForwarder', item.forwarder || '-');
    setText('wpodOrigin', formatOrigin(item, true));
    setText('wpodDeliveryTime', formatDeliveryTime(item));
    setText('wpodWarehouse', item.confirmedWarehouse || item.warehouse || '-');
    setText('wpodEstimatedCartons', formatEstimatedCartons(item));
    setText('wpodTotalPallets', formatTotalPallets(item));
    setText('wpodWarehouseAddress', formatWarehouseAddress(item));
    setText('wpodWarehousePhone', formatWarehousePhone(item));
    var dtEl = document.getElementById('wpodDeliveryType');
    if (dtEl) {
      dtEl.innerHTML = '<strong>' + escapeHtml(formatDeliveryType(item)) + '</strong>';
    }
    renderFclContainerTable(item);
    renderBarcode(bookingCode);
    document.title = 'W.BOL FCL - ' + (item.appointmentNo || bookingCode);
  }

  function renderPage(item) {
    if (isFclTemplate() || item.deliveryType === '\u6574\u67dc') {
      renderFclPage(item);
    } else {
      renderLclPage(item);
    }
  }

  function showNotFound() {
    var page = document.querySelector('.page');
    if (page) {
      page.innerHTML = '<p style="text-align:center;padding:40px;">\u672a\u627e\u5230\u8be5\u9884\u7ea6\u5355\uff0c\u8bf7\u68c0\u67e5\u9884\u7ea6\u7801\u3002</p>';
    }
    var btn = document.querySelector('.no-print');
    if (btn) btn.style.display = 'none';
  }

  function init() {
    var code = getQueryCode();
    if (!code || !OR) {
      showNotFound();
      return;
    }
    var item = OR.getAppointment(code);
    if (!item) {
      showNotFound();
      return;
    }
    renderPage(item);
  }

  return {
    getDocumentUrl: getDocumentUrl,
    renderPage: renderPage,
    init: init
  };
})();
