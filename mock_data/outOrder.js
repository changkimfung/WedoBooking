/**
 * 运德海外仓（us）- 出库单（发货复核）模拟数据
 * 说明：checkStatus 仅为初始值；运行时状态以 ShipCheckStore 中最新复核档案为准，
 *       无任何档案时回退到该初始值。
 */

/** 中国时间（UTC+8）毫秒 → "YYYY-MM-DD HH:mm:ss" */
function mockChinaTimeStr(ms) {
  var d = new Date(ms + 8 * 3600 * 1000);
  var p = function (n) { return (n < 10 ? '0' : '') + n; };
  return d.getUTCFullYear() + '-' + p(d.getUTCMonth() + 1) + '-' + p(d.getUTCDate()) +
    ' ' + p(d.getUTCHours()) + ':' + p(d.getUTCMinutes()) + ':' + p(d.getUTCSeconds());
}

/** 某时刻在指定时区的自然日（YYYY-MM-DD） */
function mockDayInTz(ms, tz) {
  var f = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' });
  return f.format(new Date(ms));
}

/**
 * 发货时间基准：取当前时刻回退 minutes 分钟后的中国时间字符串。
 * 自动收敛到「中国/美西两个时区均不翻日」的安全偏移，
 * 保证切换到任一时区时当日看板都能统计到这批订单。
 */
var MOCK_SHIP_NOW = Date.now();
function mockShipDate(minutesAgo) {
  var m = minutesAgo || 0;
  while (m > 0) {
    var t = MOCK_SHIP_NOW - m * 60000;
    if (mockDayInTz(t, 'Asia/Shanghai') === mockDayInTz(MOCK_SHIP_NOW, 'Asia/Shanghai') &&
        mockDayInTz(t, 'America/Los_Angeles') === mockDayInTz(MOCK_SHIP_NOW, 'America/Los_Angeles')) break;
    m--;
  }
  return mockChinaTimeStr(MOCK_SHIP_NOW - m * 60000);
}

/** 中国时间当日（兼容保留） */
var MOCK_OUT_ORDER_TODAY = mockChinaTimeStr(Date.now()).substring(0, 10);

var MOCK_OUT_ORDER_LIST = [
  {
    orderNo: 'C043800123411',
    trackingNo: 'JD0438012341101',      // 订单面单号（PDA第一步扫描匹配字段）
    userCode: 'US0008122',
    warehouse: '美西一仓(LA)',
    shipChannel: 'FedEx',               // 运输方式（运输渠道）
    createDate: '2026-08-01 09:58:12',
    shipDate: mockShipDate(8),           // 发货时间（中国时间存储，展示/搜索随时区换算）
    multiParcel: true,                  // 是否一票多件
    checkStatus: '未复核',              // 未复核 | 部分复核 | 复核完成 | 复核异常
    items: [
      { itemNo: 'YND020022', qty: 4 },
      { itemNo: 'YND020035', qty: 4 }
    ]
  },
  {
    orderNo: 'C043800123412',
    trackingNo: 'YT0438012341202',
    userCode: 'US0008122',
    warehouse: '美西一仓(LA)',
    shipChannel: 'USPS',
    createDate: '2026-08-01 10:22:45',
    shipDate: mockShipDate(12),
    multiParcel: false,
    checkStatus: '未复核',
    items: [
      { itemNo: 'YND010008', qty: 2 }
    ]
  },
  {
    orderNo: 'C043800123413',
    trackingNo: 'SF0438012341303',
    userCode: 'US0006731',
    warehouse: '美西一仓(LA)',
    shipChannel: 'UPS',
    createDate: '2026-08-01 14:10:08',
    shipDate: mockShipDate(16),
    multiParcel: true,
    checkStatus: '未复核',
    items: [
      { itemNo: 'YND030011', qty: 6 },
      { itemNo: 'YND030012', qty: 3 },
      { itemNo: 'YND030019', qty: 2 }
    ]
  },
  {
    orderNo: 'C043800123414',
    trackingNo: 'JD0438012341404',
    userCode: 'US0006731',
    warehouse: '美西一仓(LA)',
    shipChannel: 'FedEx',
    createDate: '2026-07-30 09:12:33',
    shipDate: mockShipDate(20),
    multiParcel: false,
    checkStatus: '复核完成',            // 初始即已复核完成，用于演示 PDA 拦截提示
    items: [
      { itemNo: 'YND020022', qty: 2 },
      { itemNo: 'YND010008', qty: 3 }
    ]
  },
  {
    orderNo: 'C043800123415',
    trackingNo: 'YD0438012341505',
    userCode: 'US0009055',
    warehouse: '美西一仓(LA)',
    shipChannel: 'USPS',
    createDate: '2026-08-02 08:45:50',
    shipDate: mockShipDate(24),
    multiParcel: false,
    checkStatus: '未复核',
    items: [
      { itemNo: 'YND050001', qty: 10 }
    ]
  },
  {
    orderNo: 'C043800123416',
    trackingNo: 'ZTO438012341606',
    userCode: 'US0009055',
    warehouse: '美西一仓(LA)',
    shipChannel: 'DHL',
    createDate: '2026-08-02 10:30:16',
    shipDate: mockShipDate(28),
    multiParcel: true,
    checkStatus: '未复核',
    items: [
      { itemNo: 'YND060001', qty: 5 },
      { itemNo: 'YND060002', qty: 5 },
      { itemNo: 'YND060003', qty: 1 },
      { itemNo: 'YND060004', qty: 2 }
    ]
  }
];

