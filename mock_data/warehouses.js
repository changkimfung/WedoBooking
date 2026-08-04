/**
 * 仓库主数据（入库单收货仓、预约目的仓、海外仓审核、邮件地址簿共用）
 * 加载顺序：须在 inOrder.js、deliveryAppointment.js 之前引入
 */
var WAREHOUSE_REGISTRY = [
  {
    id: 'cn-shenzhen-a',
    name: '深圳A仓',
    nameEn: 'Shenzhen Warehouse A (Demo)',
    aliases: ['深圳仓'],
    region: 'domestic',
    address: '广东省深圳市（演示地址）',
    phone: '0755-00000000',
    emails: ['wh-sz-a@demo.wedo'],
    ccEmails: ['booking-demo@demo.wedo']
  },
  {
    id: 'us-west-ca91761',
    name: '美西仓库(CA-91761)',
    nameEn: 'US West Warehouse (CA-91761)',
    aliases: ['美西仓', '美西4仓', '美西仓库'],
    region: 'overseas',
    address: '2281 S Haven Ave, Ontario, CA 91761',
    phone: '6267168641',
    emails: ['wh-ca91761-a@demo.wedo', 'wh-ca91761-b@demo.wedo'],
    ccEmails: ['booking-demo@demo.wedo'],
    edaSiteCode: 'EDAHOU01-1B01',
    warehouseNotifyCode: 'USAHOU-K001',
    warehouseShortCode: 'USAHOU',
    warehouseCnName: '休斯顿仓'
  },
  {
    id: 'us-east-nj08807',
    name: '美东六仓(NJ-08807)',
    nameEn: 'US East Warehouse #6 (NJ-08807)',
    aliases: ['美东仓', '美东六仓'],
    region: 'overseas',
    edaSiteCode: 'EDANJ01-1A01',
    warehouseNotifyCode: 'USANJ-K002',
    warehouseShortCode: 'USANJ',
    warehouseCnName: '新泽西仓',
    address: '1120 US 22 Building 2, Bridgewater, NJ 08807',
    phone: '(848) 667-1949',
    emails: ['wh-nj08807-a@demo.wedo', 'wh-nj08807-b@demo.wedo'],
    ccEmails: ['booking-demo@demo.wedo']
  },
  {
    id: 'us-central-in46052',
    name: '美中仓库(IN-46052)',
    nameEn: 'US Central Warehouse (IN-46052)',
    aliases: ['美中仓', '美中仓库'],
    region: 'overseas',
    address: '5301 State Road 267 (Dock#14-#16), Lebanon, Indiana 46052',
    phone: '4194968621',
    emails: ['wh-in46052-a@demo.wedo', 'wh-in46052-b@demo.wedo'],
    ccEmails: ['booking-demo@demo.wedo']
  },
  {
    id: 'us-south-tx77507',
    name: '美南仓库(TX-77507)',
    nameEn: 'US South Warehouse (TX-77507)',
    aliases: ['美南仓', '美南仓库'],
    region: 'overseas',
    address: 'Loading Dock#1--#10, 4330 Underwood Rd, Ste.100, Pasadena, TX 77507',
    phone: '6267168641',
    emails: ['wh-tx77507-a@demo.wedo'],
    ccEmails: ['booking-demo@demo.wedo']
  },
  {
    id: 'us-southeast-ga31302',
    name: '美东南仓(GA-31302)',
    nameEn: 'US Southeast Warehouse (GA-31302)',
    aliases: ['美东南仓'],
    region: 'overseas',
    address: '600 Bloomingdale Rd, Bloomingdale, GA 31302',
    phone: '6789071206',
    emails: ['wh-ga31302-a@demo.wedo', 'wh-ga31302-b@demo.wedo'],
    ccEmails: ['booking-demo@demo.wedo']
  }
];

/** 入库单/预约新建 · 目的仓下拉（标准名称） */
var MOCK_IN_ORDER_WAREHOUSES = WAREHOUSE_REGISTRY.map(function (entry) {
  return entry.name;
});

/** 海外仓审核 · 仓库下拉 */
var MOCK_US_WAREHOUSE_OPTIONS = WAREHOUSE_REGISTRY.filter(function (entry) {
  return entry.region === 'overseas';
}).map(function (entry) {
  return { id: entry.id, name: entry.name, address: entry.address };
});

/** 仓库地址簿（新建预约提示 + 邮件页脚） */
var MOCK_WAREHOUSE_ADDRESS_BOOK = WAREHOUSE_REGISTRY.map(function (entry) {
  return {
    id: entry.id,
    name: entry.name,
    aliases: entry.aliases || [],
    address: entry.address,
    phone: entry.phone,
    emails: entry.emails || [],
    ccEmails: entry.ccEmails || [],
    edaSiteCode: entry.edaSiteCode || '',
    warehouseNotifyCode: entry.warehouseNotifyCode || '',
    warehouseShortCode: entry.warehouseShortCode || '',
    warehouseCnName: entry.warehouseCnName || entry.name
  };
});

function findWarehouseRegistryEntry(warehouseName) {
  var wh = String(warehouseName || '').trim();
  if (!wh) return null;
  var i;
  for (i = 0; i < WAREHOUSE_REGISTRY.length; i++) {
    if (WAREHOUSE_REGISTRY[i].name === wh) return WAREHOUSE_REGISTRY[i];
  }
  for (i = 0; i < WAREHOUSE_REGISTRY.length; i++) {
    var aliases = WAREHOUSE_REGISTRY[i].aliases || [];
    for (var j = 0; j < aliases.length; j++) {
      if (aliases[j] === wh) return WAREHOUSE_REGISTRY[i];
    }
  }
  for (i = 0; i < WAREHOUSE_REGISTRY.length; i++) {
    var entry = WAREHOUSE_REGISTRY[i];
    if (wh.indexOf(entry.name) >= 0 || entry.name.indexOf(wh) >= 0) return entry;
    var als = entry.aliases || [];
    for (var k = 0; k < als.length; k++) {
      if (wh.indexOf(als[k]) >= 0 || als[k].indexOf(wh) >= 0) return entry;
    }
  }
  return null;
}

/** 将历史别名（美西仓、美东仓、美西4仓 等）规范为标准名称 */
function normalizeWarehouseName(warehouseName) {
  var entry = findWarehouseRegistryEntry(warehouseName);
  return entry ? entry.name : String(warehouseName || '').trim();
}

function isSameWarehouseName(nameA, nameB) {
  if (nameA === nameB) return true;
  var entryA = findWarehouseRegistryEntry(nameA);
  var entryB = findWarehouseRegistryEntry(nameB);
  return !!(entryA && entryB && entryA.id === entryB.id);
}

/** BOL / 英文文档：仓库标准英文名，未命中注册表时尽量保留括号内区域码 */
function getWarehouseEnglishName(warehouseName) {
  var entry = findWarehouseRegistryEntry(warehouseName);
  if (entry && entry.nameEn) return entry.nameEn;
  var raw = String(warehouseName || '').trim();
  if (!raw) return '';
  var m = raw.match(/\(([^)]+)\)/);
  if (m && m[1]) return 'Warehouse (' + m[1].trim() + ')';
  return raw;
}
