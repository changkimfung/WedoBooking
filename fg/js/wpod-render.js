/**
 * W.BOL document render (LCL / FCL) with English display for all fields.
 */
var WpodRender = (function () {
  var OR = typeof OfficialReservation !== 'undefined' ? OfficialReservation : null;
  var C = typeof DeliveryAppointmentCommon !== 'undefined' ? DeliveryAppointmentCommon : null;

  var SHIPPING_METHOD_EN = {
    '\u5ba2\u6237\u81ea\u53d1\u5934\u7a0b': 'Customer-Arranged First Leg',
    '\u8fd0\u5fb7\u5934\u7a0b-\u6d77\u8fd0': 'Wedo First Leg - Ocean Freight',
    '\u5feb\u9012-\u6d77\u6d3e-\u4e0d\u542b\u7a0e': 'Express Sea Parcel - Duties Excluded',
    '\u5feb\u9012-\u6d77\u6d3e-\u5305\u7a0e': 'Express Sea Parcel - Duties Included',
    '\u7edf\u914d \u7f8e\u4e2d\u5feb\u7ebf \u5305\u7a0e': 'Consolidated US Central Express - Duties Included',
    '\u5feb\u63d0 \u7f8e\u4e1c \u98de\u901f\u8fbe': 'Fast Pickup US East Express',
    '\u7edf\u914d \u6d77\u5361-\u5305\u7a0e': 'Consolidated Sea Truck - Duties Included',
    '\u5feb\u63d0 \u6d77\u5361-\u4e0d\u542b\u7a0e': 'Fast Pickup Sea Truck - Duties Excluded',
    '\u5feb\u63d0 \u6d77\u5361-\u5305\u7a0e': 'Fast Pickup Sea Truck - Duties Included'
  };

  var SHIPPING_TOKEN_EN = [
    ['\u5ba2\u6237\u81ea\u53d1\u5934\u7a0b', 'Customer-Arranged First Leg'],
    ['\u8fd0\u5fb7\u5934\u7a0b', 'Wedo First Leg'],
    ['\u6d77\u8fd0', 'Ocean Freight'],
    ['\u5feb\u9012', 'Express'],
    ['\u6d77\u6d3e', 'Sea Parcel'],
    ['\u6d77\u5361', 'Sea Truck'],
    ['\u7edf\u914d', 'Consolidated'],
    ['\u5feb\u63d0', 'Fast Pickup'],
    ['\u7f8e\u4e1c', 'US East'],
    ['\u7f8e\u897f', 'US West'],
    ['\u7f8e\u4e2d', 'US Central'],
    ['\u7f8e\u5357', 'US South'],
    ['\u98de\u901f\u8fbe', 'Express Delivery'],
    ['\u5305\u7a0e', 'Duties Included'],
    ['\u4e0d\u542b\u7a0e', 'Duties Excluded']
  ];

  var FORWARDER_EN = {
    '\u5fb7\u8fc5\u8d27\u4ee3': 'Kuehne + Nagel',
    '\u6d77\u8fd0\u5927\u53d1\u6574\u67dc': 'Ocean Freight FCL Service',
    '\u4e2d\u5916\u8fd0': 'Sinotrans',
    '\u987a\u4e30\u56fd\u9645': 'SF International',
    '\u9a6c\u58eb\u57fa\u8d27\u4ee3': 'Maersk Freight Forwarding'
  };

  function hasCjk(text) {
    return /[\u3400-\u9fff]/.test(String(text || ''));
  }

  function translateDisplayLabel(value) {
    var raw = String(value == null ? '' : value).trim();
    if (!raw || raw === '-') return '-';
    if (FORWARDER_EN[raw]) return FORWARDER_EN[raw];
    return translateShippingMethod(raw);
  }

  function translateShippingMethod(value) {
    var raw = String(value == null ? '' : value).trim();
    if (!raw || raw === '-') return '-';
    if (SHIPPING_METHOD_EN[raw]) return SHIPPING_METHOD_EN[raw];
    if (!hasCjk(raw)) return raw;
    var out = raw;
    SHIPPING_TOKEN_EN.forEach(function (pair) {
      out = out.split(pair[0]).join(pair[1]);
    });
    out = out.replace(/[\u4e00-\u9fff]/g, '');
    out = out.replace(/\s+/g, ' ').replace(/\s*-\s*/g, ' - ').replace(/\s*,\s*/g, ', ').trim();
    return out || raw;
  }

  function resolveWarehouseEntry(item) {
    var whName = ((item && (item.confirmedWarehouse || item.warehouse)) || '').trim();
    if (!whName || typeof findWarehouseRegistryEntry !== 'function') return null;
    return findWarehouseRegistryEntry(whName);
  }

  function resolveWarehouseCode(entry) {
    if (!entry) return '';
    return entry.warehouseNotifyCode || entry.warehouseShortCode || entry.edaSiteCode || '';
  }

  function extractParentheticalWarehouseCode(warehouseName) {
    var raw = String(warehouseName || '').trim();
    if (!raw) return '';
    var m = raw.match(/\(([^)]+)\)/);
    return m && m[1] ? String(m[1]).trim() : '';
  }

  function formatWarehouseDisplay(item) {
    var whName = (item.confirmedWarehouse || item.warehouse || '').trim();
    if (!whName) return '-';
    var code = extractParentheticalWarehouseCode(whName);
    if (code) return code;
    var entry = resolveWarehouseEntry(item);
    var fallback = resolveWarehouseCode(entry);
    return fallback || '-';
  }

  function formatWarehouseAddress(item) {
    var addr = item.warehouseConfirmedAddress;
    var trimmed = addr && String(addr).trim() ? String(addr).trim() : '';
    if (trimmed && !hasCjk(trimmed)) return trimmed;
    var entry = resolveWarehouseEntry(item);
    if (entry && entry.address && !hasCjk(entry.address)) return entry.address;
    return trimmed || '-';
  }

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
    return item.deliveryType === '\u6574\u67dc' ? 'FCL' : 'LCL';
  }

  function formatPalletized(item) {
    var palletized = C && C.isPalletized ? C.isPalletized(item) : Number(item.totalPallets) > 0;
    return palletized ? 'Yes' : 'No';
  }

  function formatBooker(item) {
    var channel = (item && item.bookChannel) || 'customer';
    if (channel === 'shipping') return 'Wedo Shipping (Wedo)';
    return (item && item.customerCode) || '-';
  }

  function formatDeliveryTime(item) {
    var t = item && item.warehouseConfirmedInboundTime;
    return t && String(t).trim() ? String(t).trim() : '-';
  }

  function formatWarehouseContact() {
    return '-';
  }

  function formatContainerType(item) {
    var t = (item.containerType || '').trim();
    return t || '-';
  }

  function buildGoodsRows(item) {
    if (!OR) return [];
    return OR.buildCargoRows(item);
  }

  function setText(id, text) {
    var el = document.getElementById(id);
    if (el) el.textContent = text == null || text === '' ? '-' : String(text);
  }

  function setTextAllowEmpty(id, text) {
    var el = document.getElementById(id);
    if (el) el.textContent = text == null || text === '' ? '' : String(text);
  }

  function formatTotalCartons(item) {
    if (C && C.formatEstimatedCartons) {
      var cartons = C.formatEstimatedCartons(item);
      return cartons == null || cartons === '' ? '-' : cartons;
    }
    var rows = buildGoodsRows(item);
    var total = 0;
    rows.forEach(function (row) {
      total += Number(row.deliveryCartons != null ? row.deliveryCartons : row.cartons) || 0;
    });
    return total || '-';
  }

  function formatTotalPallets(item) {
    var palletized = C && C.isPalletized ? C.isPalletized(item) : Number(item.totalPallets) > 0;
    if (!palletized) return '';
    if (C && C.formatTotalPallets) {
      var pallets = C.formatTotalPallets(item);
      return pallets === '-' ? '' : pallets;
    }
    return Number(item.totalPallets) > 0 ? item.totalPallets : '';
  }

  function formatRowCartons(row) {
    var n = row.deliveryCartons != null && row.deliveryCartons !== ''
      ? row.deliveryCartons
      : row.cartons;
    if (n == null || n === '') return '-';
    var num = Number(n);
    return isNaN(num) ? '-' : String(Math.round(num));
  }

  function formatOrderDate(value) {
    var raw = String(value == null ? '' : value).trim();
    if (!raw) return '-';
    var m = raw.match(/^(\d{4}-\d{2}-\d{2})/);
    if (m) return m[1];
    m = raw.match(/^(\d{4}\/\d{2}\/\d{2})/);
    if (m) return m[1];
    return raw.split(/[ T]/)[0] || raw;
  }

  function renderLclSummary(item) {
    setText('wpodTotalCartons', formatTotalCartons(item));
    setTextAllowEmpty('wpodTotalPallets', formatTotalPallets(item));
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

  function renderBasicInfo(item) {
    setText('wpodAppointmentNo', item.appointmentNo || '-');
    setText('wpodWarehouse', formatWarehouseDisplay(item));
    setText('wpodBooker', formatBooker(item));
    setText('wpodPalletized', formatPalletized(item));
    setText('wpodDeliveryTime', formatDeliveryTime(item));
    setText('wpodWarehouseAddress', formatWarehouseAddress(item));
    setText('wpodWarehouseContact', formatWarehouseContact());
  }

  function renderLclGoodsTable(item) {
    var tbody = document.getElementById('wpodGoodsBody');
    if (!tbody) return;
    var rows = buildGoodsRows(item);
    if (!rows.length) {
      tbody.innerHTML = '<tr><td colspan="4">No cargo details available.</td></tr>';
      return;
    }
    tbody.innerHTML = rows.map(function (row) {
      return '<tr>' +
        '<td>' + escapeHtml(row.orderNo) + '</td>' +
        '<td>' + escapeHtml(translateDisplayLabel(row.shippingMethod)) + '</td>' +
        '<td>' + escapeHtml(formatOrderDate(row.createDate)) + '</td>' +
        '<td>' + escapeHtml(formatRowCartons(row)) + '</td>' +
        '</tr>';
    }).join('');
  }

  function renderFclContainerTable(item) {
    setText('wpodContainerNo', item.containerNo || '-');
    setText('wpodContainerType', formatContainerType(item));
  }

  function renderLclPage(item) {
    var bookingCode = item.deliveryCode || item.appointmentNo || '-';
    setText('wpodBookingCode', bookingCode);
    renderLclSummary(item);
    renderBasicInfo(item);
    setText('wpodDeliveryType', formatDeliveryType(item));
    renderLclGoodsTable(item);
    renderBarcode(bookingCode);
    document.title = 'W.BOL LCL - ' + (item.appointmentNo || bookingCode);
  }

  function renderFclPage(item) {
    var bookingCode = item.deliveryCode || item.appointmentNo || '-';
    setText('wpodBookingCode', bookingCode);
    renderBasicInfo(item);
    setText('wpodDeliveryType', formatDeliveryType(item));
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
      page.innerHTML = '<p style="text-align:center;padding:40px;">Appointment not found. Please check the booking code.</p>';
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