/* ========== 批量生成演示数据（补足至 50 单，确定性随机保证刷新后数据稳定） ========== */
(function () {
  var seed = 20260804;
  function rand() { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; }
  function randInt(min, max) { return min + Math.floor(rand() * (max - min + 1)); }
  function pick(arr) { return arr[Math.floor(rand() * arr.length)]; }
  function pad2(n) { return (n < 10 ? '0' : '') + n; }

  var ITEM_POOL = ['YND010008', 'YND020022', 'YND020035', 'YND030011', 'YND030012',
    'YND030019', 'YND050001', 'YND060001', 'YND060002', 'YND060003', 'YND060004',
    'YND070005', 'YND070006'];
  var CHANNELS = ['FedEx', 'USPS', 'UPS', 'DHL'];
  var PREFIXES = ['JD', 'YT', 'SF', 'YD', 'ZTO'];
  var USER_POOL = ['US0008122', 'US0006731', 'US0009055', 'US0010233', 'US0011480'];

  // 38 单初始状态分布（配合前 6 单共 50 单，看板四态均有数据）
  var plan = [];
  var i;
  for (i = 0; i < 15; i++) plan.push('复核完成');
  for (i = 0; i < 7; i++) plan.push('复核异常');
  for (i = 0; i < 5; i++) plan.push('部分复核');
  for (i = 0; i < 11; i++) plan.push('未复核');

  // 创建时间取前一天
  var yd = new Date();
  yd.setDate(yd.getDate() - 1);
  var yest = yd.getFullYear() + '-' + pad2(yd.getMonth() + 1) + '-' + pad2(yd.getDate());

  for (var n = 17; n <= 60; n++) {
    var st = plan.splice(Math.floor(rand() * plan.length), 1)[0];
    var kinds = randInt(1, 3);
    var items = [];
    while (items.length < kinds) {
      var itemNo = pick(ITEM_POOL);
      var dup = false;
      for (var k = 0; k < items.length; k++) {
        if (items[k].itemNo === itemNo) dup = true;
      }
      if (!dup) items.push({ itemNo: itemNo, qty: randInt(1, 8) });
    }
    var nn = pad2(n);
    MOCK_OUT_ORDER_LIST.push({
      orderNo: 'C0438001234' + nn,
      trackingNo: pick(PREFIXES) + '043801234' + nn + pad2(randInt(10, 99)),
      userCode: pick(USER_POOL),
      warehouse: '美西一仓(LA)',
      shipChannel: pick(CHANNELS),
      createDate: yest + ' ' + pad2(randInt(8, 18)) + ':' + pad2(randInt(0, 59)) + ':' + pad2(randInt(0, 59)),
      shipDate: mockShipDate(randInt(1, 90)),   // 当前时刻回退随机分钟，两种时区均为当日
      multiParcel: rand() < 0.3,
      checkStatus: st,
      items: items
    });
  }
})();

/** 出库单公共工具 */
var OutOrderCommon = {
  /** 按面单号或出库单号匹配（忽略大小写与首尾空格） */
  find: function (code) {
    if (!code) return null;
    var normalized = String(code).trim().toUpperCase();
    var list = MOCK_OUT_ORDER_LIST || [];
    for (var i = 0; i < list.length; i++) {
      var o = list[i];
      if (String(o.trackingNo || '').trim().toUpperCase() === normalized ||
          String(o.orderNo || '').trim().toUpperCase() === normalized) {
        return o;
      }
    }
    return null;
  },
  /** SKU 种类数 */
  skuKinds: function (order) {
    return order && order.items ? order.items.length : 0;
  },
  /** SKU 总数（PCS） */
  totalQty: function (order) {
    var total = 0;
    if (order && order.items) {
      for (var i = 0; i < order.items.length; i++) total += order.items[i].qty || 0;
    }
    return total;
  }
};
