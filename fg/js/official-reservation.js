/**
 * 官网预约送仓 - 数据联动（读取 mock 预约送仓数据）
 */
var OfficialReservation = (function () {
  var C = typeof DeliveryAppointmentCommon !== 'undefined' ? DeliveryAppointmentCommon : null;

  var STATUS_OFFICIAL_MAP = {
    '仓库待确认': '待仓库确认',
    '客户待确认': '待客户确认',
    '预约失败': '预约失败'
  };

  function getAppointment(code) {
    if (!C || !code) return null;
    var normalized = String(code).trim().toUpperCase();
    var item = C.getByDeliveryCode(code);
    if (item) return item;
    var list = C.getBaseList ? C.getBaseList() : [];
    for (var i = 0; i < list.length; i++) {
      var dc = list[i].deliveryCode;
      if (dc && String(dc).trim().toUpperCase() === normalized) {
        return JSON.parse(JSON.stringify(list[i]));
      }
    }
    return null;
  }

  function displayStatus(status) {
    return STATUS_OFFICIAL_MAP[status] || status || '-';
  }

  function findInOrder(snap) {
    if (typeof MOCK_IN_ORDER_LIST === 'undefined') return null;
    for (var i = 0; i < MOCK_IN_ORDER_LIST.length; i++) {
      var o = MOCK_IN_ORDER_LIST[i];
      if (snap.inOrderId && o.id === snap.inOrderId) return o;
      if (snap.orderNo && o.orderNo === snap.orderNo) return o;
    }
    return null;
  }

  function enrichInboundRow(snap) {
    var order = findInOrder(snap);
    var pallets = snap.pallets != null ? Number(snap.pallets) : (order && order.pallets != null ? Number(order.pallets) : 0);
    var cartons = snap.cartons != null ? Number(snap.cartons) : (order ? (Number(order.cartons) || Number(order.totalQty) || 0) : 0);
    var deliveryCartons = snap.deliveryCartons != null && snap.deliveryCartons !== '' ? Number(snap.deliveryCartons) : cartons;
    var weight = snap.grossWeight != null ? Number(snap.grossWeight) : (order ? Number(order.grossWeight) || 0 : 0);
    var volume = snap.volume != null ? Number(snap.volume) : (order ? Number(order.volume) || 0 : 0);
    var createDate = snap.createDate || (order && order.createDate) || '';
    return {
      orderNo: snap.orderNo || '-',
      shippingMethod: snap.shippingMethod || (order && order.shippingMethod) || '-',
      pallets: pallets,
      cartons: cartons,
      deliveryCartons: deliveryCartons,
      weight: weight,
      volume: volume,
      createDate: createDate
    };
  }

  function buildCargoRows(item) {
    var orders = item.inboundOrders || [];
    if (!orders.length) {
      return [{
        orderNo: '-',
        shippingMethod: item.forwarder || '-',
        pallets: item.totalPallets || 0,
        cartons: 0,
        weight: Number(item.totalWeight) || 0,
        volume: Number(item.totalVolume) || 0
      }];
    }
    return orders.map(enrichInboundRow);
  }

  function sumPallets(rows) {
    var t = 0;
    rows.forEach(function (r) { t += Number(r.pallets) || 0; });
    return t;
  }

  function sumField(rows, key) {
    var t = 0;
    rows.forEach(function (r) { t += Number(r[key]) || 0; });
    return t;
  }

  function formatNum(n, digits) {
    if (n === undefined || n === null || n === '') return '-';
    return Number(n).toFixed(digits);
  }

  function toDatetimeLocalValue(str) {
    if (!str) return '';
    var s = String(str).trim().replace(' ', 'T');
    if (s.length === 16) s += ':00';
    return s.slice(0, 19);
  }

  function fromDatetimeLocalValue(val) {
    if (!val) return '';
    return val.replace('T', ' ');
  }

  /** 货代期望送仓日期 - 解析为 input[type=date] 接受的 "YYYY-MM-DD" 值 */
  function parseExpectedDate(str) {
    if (!str) return '';
    var s = String(str).trim();
    var m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    return m ? (m[1] + '-' + m[2] + '-' + m[3]) : '';
  }

  /** input[type=date] 的值（已是 YYYY-MM-DD）直接落库 */
  function formatExpectedDate(val) {
    return parseExpectedDate(val);
  }

  function persist(item, done) {
    if (!C) {
      if (done) done(new Error('no common'), item);
      return item;
    }
    if (done) {
      C.addOrUpdateInMockAndPersist(item, null, function (err, record) {
        done(err, record || item);
      });
      return item;
    }
    return C.addOrUpdateInMock(item);
  }

  function getQueryCode() {
    var m = window.location.search.match(/[?&]code=([^&]+)/i);
    return m ? decodeURIComponent(m[1]) : '';
  }

  function getWPodDocumentUrl(item) {
    if (C && C.getWPodDocumentUrl) return C.getWPodDocumentUrl(item, '');
    return '';
  }

  return {
    getAppointment: getAppointment,
    displayStatus: displayStatus,
    buildCargoRows: buildCargoRows,
    sumPallets: sumPallets,
    sumField: sumField,
    formatNum: formatNum,
    toDatetimeLocalValue: toDatetimeLocalValue,
    fromDatetimeLocalValue: fromDatetimeLocalValue,
    parseExpectedDate: parseExpectedDate,
    formatExpectedDate: formatExpectedDate,
    persist: persist,
    getQueryCode: getQueryCode,
    getWPodDocumentUrl: getWPodDocumentUrl
  };
})();
