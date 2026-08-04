/**
 * 仓库地址簿（Node + 与 mock_data/warehouses.js 保持同步）
 * emails 为模拟地址，仅用于邮件页脚展示
 */
var BOOK = [
  {
    id: 'cn-shenzhen-a',
    name: '深圳A仓',
    aliases: ['深圳仓'],
    address: '广东省深圳市（演示地址）',
    phone: '0755-00000000',
    emails: ['wh-sz-a@demo.wedo'],
    ccEmails: ['booking-demo@demo.wedo']
  },
  {
    id: 'us-west-ca91761',
    name: '美西仓库(CA-91761)',
    aliases: ['美西仓', '美西4仓', '美西仓库'],
    address: '2281 S Haven Ave, Ontario, CA 91761',
    phone: '6267168641',
    emails: ['wh-ca91761-a@demo.wedo', 'wh-ca91761-b@demo.wedo'],
    ccEmails: ['booking-demo@demo.wedo']
  },
  {
    id: 'us-east-nj08807',
    name: '美东六仓(NJ-08807)',
    aliases: ['美东仓', '美东六仓'],
    address: '1120 US 22 Building 2, Bridgewater, NJ 08807',
    phone: '(848) 667-1949',
    emails: ['wh-nj08807-a@demo.wedo', 'wh-nj08807-b@demo.wedo'],
    ccEmails: ['booking-demo@demo.wedo']
  },
  {
    id: 'us-central-in46052',
    name: '美中仓库(IN-46052)',
    aliases: ['美中仓', '美中仓库'],
    address: '5301 State Road 267 (Dock#14-#16), Lebanon, Indiana 46052',
    phone: '4194968621',
    emails: ['wh-in46052-a@demo.wedo', 'wh-in46052-b@demo.wedo'],
    ccEmails: ['booking-demo@demo.wedo']
  },
  {
    id: 'us-south-tx77507',
    name: '美南仓库(TX-77507)',
    aliases: ['美南仓', '美南仓库'],
    address: 'Loading Dock#1--#10, 4330 Underwood Rd, Ste.100, Pasadena, TX 77507',
    phone: '6267168641',
    emails: ['wh-tx77507-a@demo.wedo'],
    ccEmails: ['booking-demo@demo.wedo']
  },
  {
    id: 'us-southeast-ga31302',
    name: '美东南仓(GA-31302)',
    aliases: ['美东南仓'],
    address: '600 Bloomingdale Rd, Bloomingdale, GA 31302',
    phone: '6789071206',
    emails: ['wh-ga31302-a@demo.wedo', 'wh-ga31302-b@demo.wedo'],
    ccEmails: ['booking-demo@demo.wedo']
  }
];

var CONTACT_MARKER = '如有特殊疑问';

function normalizeWarehouseName(warehouseName) {
  var entry = findWarehouseAddressBook(warehouseName);
  return entry ? entry.name : String(warehouseName || '').trim();
}

function findWarehouseAddressBook(warehouseName) {
  var wh = String(warehouseName || '').trim();
  if (!wh) return null;
  var i;
  for (i = 0; i < BOOK.length; i++) {
    if (BOOK[i].name === wh) return BOOK[i];
  }
  for (i = 0; i < BOOK.length; i++) {
    var aliases = BOOK[i].aliases || [];
    for (var j = 0; j < aliases.length; j++) {
      if (aliases[j] === wh) return BOOK[i];
    }
  }
  for (i = 0; i < BOOK.length; i++) {
    var entry = BOOK[i];
    if (wh.indexOf(entry.name) >= 0 || entry.name.indexOf(wh) >= 0) return entry;
    var als = entry.aliases || [];
    for (var k = 0; k < als.length; k++) {
      if (wh.indexOf(als[k]) >= 0 || als[k].indexOf(wh) >= 0) return entry;
    }
  }
  return null;
}

function extractWarehouseFromFields(fields) {
  if (!Array.isArray(fields)) return '';
  var keys = ['目的地', '目的仓', '预约仓库', '预约仓库地址'];
  for (var i = 0; i < fields.length; i++) {
    var label = String(fields[i].label || '');
    for (var k = 0; k < keys.length; k++) {
      if (label.indexOf(keys[k]) >= 0) {
        return String(fields[i].value || '').replace(/\s*\([^)]*\)\s*$/, '').trim();
      }
    }
  }
  return '';
}

function resolveWarehouseForContact(source) {
  if (!source) return '';
  var candidates = [
    source.confirmedWarehouse,
    source.warehouse,
    extractWarehouseFromFields(source.fields)
  ];
  var orders = source.inboundOrders || [];
  for (var i = 0; i < orders.length; i++) {
    candidates.push(orders[i].warehouse);
  }
  for (var c = 0; c < candidates.length; c++) {
    var name = String(candidates[c] || '').trim();
    if (name && findWarehouseAddressBook(name)) return name;
  }
  return String(source.warehouse || source.confirmedWarehouse || '').trim();
}

function getWarehouseContactEmailFooter(warehouseName) {
  var info = findWarehouseAddressBook(warehouseName);
  if (!info || !info.emails || !info.emails.length) return '';
  var text = info.emails.join('\u3001');
  if (info.ccEmails && info.ccEmails.length) {
    text += '\uff08\u6284\u9001 ' + info.ccEmails.join('\u3001') + '\uff09';
  }
  return CONTACT_MARKER + '\uff0c\u8bf7\u53d1\u9001\u90ae\u4ef6\u81f3\u90ae\u7bb1 ' + text;
}

function enrichPayloadWithWarehouseContact(payload) {
  if (!payload) return payload;
  var body = payload.body || '';
  var footer = payload.footerNote || '';
  if (body.indexOf(CONTACT_MARKER) >= 0 || footer.indexOf(CONTACT_MARKER) >= 0) {
    return payload;
  }
  var wh = resolveWarehouseForContact(payload);
  var contactFooter = getWarehouseContactEmailFooter(wh);
  if (!contactFooter) return payload;
  var out = Object.assign({}, payload);
  out.warehouse = wh;
  out.warehouseContactFooter = contactFooter;
  out.body = body + (body ? '\n\n' : '') + contactFooter;
  out.footerNote = footer + (footer ? '\n\n' : '') + contactFooter;
  return out;
}

module.exports = {
  BOOK: BOOK,
  normalizeWarehouseName: normalizeWarehouseName,
  findWarehouseAddressBook: findWarehouseAddressBook,
  resolveWarehouseForContact: resolveWarehouseForContact,
  getWarehouseContactEmailFooter: getWarehouseContactEmailFooter,
  enrichPayloadWithWarehouseContact: enrichPayloadWithWarehouseContact
};
