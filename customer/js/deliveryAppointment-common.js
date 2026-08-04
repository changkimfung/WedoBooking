/**
 * 预约送仓 - 公共数据与状态机（客户前台）
 */
var DeliveryAppointmentCommon = (function () {
  var STORAGE_KEY = 'pm_demo_delivery_appointments';
  var MOCK_PERSIST_API = '/api/mock/delivery-appointment';
  var APPOINTMENT_NOTIFY_EMAIL = 'zhengjianfengb@sailvan.com';
  var EMPTY_CONTAINER_RETURN_NOTIFY_EMAIL = 'liuyongmeib@sailvan.com';
  var APPOINTMENT_NOTIFY_API = '/api/mock/appointment-notify-email';
  var NOTIFY_MAIL_STORAGE_KEY = 'pm_demo_appointment_notify_mail';
  var APPOINTMENT_MAIL_BRAND_LOGO_URL = '';
  var APPOINTMENT_MAIL_BRAND_WATERMARK_URL = '';
  var _cachedPublicBaseUrl = null;

  function loadPublicBaseUrlFromServer() {
    if (typeof XMLHttpRequest === 'undefined') return '';
    try {
      var xhr = new XMLHttpRequest();
      xhr.open('GET', '/api/mock/site-config', false);
      xhr.send(null);
      if (xhr.status >= 200 && xhr.status < 300 && xhr.responseText) {
        var cfg = JSON.parse(xhr.responseText);
        return cfg && cfg.publicBaseUrl ? String(cfg.publicBaseUrl).replace(/\/+$/, '') : '';
      }
    } catch (e) { /* ignore */ }
    return '';
  }

  /** 优先用当前页面 origin：本地即 localhost，测试环境即测试地址 */
  function getPublicBaseUrl() {
    if (_cachedPublicBaseUrl != null) return _cachedPublicBaseUrl;
    if (typeof window !== 'undefined' && window.location && window.location.origin) {
      _cachedPublicBaseUrl = window.location.origin;
      return _cachedPublicBaseUrl;
    }
    _cachedPublicBaseUrl = loadPublicBaseUrlFromServer();
    if (!_cachedPublicBaseUrl) _cachedPublicBaseUrl = '';
    return _cachedPublicBaseUrl;
  }

  function resolvePublicUrl(link) {
    if (link == null || link === '') return '';
    var url = String(link).trim();
    if (!url) return '';
    if (/^https?:\/\//i.test(url)) return url;
    var base = getPublicBaseUrl();
    if (!base) return url;
    return base + (url.charAt(0) === '/' ? url : '/' + url);
  }

  function getCurrentCustomerCode() {
    return typeof MOCK_CUSTOMER_CODE !== 'undefined' ? MOCK_CUSTOMER_CODE : 'CN0000438';
  }

  /**
   * 数据源唯一性约定：
   * - 所有读取均回到 mock_data/deliveryAppointment.js 暴露的 window.MOCK_DELIVERY_APPOINTMENT_LIST；
   * - sessionStorage 缓存已废弃（曾因合并逻辑导致用户操作被回退），保留 getStoredList 返回 null
   *   以让旧调用路径无缝兼容；
   * - 写操作链路：内存常量更新 → POST 写源文件 → GET 拉最新源覆盖内存常量。
   */
  function getStoredList() {
    return null;
  }

  function persistList(list) {
    if (typeof window !== 'undefined') {
      window.MOCK_DELIVERY_APPOINTMENT_LIST = JSON.parse(JSON.stringify(list));
    } else if (typeof MOCK_DELIVERY_APPOINTMENT_LIST !== 'undefined') {
      MOCK_DELIVERY_APPOINTMENT_LIST.length = 0;
      list.forEach(function (i) { MOCK_DELIVERY_APPOINTMENT_LIST.push(JSON.parse(JSON.stringify(i))); });
    }
  }

  /**
   * 将完整列表写入 mock_data/deliveryAppointment.js（需 npm run dev 本地服务）
   */
  function persistListToSource(done) {
    var list = getBaseList();
    if (typeof fetch === 'undefined') {
      if (done) done(new Error('当前环境不支持 fetch'));
      return;
    }
    fetch(MOCK_PERSIST_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ list: list })
    })
      .then(function (res) {
        return res.json().then(function (body) {
          if (!res.ok) throw new Error((body && body.error) || '写入源文件失败');
          if (done) done(null, body);
        });
      })
      .catch(function (err) {
        if (done) done(err);
      });
  }

  /**
   * 拉取服务端最新的源文件数据并覆盖 window.MOCK_DELIVERY_APPOINTMENT_LIST，
   * 保证浏览器内存里的列表与磁盘文件强一致。
   */
  function fetchAndApplyMockSource(done) {
    if (typeof fetch === 'undefined') {
      if (done) done(new Error('当前环境不支持 fetch'));
      return;
    }
    fetch(MOCK_PERSIST_API, { method: 'GET' })
      .then(function (res) {
        return res.json().then(function (body) {
          if (!res.ok) throw new Error((body && body.error) || '读取源文件失败');
          if (body && Array.isArray(body.list) && typeof window !== 'undefined') {
            window.MOCK_DELIVERY_APPOINTMENT_LIST = body.list;
          }
          if (done) done(null, body);
        });
      })
      .catch(function (err) {
        if (done) done(err);
      });
  }

  function getMockSourceList() {
    return typeof MOCK_DELIVERY_APPOINTMENT_LIST !== 'undefined'
      ? JSON.parse(JSON.stringify(MOCK_DELIVERY_APPOINTMENT_LIST))
      : [];
  }

  function getLatestOperationTime(item) {
    if (!item || !item.operationLogs || !item.operationLogs.length) return 0;
    var last = item.operationLogs[item.operationLogs.length - 1];
    var t = new Date(String(last.time || '').replace(/-/g, '/')).getTime();
    return isNaN(t) ? 0 : t;
  }

  /**
   * 合并源文件 mock 与 sessionStorage：
   * - sessionStorage 代表当前会话内用户/海外仓的真实操作，必须优先；
   * - mock 源仅作为兜底，提供 stored 里尚未出现的新条目（如演示新增数据）。
   * 旧策略「操作日志最新时间者胜」在 mock 数据故意写未来时间时会反向覆盖用户操作，
   * 表现为点击后状态被回退，因此改为 stored 永远优先。
   */
  function mergeAppointmentLists(mockList, storedList) {
    var byId = {};
    var order = [];
    function touch(item) {
      if (!item || !item.id) return;
      if (!byId[item.id]) order.push(item.id);
      byId[item.id] = item;
    }
    mockList.forEach(function (item) { touch(JSON.parse(JSON.stringify(item))); });
    storedList.forEach(function (stored) {
      if (!stored || !stored.id) return;
      touch(JSON.parse(JSON.stringify(stored)));
    });
    return order.map(function (id) { return byId[id]; });
  }

  function listsDiffer(a, b) {
    if (!a || !b || a.length !== b.length) return true;
    for (var i = 0; i < a.length; i++) {
      if (a[i].id !== b[i].id || a[i].status !== b[i].status) return true;
    }
    return false;
  }

  function getBaseList() {
    var mockList = getMockSourceList();
    var stored = getStoredList();
    if (!stored) return mockList;
    var merged = mergeAppointmentLists(mockList, stored);
    if (listsDiffer(stored, merged)) {
      persistList(merged);
    }
    return merged;
  }

  function getAppointmentList(forWh) {
    var list = getBaseList();
    if (forWh) return list;
    var code = getCurrentCustomerCode();
    return list.filter(function (item) {
      return item.customerCode === code && item.bookChannel !== 'shipping';
    });
  }

  function saveAppointmentList(list, forWh) {
    if (forWh) {
      persistList(list);
      return;
    }
    var code = getCurrentCustomerCode();
    var all = getBaseList();
    var others = all.filter(function (item) { return item.customerCode !== code; });
    persistList(others.concat(list));
  }

  function getById(id, forWh) {
    var list = forWh ? getBaseList() : getAppointmentList(false);
    for (var i = 0; i < list.length; i++) {
      if (list[i].id === id) return list[i];
    }
    return null;
  }

  function getByDeliveryCode(code) {
    if (!code) return null;
    var normalized = String(code).trim().toUpperCase();
    var list = getBaseList();
    for (var i = 0; i < list.length; i++) {
      var dc = list[i].deliveryCode;
      if (dc && String(dc).trim().toUpperCase() === normalized) return list[i];
    }
    return null;
  }

  /**
   * 写入/更新完整模拟数据集（sessionStorage，首次无缓存时基于 MOCK_DELIVERY_APPOINTMENT_LIST）
   */
  function applyEmailNotifyFlags(oldItem, record) {
    // 邮件触发以明确状态流转为准，旧的 _emailNotifyActive 标记不再参与判断。
    if (record) delete record._emailNotifyActive;
  }

  function isStatusTransition(oldItem, record, fromList, toStatus) {
    if (!oldItem || !record || oldItem.status === record.status) return false;
    return fromList.indexOf(oldItem.status) >= 0 && record.status === toStatus;
  }

  function joinUniqueEmails(emailCsv) {
    var list = [];
    String(emailCsv || '').split(',').forEach(function (email) {
      var v = String(email || '').trim();
      if (v && list.indexOf(v) === -1) list.push(v);
    });
    return list;
  }

  /** 演示环境：所有通知邮件额外抄送 liuyongmeib（与还柜通知一致） */
  function withDemoCcEmail(emailCsv) {
    var list = joinUniqueEmails(emailCsv);
    if (EMPTY_CONTAINER_RETURN_NOTIFY_EMAIL &&
      list.indexOf(EMPTY_CONTAINER_RETURN_NOTIFY_EMAIL) === -1) {
      list.push(EMPTY_CONTAINER_RETURN_NOTIFY_EMAIL);
    }
    return list.join(',');
  }

  function getAppointmentNotifyRecipients(record, recipientRole) {
    return withDemoCcEmail(APPOINTMENT_NOTIFY_EMAIL);
  }

  function compactLines(lines) {
    return lines.filter(function (line) {
      return line !== null && line !== undefined && line !== false;
    });
  }

  function isFclDeliveryType(record) {
    return !!(record && record.deliveryType === '\u6574\u67dc');
  }

  function getEmailPartyFieldEntries(record) {
    var entries = [
      { label: '\u9884\u7ea6\u65b9', value: getBookerParty(record) },
      { label: '\u9001\u4ed3\u7c7b\u578b', value: (record && record.deliveryType) || '-' }
    ];
    if (isFclDeliveryType(record)) {
      entries.push({ label: '\u96c6\u88c5\u7bb1\u53f7', value: (record && record.containerNo) || '-' });
    }
    return entries;
  }

  function getEmailPartyBodyLines(record) {
    var lines = [
      '\u9884\u7ea6\u65b9\uff1a' + getBookerParty(record),
      '\u9001\u4ed3\u7c7b\u578b\uff1a' + ((record && record.deliveryType) || '-')
    ];
    if (isFclDeliveryType(record)) {
      lines.push('\u96c6\u88c5\u7bb1\u53f7\uff1a' + ((record && record.containerNo) || '-'));
    }
    return lines;
  }

  function commonAppointmentFields(record, oldItem) {
    var wh = record.warehouse || record.confirmedWarehouse || '-';
    var fields = [
      { label: '\u9884\u7ea6\u5355\u53f7', value: record.appointmentNo || '-' }
    ];
    getEmailPartyFieldEntries(record).forEach(function (field) {
      fields.push(field);
    });
    fields.push(
      { label: '\u9001\u4ed3\u7801', value: record.deliveryCode || '-' },
      { label: '\u5ba2\u6237\u7f16\u53f7', value: record.customerCode || '-' },
      { label: '\u9884\u7ea6\u4ed3\u5e93', value: wh },
      { label: '\u539f\u72b6\u6001', value: (oldItem && oldItem.status) || '-' },
      { label: '\u65b0\u72b6\u6001', value: record.status || '-' }
    );
    return fields;
  }

  function appendField(fields, label, value) {
    fields.push({ label: label, value: value == null || value === '' ? '-' : value });
  }

  function getAppointmentActionUrl(record) {
    var link = defaultBookingLink(record);
    if (!link) return '';
    return resolvePublicUrl(link);
  }

  function getAppointmentConfirmUrl(record) {
    if (!record || !record.deliveryCode) return getAppointmentActionUrl(record);
    return resolvePublicUrl('/fg/reservationDetail.html?code=' + encodeURIComponent(record.deliveryCode));
  }

  function getAppointmentWPodUrl(record) {
    var link = getWPodDocumentUrl(record, '/fg/');
    if (!link) return '';
    return resolvePublicUrl(link);
  }

  function getWarehouseAuditUrl(record) {
    if (!record || !record.id) return '';
    return resolvePublicUrl('/us/receiving-appointment-detail.html?id=' + encodeURIComponent(record.id));
  }

  function getMockWarehouseAddress(record) {
    var info = findWarehouseAddressBook(record && (record.warehouse || record.confirmedWarehouse));
    return info ? info.address : '-';
  }

  function getWarehouseAddressBook() {
    if (typeof MOCK_WAREHOUSE_ADDRESS_BOOK !== 'undefined' && MOCK_WAREHOUSE_ADDRESS_BOOK.length) {
      return MOCK_WAREHOUSE_ADDRESS_BOOK;
    }
    return [];
  }

  function findWarehouseAddressBook(warehouseName) {
    var wh = String(warehouseName || '').trim();
    if (!wh) return null;
    var book = getWarehouseAddressBook();
    var i;
    for (i = 0; i < book.length; i++) {
      if (book[i].name === wh) return book[i];
    }
    for (i = 0; i < book.length; i++) {
      var aliases = book[i].aliases || [];
      for (var j = 0; j < aliases.length; j++) {
        if (aliases[j] === wh) return book[i];
      }
    }
    for (i = 0; i < book.length; i++) {
      var entry = book[i];
      if (wh.indexOf(entry.name) >= 0 || entry.name.indexOf(wh) >= 0) return entry;
      var als = entry.aliases || [];
      for (var k = 0; k < als.length; k++) {
        if (wh.indexOf(als[k]) >= 0 || als[k].indexOf(wh) >= 0) return entry;
      }
    }
    return null;
  }

  function buildWarehouseAddressTipHtml(info) {
    if (!info) return '';
    return '<span class="warehouse-address-tip__text">地址：' + escapeHtmlLite(info.address || '-') + '</span>' +
      '<span class="warehouse-address-tip__text">电话：' + escapeHtmlLite(info.phone || '-') + '</span>';
  }

  function renderWarehouseAddressTip(containerEl, warehouseName) {
    if (!containerEl) return;
    var info = findWarehouseAddressBook(warehouseName);
    if (!info) {
      containerEl.classList.add('is-hidden');
      containerEl.innerHTML = '';
      return;
    }
    containerEl.classList.remove('is-hidden');
    containerEl.innerHTML = buildWarehouseAddressTipHtml(info);
  }

  function resolveWarehouseForContact(record) {
    if (!record) return '';
    var candidates = [
      record.confirmedWarehouse,
      record.warehouse
    ];
    var orders = record.inboundOrders || [];
    for (var i = 0; i < orders.length; i++) {
      candidates.push(orders[i].warehouse);
    }
    for (var c = 0; c < candidates.length; c++) {
      var name = String(candidates[c] || '').trim();
      if (name && findWarehouseAddressBook(name)) return normalizeWarehouseName(name);
    }
    return normalizeWarehouseName(record.warehouse || record.confirmedWarehouse || '');
  }

  function getWarehouseContactEmailFooter(warehouseName) {
    var info = findWarehouseAddressBook(warehouseName);
    if (!info || !info.emails || !info.emails.length) return '';
    var text = info.emails.join('\u3001');
    if (info.ccEmails && info.ccEmails.length) {
      text += '\uff08\u6284\u9001 ' + info.ccEmails.join('\u3001') + '\uff09';
    }
    return '\u5982\u6709\u7279\u6b8a\u7591\u95ee\uff0c\u8bf7\u53d1\u9001\u90ae\u4ef6\u81f3\u90ae\u7bb1 ' + text;
  }

  function buildAppointmentEmailPayload(oldItem, record, config) {
    var cfg = config || {};
    var fields = cfg.fields ? [] : commonAppointmentFields(record, oldItem);
    (cfg.fields || []).forEach(function (field) {
      appendField(fields, field.label, field.value);
    });
    (cfg.extraFields || []).forEach(function (field) {
      appendField(fields, field.label, field.value);
    });
    var lines = cfg.bodyLines || compactLines([
      cfg.intro,
      '',
      '\u9884\u7ea6\u5355\u53f7\uff1a' + (record.appointmentNo || '-'),
      '\u9001\u4ed3\u7801\uff1a' + (record.deliveryCode || '-'),
      '\u5ba2\u6237\u7f16\u53f7\uff1a' + (record.customerCode || '-'),
      '\u9884\u7ea6\u4ed3\u5e93\uff1a' + (record.warehouse || record.confirmedWarehouse || '-'),
      '\u539f\u72b6\u6001\uff1a' + (oldItem.status || '-'),
      '\u65b0\u72b6\u6001\uff1a' + (record.status || '-'),
      '\u53d8\u66f4\u65f6\u95f4\uff1a' + formatNow(),
      '',
      cfg.actionText
    ]);
    var warehouseForContact = resolveWarehouseForContact(record);
    var contactFooter = getWarehouseContactEmailFooter(warehouseForContact);
    if (contactFooter) lines = lines.concat(['', contactFooter]);
    var footerNote = cfg.footerNote || '';
    if (contactFooter) {
      footerNote = footerNote ? footerNote + '\n\n' + contactFooter : contactFooter;
    }
    return {
      to: getAppointmentNotifyRecipients(record, cfg.recipientRole),
      subject: cfg.subject,
      body: lines.join('\n'),
      templateKey: cfg.templateKey,
      recipientRole: cfg.recipientRole,
      title: cfg.title,
      intro: cfg.intro,
      actionText: cfg.actionText,
      actionUrl: cfg.actionUrl || '',
      actionLabel: cfg.actionLabel || '',
      footerNote: footerNote,
      footerColor: cfg.footerColor || '',
      hideRecipientRole: cfg.hideRecipientRole === true,
      hideActionButton: cfg.hideActionButton === true,
      inlineActionLinkLabel: cfg.inlineActionLinkLabel || '',
      warehouse: warehouseForContact,
      warehouseContactFooter: contactFooter,
      brand: {
        name: '\u8fd0\u5fb7\u4f9b\u5e94\u94fe',
        subtitle: 'WEDO SCM',
        description: '\u4e13\u6ce8\u5934\u7a0b\u8fd0\u8f93\u3001\u6d77\u5916\u4ed3\u50a8\u4e0e\u672b\u7aef\u914d\u9001\u7684\u9884\u7ea6\u534f\u540c\u670d\u52a1\u3002',
        logoUrl: APPOINTMENT_MAIL_BRAND_LOGO_URL,
        watermarkUrl: APPOINTMENT_MAIL_BRAND_WATERMARK_URL || APPOINTMENT_MAIL_BRAND_LOGO_URL
      },
      fields: fields,
      appointmentId: record.id || '',
      appointmentNo: record.appointmentNo || '',
      deliveryCode: record.deliveryCode || '',
      oldStatus: oldItem.status || '',
      newStatus: record.status || ''
    };
  }

  function buildAppointmentEmailMessages(oldItem, record) {
    if (!oldItem || !record || oldItem.status === record.status) return [];
    var no = record.appointmentNo || record.deliveryCode || record.id || '';
    var cargoSummary = '\u603b\u7bb1\u6570 ' + formatEstimatedCartons(record) + '\uff0c\u603b\u6258\u6570 ' + formatTotalPallets(record);
    var submitCargoSummary = formatEstimatedCartons(record) + ' cartons / ' + formatTotalPallets(record) + ' pallets';
    var whSlot = parseWarehouseSlot(record.warehouseConfirmedInboundTime);
    var inboundDate = whSlot.date || '-';
    var inboundTimeRange = whSlot.startHHMM && whSlot.endHHMM
      ? whSlot.startHHMM + ' - ' + whSlot.endHHMM
      : (record.warehouseConfirmedInboundTime || '-');
    var messages = [];

    if (isStatusTransition(oldItem, record, ['\u5f85\u9884\u7ea6', '\u5f85\u63d0\u4ea4'], '\u4ed3\u5e93\u5f85\u5ba1\u6838')) {
      messages.push(buildAppointmentEmailPayload(oldItem, record, {
        templateKey: 'submit_success_forwarder',
        recipientRole: '\u8d27\u4ee3',
        subject: '\u3010\u63d0\u4ea4\u6210\u529f\u901a\u77e5\u3011\u9884\u7ea6\u7533\u8bf7\u5df2\u6536\u5230 - ' + no,
        title: '\u9884\u7ea6\u7533\u8bf7\u5df2\u6536\u5230',
        intro: '\u60a8\u597d\uff01\n\n\u6211\u4eec\u5df2\u6210\u529f\u6536\u5230\u60a8\u63d0\u4ea4\u7684\u5165\u4ed3\u9884\u7ea6\u7533\u8bf7\uff0c\u76f8\u5173\u4fe1\u606f\u5982\u4e0b\uff1a',
        actionText: '\u6211\u4eec\u7684\u4ed3\u5e93\u7ba1\u7406\u5458\u5c06\u5728 72\u5c0f\u65f6\u5185 \u5b8c\u6210\u5ba1\u6838\u3002\n\u5ba1\u6838\u901a\u8fc7\u540e\uff0c\u7cfb\u7edf\u5c06\u81ea\u52a8\u5411\u60a8\u53d1\u9001\u5305\u542b\u6700\u7ec8\u786e\u8ba4\u65f6\u95f4\u548c\u8be6\u7ec6\u5378\u8d27\u5730\u5740\u7684\u90ae\u4ef6\u3002\n\u8bf7\u6ce8\u610f\uff1a\u5728\u6536\u5230\u6700\u7ec8\u786e\u8ba4\u90ae\u4ef6\u524d\uff0c\u8bf7\u52ff\u5b89\u6392\u53f8\u673a\u63d0\u524d\u6d3e\u9001\u3002\n\n\u795d\u5de5\u4f5c\u987a\u5229\uff01',
        footerNote: '\u4ed3\u5e93\u9884\u7ea6\u7cfb\u7edf\n[WEDO EXPRESS]\n\n\uff08\u5f53\u524d\u4e3a\u7cfb\u7edf\u90ae\u4ef6\uff0c\u8bf7\u52ff\u56de\u590d\uff09',
        footerColor: '#1f5f9f',
        hideRecipientRole: true,
        fields: [
          { label: '\u9884\u7ea6\u5355\u53f7', value: record.appointmentNo || '-' }
        ].concat(getEmailPartyFieldEntries(record)).concat([
          { label: '\u76ee\u7684\u5730', value: (record.warehouse || record.confirmedWarehouse || '-') + ' (US West Warehouse)' },
          { label: '\u9884\u7ea6\u4ed3\u5e93\u5730\u5740', value: getMockWarehouseAddress(record) },
          { label: '\u9884\u8ba1\u6d3e\u9001\u65e5\u671f', value: formatExpectedInboundDatesDisplay(record, record.warehouse) },
          { label: '\u8054\u7cfb\u7535\u8bdd', value: formatFgContactPhone(record) },
          { label: '\u5f53\u524d\u72b6\u6001', value: '\u5f85\u4ed3\u5e93\u5ba1\u6838\uff08Pending Review\uff09' },
          { label: '\u5907\u6ce8', value: record.remark || '-' },
          { label: '\u8d27\u91cf', value: submitCargoSummary }
        ]),
        bodyLines: [
          '\u60a8\u597d\uff01',
          '',
          '\u6211\u4eec\u5df2\u6210\u529f\u6536\u5230\u60a8\u63d0\u4ea4\u7684\u5165\u4ed3\u9884\u7ea6\u7533\u8bf7\uff0c\u76f8\u5173\u4fe1\u606f\u5982\u4e0b\uff1a',
          '',
          '\u9884\u7ea6\u5355\u53f7\uff1a' + (record.appointmentNo || '-')
        ].concat(getEmailPartyBodyLines(record)).concat([
          '\u76ee\u7684\u5730\uff1a' + (record.warehouse || record.confirmedWarehouse || '-') + ' (US West Warehouse)',
          '\u9884\u7ea6\u4ed3\u5e93\u5730\u5740\uff1a' + getMockWarehouseAddress(record),
          '\u9884\u8ba1\u6d3e\u9001\u65e5\u671f\uff1a' + formatExpectedInboundDatesDisplay(record, record.warehouse),
          '\u8054\u7cfb\u7535\u8bdd\uff1a' + formatFgContactPhone(record),
          '\u5f53\u524d\u72b6\u6001\uff1a\u5f85\u4ed3\u5e93\u5ba1\u6838\uff08Pending Review\uff09',
          '\u5907\u6ce8\uff1a' + (record.remark || '-'),
          '\u8d27\u91cf\uff1a' + submitCargoSummary,
          '',
          '\u6211\u4eec\u7684\u4ed3\u5e93\u7ba1\u7406\u5458\u5c06\u5728 72\u5c0f\u65f6\u5185 \u5b8c\u6210\u5ba1\u6838\u3002',
          '\u5ba1\u6838\u901a\u8fc7\u540e\uff0c\u7cfb\u7edf\u5c06\u81ea\u52a8\u5411\u60a8\u53d1\u9001\u5305\u542b\u6700\u7ec8\u786e\u8ba4\u65f6\u95f4\u548c\u8be6\u7ec6\u5378\u8d27\u5730\u5740\u7684\u90ae\u4ef6\u3002',
          '\u8bf7\u6ce8\u610f\uff1a\u5728\u6536\u5230\u6700\u7ec8\u786e\u8ba4\u90ae\u4ef6\u524d\uff0c\u8bf7\u52ff\u5b89\u6392\u53f8\u673a\u63d0\u524d\u6d3e\u9001\u3002',
          '',
          '\u795d\u5de5\u4f5c\u987a\u5229\uff01',
          '',
          '\u4ed3\u5e93\u9884\u7ea6\u7cfb\u7edf',
          '[WEDO EXPRESS]',
          '',
          '\uff08\u5f53\u524d\u4e3a\u7cfb\u7edf\u90ae\u4ef6\uff0c\u8bf7\u52ff\u56de\u590d\uff09'
        ])
      }));
      return messages;
    }

    if (isStatusTransition(oldItem, record, ['\u4ed3\u5e93\u5f85\u5ba1\u6838'], '\u5ba2\u6237\u5f85\u786e\u8ba4')) {
      messages.push(buildWarehouseSlotPendingCustomerConfirmPayload(oldItem, record, false));
      return messages;
    }

    if (isStatusTransition(oldItem, record, ['\u4ed3\u5e93\u5f85\u5ba1\u6838'], '\u9884\u7ea6\u5931\u8d25')) {
      messages.push(buildAppointmentEmailPayload(oldItem, record, {
        templateKey: 'appointment_rejected_forwarder',
        recipientRole: '\u8d27\u4ee3',
        subject: '\u3010\u9884\u7ea6\u5931\u8d25\u3011\u7533\u8bf7\u88ab\u9a73\u56de - \u5355\u53f7\uff1a' + no + ' - \u76ee\u7684\u5730\uff1a' + (record.warehouse || record.confirmedWarehouse || '-'),
        title: '\u7533\u8bf7\u88ab\u9a73\u56de',
        intro: '\u60a8\u597d\uff01\n\n\u5f88\u62b1\u6b49\u5730\u901a\u77e5\u60a8\uff0c\u60a8\u63d0\u4ea4\u7684\u5165\u4ed3\u9884\u7ea6\u7533\u8bf7\uff08\u5355\u53f7\uff1a' + no + '\uff09\u672a\u901a\u8fc7\u5ba1\u6838\u3002',
        actionText: '\u3010\u540e\u7eed\u64cd\u4f5c\u5efa\u8bae\u3011\n\n\u8bf7\u767b\u5f55\u9884\u7ea6\u540e\u53f0\uff0c\u6839\u636e\u4e0a\u8ff0\u539f\u56e0\u4fee\u6539\u76f8\u5173\u4fe1\u606f\u3002\n\u91cd\u65b0\u9009\u62e9\u53ef\u7528\u7684\u6d3e\u9001\u65f6\u6bb5\u3002\n\u6ce8\u610f\uff1a\u5728\u7533\u8bf7\u91cd\u65b0\u83b7\u5f97\u201c\u5ba1\u6838\u901a\u8fc7\u201d\u524d\uff0c\u8bf7\u52a1\u5fc5\u4e0d\u8981\u5b89\u6392\u53f8\u673a\u524d\u5f80\u4ed3\u5e93\uff0c\u5426\u5219\u5c06\u65e0\u6cd5\u5165\u4ed3\u5378\u8d27\u3002\n\n\u795d\u5de5\u4f5c\u987a\u5229\uff01',
        actionUrl: getAppointmentActionUrl(record),
        hideActionButton: true,
        inlineActionLinkLabel: '\u767b\u5f55\u9884\u7ea6\u540e\u53f0',
        footerNote: '\u4ed3\u5e93\u9884\u7ea6\u7cfb\u7edf\n[WEDO EXPRESS]\n\n\uff08\u5f53\u524d\u4e3a\u7cfb\u7edf\u90ae\u4ef6\uff0c\u8bf7\u52ff\u56de\u590d\uff09',
        footerColor: '#1f5f9f',
        hideRecipientRole: true,
        fields: getEmailPartyFieldEntries(record).concat([
          { label: '\u9a73\u56de\u539f\u56e0', value: record.rejectRemark || '\u8bf7\u5728\u6b64\u5904\u8f93\u5165\u5177\u4f53\u539f\u56e0\uff0c\u4f8b\u5982\uff1a\u6240\u9009\u65f6\u6bb5\u6708\u53f0\u5df2\u6ee1 / \u9644\u4ef6\u5355\u636e\u4e0d\u6e05\u6670 / \u7f3a\u5c11\u5546\u6807\u6388\u6743\u6587\u4ef6 / \u76ee\u7684\u5730\u4ed3\u5e93\u9009\u62e9\u9519\u8bef' }
        ]),
        bodyLines: [
          '\u60a8\u597d\uff01',
          '',
          '\u5f88\u62b1\u6b49\u5730\u901a\u77e5\u60a8\uff0c\u60a8\u63d0\u4ea4\u7684\u5165\u4ed3\u9884\u7ea6\u7533\u8bf7\uff08\u5355\u53f7\uff1a' + no + '\uff09\u672a\u901a\u8fc7\u5ba1\u6838\u3002',
          ''
        ].concat(getEmailPartyBodyLines(record)).concat([
          '',
          '\u3010\u9a73\u56de\u539f\u56e0\u3011',
          record.rejectRemark || '\u8bf7\u5728\u6b64\u5904\u8f93\u5165\u5177\u4f53\u539f\u56e0\uff0c\u4f8b\u5982\uff1a\u6240\u9009\u65f6\u6bb5\u6708\u53f0\u5df2\u6ee1 / \u9644\u4ef6\u5355\u636e\u4e0d\u6e05\u6670 / \u7f3a\u5c11\u5546\u6807\u6388\u6743\u6587\u4ef6 / \u76ee\u7684\u5730\u4ed3\u5e93\u9009\u62e9\u9519\u8bef',
          '',
          '\u3010\u540e\u7eed\u64cd\u4f5c\u5efa\u8bae\u3011',
          '',
          '\u8bf7\u767b\u5f55\u9884\u7ea6\u540e\u53f0\uff0c\u6839\u636e\u4e0a\u8ff0\u539f\u56e0\u4fee\u6539\u76f8\u5173\u4fe1\u606f\u3002',
          '\u91cd\u65b0\u9009\u62e9\u53ef\u7528\u7684\u6d3e\u9001\u65f6\u6bb5\u3002',
          '\u6ce8\u610f\uff1a\u5728\u7533\u8bf7\u91cd\u65b0\u83b7\u5f97\u201c\u5ba1\u6838\u901a\u8fc7\u201d\u524d\uff0c\u8bf7\u52a1\u5fc5\u4e0d\u8981\u5b89\u6392\u53f8\u673a\u524d\u5f80\u4ed3\u5e93\uff0c\u5426\u5219\u5c06\u65e0\u6cd5\u5165\u4ed3\u5378\u8d27\u3002',
          '',
          '\u795d\u5de5\u4f5c\u987a\u5229\uff01',
          '',
          '\u4ed3\u5e93\u9884\u7ea6\u7cfb\u7edf',
          '[WEDO EXPRESS]',
          '',
          '\uff08\u5f53\u524d\u4e3a\u7cfb\u7edf\u90ae\u4ef6\uff0c\u8bf7\u52ff\u56de\u590d\uff09'
        ])
      }));
      return messages;
    }

    if (isStatusTransition(oldItem, record, ['\u5ba2\u6237\u5f85\u786e\u8ba4'], '\u5f85\u9001\u4ed3')) {
      messages.push(buildAppointmentEmailPayload(oldItem, record, {
        templateKey: 'appointment_confirmed_warehouse',
        recipientRole: '\u4ed3\u5e93',
        subject: '\u3010\u9884\u7ea6\u5df2\u786e\u8ba4\u3011\u5ba2\u6237\u5df2\u63a5\u53d7\u9001\u4ed3\u5b89\u6392 ' + no,
        title: '\u5ba2\u6237\u5df2\u63a5\u53d7\u9001\u4ed3\u5b89\u6392',
        intro: '\u5ba2\u6237/\u8d27\u4ee3\u5df2\u786e\u8ba4\u63a5\u53d7\u4ed3\u5e93\u5b89\u6392\uff0c\u8bf7\u4ed3\u5e93\u6309\u786e\u8ba4\u65f6\u6bb5\u505a\u597d\u6536\u8d27\u51c6\u5907\u3002',
        actionText: '\u8bf7\u6309\u786e\u8ba4\u65f6\u6bb5\u51c6\u5907\u6536\u8d27\uff0c\u5e76\u5728\u9001\u4ed3\u5b8c\u6210\u540e\u6309\u6d41\u7a0b\u767b\u8bb0\u5230\u4ed3\u4fe1\u606f\u3002',
        actionUrl: getWarehouseAuditUrl(record),
        actionLabel: '\u67e5\u770b\u9884\u7ea6\u8be6\u60c5',
        extraFields: getFgEmailWarehouseConfirmFieldEntries(record).concat([
          { label: '\u9001\u4ed3\u7801', value: record.deliveryCode || '-' },
          { label: '\u8d27\u7269\u6982\u8981', value: cargoSummary },
          { label: '\u4ed3\u5e93\u5907\u6ce8', value: record.auditRemark || '-' }
        ]).concat(getFgEmailWPodFieldEntries(record))
      }));
      messages.push(buildAppointmentEmailPayload(oldItem, record, {
        templateKey: 'appointment_confirmed_forwarder',
        recipientRole: '\u8d27\u4ee3',
        subject: '\u3010\u9884\u7ea6\u6210\u529f\u3011\u606d\u559c\uff0c\u60a8\u7684\u5165\u4ed3\u7533\u8bf7\u5df2\u786e\u8ba4 - \u5355\u53f7\uff1a' + no,
        title: '\u5165\u4ed3\u7533\u8bf7\u5df2\u786e\u8ba4',
        intro: '[\u7cfb\u7edf\u81ea\u52a8\u901a\u77e5]\n\n\u60a8\u597d\uff01\n\n\u606d\u559c\uff0c\u60a8\u7684\u5165\u4ed3\u9884\u7ea6\u7533\u8bf7\u5df2\u5ba1\u6838\u6210\u529f\u3002\u7cfb\u7edf\u5df2\u4e3a\u60a8\u9501\u5b9a\u4ee5\u4e0b\u5165\u4ed3\u65f6\u6bb5\uff1a',
        actionText: '\u3010\u5165\u4ed3\u6307\u5f15\u3011\n\n\u8bf7\u786e\u4fdd\u6240\u6709\u8d27\u7269\u6ee1\u8db3\u5165\u5e93\u6807\u51c6\uff0c\u5305\u62ec\u5305\u88c5\u548c\u8d34\u6807\u3002\u8be6\u7ec6\u4fe1\u606f\u8bf7\u53c2\u9605\u300a\u8fd0\u5fb7\u5165\u5e93\u8d27\u7269\u8981\u6c42\u8bf4\u660e\u300b\u3002\n\u611f\u8c22\u60a8\u7684\u914d\u5408\u3002',
        footerNote: '\u4ed3\u5e93\u9884\u7ea6\u7cfb\u7edf\n[WEDO EXPRESS]\n\n\uff08\u5f53\u524d\u4e3a\u7cfb\u7edf\u90ae\u4ef6\uff0c\u8bf7\u52ff\u56de\u590d\uff09',
        footerColor: '#1f5f9f',
        hideRecipientRole: true,
        fields: [
          { label: '\u9884\u7ea6\u5355\u53f7', value: record.appointmentNo || '-' }
        ].concat(getEmailPartyFieldEntries(record)).concat(
          shouldShowFgWarehouseConfirmFields(record.status) ? [
            { label: '\u76ee\u7684\u5730', value: (record.warehouse || record.confirmedWarehouse || '-') + ' (US West Warehouse)' },
            { label: '\u8be6\u7ec6\u5730\u5740', value: record.warehouseConfirmedAddress || '-' },
            { label: '\u5165\u4ed3\u65e5\u671f', value: inboundDate },
            { label: '\u5165\u4ed3\u65f6\u6bb5', value: inboundTimeRange + '\uff08\u5f53\u5730\u65f6\u95f4\uff09' }
          ] : [
            { label: '\u76ee\u7684\u5730', value: (record.warehouse || record.confirmedWarehouse || '-') + ' (US West Warehouse)' }
          ]
        ).concat(getFgEmailWPodFieldEntries(record)),
        bodyLines: [
          '[\u7cfb\u7edf\u81ea\u52a8\u901a\u77e5]',
          '',
          '\u60a8\u597d\uff01',
          '',
          '\u606d\u559c\uff0c\u60a8\u7684\u5165\u4ed3\u9884\u7ea6\u7533\u8bf7\u5df2\u5ba1\u6838\u6210\u529f\u3002\u7cfb\u7edf\u5df2\u4e3a\u60a8\u9501\u5b9a\u4ee5\u4e0b\u5165\u4ed3\u65f6\u6bb5\uff1a',
          '',
          '\u3010\u9884\u7ea6\u4fe1\u606f\u3011',
          '',
          '\u9884\u7ea6\u5355\u53f7\uff1a' + (record.appointmentNo || '-')
        ].concat(getEmailPartyBodyLines(record)).concat(
          shouldShowFgWarehouseConfirmFields(record.status) ? [
            '\u76ee\u7684\u5730\uff1a' + (record.warehouse || record.confirmedWarehouse || '-') + ' (US West Warehouse)',
            '\u8be6\u7ec6\u5730\u5740\uff1a' + (record.warehouseConfirmedAddress || '-'),
            '\u5165\u4ed3\u65e5\u671f\uff1a' + inboundDate,
            '\u5165\u4ed3\u65f6\u6bb5\uff1a' + inboundTimeRange + '\uff08\u5f53\u5730\u65f6\u95f4\uff09'
          ] : [
            '\u76ee\u7684\u5730\uff1a' + (record.warehouse || record.confirmedWarehouse || '-') + ' (US West Warehouse)'
          ]
        ).concat(getFgEmailWPodBodyLines(record)).concat([
          '',
          '\u3010\u5165\u4ed3\u6307\u5f15\u3011',
          '',
          '\u8bf7\u786e\u4fdd\u6240\u6709\u8d27\u7269\u6ee1\u8db3\u5165\u5e93\u6807\u51c6\uff0c\u5305\u62ec\u5305\u88c5\u548c\u8d34\u6807\u3002\u8be6\u7ec6\u4fe1\u606f\u8bf7\u53c2\u9605\u300a\u8fd0\u5fb7\u5165\u5e93\u8d27\u7269\u8981\u6c42\u8bf4\u660e\u300b\u3002',
          '\u611f\u8c22\u60a8\u7684\u914d\u5408\u3002',
          '',
          '\u4ed3\u5e93\u9884\u7ea6\u7cfb\u7edf',
          '[WEDO EXPRESS]',
          '',
          '\uff08\u5f53\u524d\u4e3a\u7cfb\u7edf\u90ae\u4ef6\uff0c\u8bf7\u52ff\u56de\u590d\uff09'
        ])
      }));
    }

    return messages;
  }

  function appendLocalNotifyMailLog(entry) {
    try {
      var stored = sessionStorage.getItem(NOTIFY_MAIL_STORAGE_KEY);
      var list = stored ? JSON.parse(stored) : [];
      if (!Array.isArray(list)) list = [];
      list.unshift(entry);
      if (list.length > 200) list.length = 200;
      sessionStorage.setItem(NOTIFY_MAIL_STORAGE_KEY, JSON.stringify(list));
    } catch (e) { /* ignore */ }
  }

  function sendAppointmentStatusChangeEmail(oldItem, record) {
    if (!oldItem || !record) return;
    dispatchAppointmentNotifyPayloads(buildAppointmentEmailMessages(oldItem, record));
  }

  function addOrUpdateInMock(item, options) {
    var opts = options || {};
    var list = getBaseList();
    var record = JSON.parse(JSON.stringify(item));
    var idx = -1;
    for (var i = 0; i < list.length; i++) {
      if (list[i].id === record.id) {
        idx = i;
        break;
      }
    }
    var oldItem = idx >= 0 ? JSON.parse(JSON.stringify(list[idx])) : null;
    applyEmailNotifyFlags(oldItem, record);
    var shouldNotify = buildAppointmentEmailMessages(oldItem, record).length > 0;
    if (idx >= 0) {
      list[idx] = record;
    } else if (opts.prepend) {
      list.unshift(record);
    } else {
      list.push(record);
    }
    persistList(list);
    if (shouldNotify) {
      sendAppointmentStatusChangeEmail(oldItem, record);
    }
    return record;
  }

  /**
   * 提交成功：在模拟数据中生成一条「待预约」记录
   */
  function submitAppointmentRecord(item, done) {
    var record = JSON.parse(JSON.stringify(item || {}));
    record.status = '待预约';
    record.customerCode = record.customerCode || getCurrentCustomerCode();
    if (!record.id) record.id = genId();
    if (!record.appointmentNo) record.appointmentNo = genAppointmentNo();
    if (!record.deliveryCode) record.deliveryCode = genDeliveryCode();
    if (!record.submitTime) record.submitTime = formatNow();
    record = addOrUpdateInMock(record, { prepend: true });
    persistListToSource(function (err) {
      if (done) done(err, record);
    });
    return record;
  }

  function submitSuccessMessage(err) {
    if (!err) return '提交成功，已写入 mock_data/deliveryAppointment.js';
    return '提交成功（已缓存）；未能写入源文件：' + (err.message || err) +
      '。请使用 npm run dev 并通过 http://localhost:3847 访问页面。';
  }

  function persistSuccessMessage(err, successText) {
    var ok = successText || '已保存并写入 mock_data/deliveryAppointment.js';
    if (!err) return ok;
    return ok + '（已缓存）；未能写入源文件：' + (err.message || err) +
      '。请使用 npm run dev 并通过 http://localhost:3847 访问页面。';
  }

  /**
   * 更新内存常量并写入 mock_data/deliveryAppointment.js（需 npm run dev）。
   * 写入成功后立刻 GET 一次最新源文件，覆盖内存数据，确保后续读取与磁盘一致。
   */
  function addOrUpdateInMockAndPersist(item, options, done) {
    var record = addOrUpdateInMock(item, options);
    persistListToSource(function (err) {
      if (err) {
        if (done) done(err, record);
        return;
      }
      fetchAndApplyMockSource(function (fetchErr) {
        if (done) done(fetchErr || null, record);
      });
    });
    return record;
  }

  function updateAppointment(updated, forWh, done) {
    var record = JSON.parse(JSON.stringify(updated));
    if (typeof forWh === 'function' && done === undefined) {
      done = forWh;
      forWh = true;
    }
    record = addOrUpdateInMock(record);
    if (done) {
      persistListToSource(function (err) {
        if (err) {
          done(err, record);
          return;
        }
        fetchAndApplyMockSource(function (fetchErr) {
          done(fetchErr || null, record);
        });
      });
    }
    return record;
  }

  function normalizeWarehouseName(warehouseName) {
    if (typeof window !== 'undefined' && typeof window.normalizeWarehouseName === 'function') {
      return window.normalizeWarehouseName(warehouseName);
    }
    var info = findWarehouseAddressBook(warehouseName);
    return info ? info.name : String(warehouseName || '').trim();
  }

  function isSameWarehouse(nameA, nameB) {
    if (typeof window !== 'undefined' && typeof window.isSameWarehouseName === 'function') {
      return window.isSameWarehouseName(nameA, nameB);
    }
    if (nameA === nameB) return true;
    var infoA = findWarehouseAddressBook(nameA);
    var infoB = findWarehouseAddressBook(nameB);
    return !!(infoA && infoB && infoA.id === infoB.id);
  }

  function getEligibleInOrders(warehouse) {
    if (typeof MOCK_IN_ORDER_LIST === 'undefined') return [];
    return MOCK_IN_ORDER_LIST.filter(function (item) {
      return (
        item.status === '运输在途' &&
        item.shippingMethod === '客户自发头程' &&
        isSameWarehouse(item.warehouse, warehouse)
      );
    });
  }

  /**
   * 校验「预约信息·送仓总箱数」与「货物明细·送仓箱数之和」一致性
   * - 船务渠道（bookChannel === 'shipping'）豁免
   * - 货物明细必须至少 1 条
   * - 每条送仓箱数必须为正整数，且 1 <= deliveryCartons <= cartons
   * - 送仓总箱数 === Σ送仓箱数 才通过
   * @param {object} payload { estimatedCartons, inboundOrders, bookChannel }
   * @returns {{ ok: boolean, error?: string, summary?: string, totalCartons?: number, sumDelivery?: number }}
   */
  function validateDeliveryCartonsConsistency(payload) {
    payload = payload || {};
    if (payload.bookChannel === 'shipping') {
      return { ok: true };
    }
    var orders = Array.isArray(payload.inboundOrders) ? payload.inboundOrders : [];
    if (!orders.length) {
      return { ok: false, error: '\u8bf7\u81f3\u5c11\u6dfb\u52a0\u4e00\u6761\u5165\u5e93\u5355\u660e\u7ec6' };
    }
    var totalCartons = Number(payload.estimatedCartons);
    if (!(totalCartons > 0) || !/^\d+$/.test(String(payload.estimatedCartons))) {
      return { ok: false, error: '\u9884\u7ea6\u4fe1\u606f\u300c\u603b\u7bb1\u6570\u300d\u5fc5\u987b\u4e3a\u6b63\u6574\u6570' };
    }
    var sumDelivery = 0;
    for (var i = 0; i < orders.length; i++) {
      var snap = orders[i] || {};
      var orderCartons = Number(snap.cartons);
      var deliveryCartons = Number(snap.deliveryCartons);
      var orderNo = snap.orderNo || ('\u7b2c' + (i + 1) + '\u6761');
      if (!(orderCartons > 0)) {
        return { ok: false, error: '\u5165\u5e93\u5355 ' + orderNo + ' \u7684\u8ba2\u5355\u7bb1\u6570\u5f02\u5e38' };
      }
      if (!/^\d+$/.test(String(snap.deliveryCartons)) || !(deliveryCartons > 0)) {
        return { ok: false, error: '\u5165\u5e93\u5355 ' + orderNo + ' \u7684\u9001\u4ed3\u7bb1\u6570\u5fc5\u987b\u4e3a\u5927\u4e8e 0 \u7684\u6b63\u6574\u6570' };
      }
      if (deliveryCartons > orderCartons) {
        return { ok: false, error: '\u5165\u5e93\u5355 ' + orderNo + ' \u7684\u9001\u4ed3\u7bb1\u6570\u4e0d\u80fd\u8d85\u8fc7\u8ba2\u5355\u7bb1\u6570\uff08' + orderCartons + '\uff09' };
      }
      sumDelivery += deliveryCartons;
    }
    if (totalCartons !== sumDelivery) {
      return {
        ok: false,
        totalCartons: totalCartons,
        sumDelivery: sumDelivery,
        summary: '\u9884\u7ea6\u4fe1\u606f\u603b\u7bb1\u6570\uff1a' + totalCartons +
          '\uff0c\u8d27\u7269\u660e\u7ec6\u9001\u4ed3\u7bb1\u6570\u603b\u548c\uff1a' + sumDelivery
      };
    }
    return { ok: true, totalCartons: totalCartons, sumDelivery: sumDelivery };
  }

  function snapshotInOrder(item) {
    var orderCartons = Number(item.cartons);
    if (!(orderCartons > 0)) orderCartons = Number(item.totalQty) || 0;
    return {
      inOrderId: item.id,
      sourceType: '\u5165\u5e93\u5355',
      orderNo: item.orderNo,
      status: item.status,
      warehouse: normalizeWarehouseName(item.warehouse),
      shippingMethod: item.shippingMethod,
      createDate: item.createDate,
      cartons: orderCartons,
      deliveryCartons: orderCartons,
      grossWeight: Number(item.grossWeight) || 0,
      volume: Number(item.volume) || 0
    };
  }

  function calcTotals(inboundOrders) {
    var totalVolume = 0;
    var totalWeight = 0;
    if (typeof MOCK_IN_ORDER_LIST === 'undefined') return { totalVolume: 0, totalWeight: 0 };
    inboundOrders.forEach(function (snap) {
      for (var i = 0; i < MOCK_IN_ORDER_LIST.length; i++) {
        var o = MOCK_IN_ORDER_LIST[i];
        if (o.id === snap.inOrderId || o.orderNo === snap.orderNo) {
          totalVolume += Number(o.volume) || 0;
          totalWeight += Number(o.grossWeight) || 0;
          break;
        }
      }
    });
    return { totalVolume: totalVolume, totalWeight: totalWeight };
  }

  function getOperationsByStatus(status) {
    var map = {
      '待提交': ['detail', 'edit', 'submit', 'discard'],
      '待预约': ['detail', 'edit', 'cancel', 'discard'],
      '仓库待审核': ['detail', 'cancel'],
      '客户待确认': ['detail', 'schedule', 'cancel'],
      '待送仓': ['detail', 'cancel'],
      '已送仓': ['detail'],
      '已超时': ['detail', 'rebook'],
      '预约失败': ['detail'],
      '已废弃': ['detail']
    };
    return map[status] || ['detail'];
  }

  function getOpLabel(action) {
    var labels = {
      detail: '详情',
      edit: '修改预约',
      submit: '提交',
      cancel: '取消预约',
      discard: '废弃',
      schedule: '预定时间',
      rebook: '重新预约'
    };
    return labels[action] || action;
  }

  function getStatusClass(status) {
    var map = {
      '待提交': 'pending',
      '待预约': 'pending',
      '仓库待审核': 'warehouse-pending',
      '客户待确认': 'customer-pending',
      '待送仓': 'processing',
      '已送仓': 'delivered',
      '已超时': 'timeout',
      '预约失败': 'failed',
      '已废弃': 'discarded'
    };
    return map[status] || 'default';
  }

  function applyStatusAction(appointment, action, options) {
    options = options || {};
    var a = JSON.parse(JSON.stringify(appointment));
    if (action === 'submit' && a.status === '待提交') {
      a.status = '待预约';
      if (!a.submitTime) a.submitTime = formatNow();
      if (!a.appointmentNo) a.appointmentNo = genAppointmentNo();
      if (!a.deliveryCode) a.deliveryCode = genDeliveryCode();
    } else if (action === 'discard') {
      a.status = '已废弃';
    } else if (action === 'cancel') {
      a.status = '已废弃';
    } else if (action === 'schedule' && a.status === '客户待确认') {
      var time = String(a.warehouseConfirmedInboundTime || '').trim();
      if (!time) return null;
      var scheduleMsg = options.customerPortal
        ? '确认接受预约时段？'
        : ('是否接受仓库确认时段：' + time + '？');
      if (!window.confirm(scheduleMsg)) return null;
      a.status = '待送仓';
      if (a.confirmedWarehouse) a.warehouse = a.confirmedWarehouse;
      pushOperationLogByKind(a, getOfficialOperator(a), 'customer_accept_slot', { slot: time });
    } else if (action === 'rebook' && a.status === '已超时') {
      a.status = '待预约';
      a.expectedInboundTime = '';
      a.expectedInboundDates = [];
      a.warehouseConfirmedInboundTime = '';
      a.actualDeliveryTime = '';
      a.receivedPallets = '';
      a.receivedCartons = '';
      a.arrivalPhotos = [];
    }
    return a;
  }

  function formatNow() {
    var d = new Date();
    var p = function (n) { return n < 10 ? '0' + n : '' + n; };
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + ' ' +
      p(d.getHours()) + ':' + p(d.getMinutes()) + ':' + p(d.getSeconds());
  }

  var seq = 100;
  function genAppointmentNo() {
    seq += 1;
    var d = new Date();
    var p = function (n) { return n < 10 ? '0' + n : '' + n; };
    return 'YY' + d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + seq;
  }

  function genDeliveryCode() {
    var chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    var code = 'SC';
    for (var i = 0; i < 4; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  function genId() {
    return 'appt-' + Date.now() + '-' + Math.floor(Math.random() * 1000);
  }

  function formatCell(value) {
    if (value === undefined || value === null || value === '') return '-';
    return value;
  }

  function formatNumber(num, digits) {
    if (num === undefined || num === null || num === '') return '-';
    return Number(num).toFixed(digits);
  }

  var RECEIVING_APPT_STATUSES = typeof MOCK_RECEIVING_APPOINTMENT_STATUS_TABS !== 'undefined'
    ? MOCK_RECEIVING_APPOINTMENT_STATUS_TABS.map(function (t) { return t.key; })
    : ['\u4ed3\u5e93\u5f85\u5ba1\u6838', '\u5ba2\u6237\u5f85\u786e\u8ba4', '\u5f85\u9001\u4ed3', '\u5df2\u9001\u4ed3', '\u5df2\u8d85\u65f6'];

  function getReceivingAppointmentList() {
    return getAppointmentList(true).filter(function (item) {
      return RECEIVING_APPT_STATUSES.indexOf(item.status) >= 0;
    });
  }

  function getBookerParty(item) {
    var channel = (item && item.bookChannel) || 'customer';
    if (channel === 'customer') {
      return (item && item.customerCode) || getCurrentCustomerCode() || 'CN0000438';
    }
    return '\u8fd0\u5fb7\u8239\u52a1(Wedo)';
  }

  function getUsTimezoneLabel(warehouse) {
    if (!warehouse) return 'US/Pacific';
    if (warehouse.indexOf('\u7f8e\u4e1c') >= 0) return 'US/Eastern';
    if (warehouse.indexOf('\u7f8e\u4e2d') >= 0) return 'US/Central';
    if (warehouse.indexOf('\u7f8e\u897f') >= 0) return 'US/Pacific';
    return 'US/Pacific';
  }

  /** 目的仓对应的当地时间文案：美东仓→美东时间，美西仓/美西4仓→美西时间 */
  function getWarehouseLocalTimeLabel(warehouse) {
    var wh = String(warehouse || '').trim();
    if (!wh) return '\u5f53\u5730\u65f6\u95f4';
    if (wh.indexOf('\u7f8e\u4e1c') >= 0) return '\u7f8e\u4e1c\u65f6\u95f4';
    if (wh.indexOf('\u7f8e\u897f') >= 0) return '\u7f8e\u897f\u65f6\u95f4';
    if (wh.indexOf('\u7f8e\u4e2d') >= 0) return '\u7f8e\u4e2d\u65f6\u95f4';
    return '\u5f53\u5730\u65f6\u95f4';
  }

  /** 货代端字段标签：未识别目的仓时默认美西时间 */
  function getFgWarehouseLocalTimeLabel(warehouse) {
    var label = getWarehouseLocalTimeLabel(warehouse);
    return label === '\u5f53\u5730\u65f6\u95f4' ? '\u7f8e\u897f\u65f6\u95f4' : label;
  }

  /** 货代端只读字段无数据时展示 */
  function formatFgEmptyDisplay(val) {
    return String(val == null ? '' : val).trim() ? String(val).trim() : '-';
  }

  function formatFgWarehouseTime(val, warehouse) {
    if (!String(val == null ? '' : val).trim()) return '-';
    return formatUsWarehouseTime(val, warehouse);
  }

  function isUsWarehouseName(warehouse) {
    return String(warehouse || '').indexOf('\u7f8e') >= 0;
  }

  function localTimeFieldLabel(baseName, warehouse) {
    return String(baseName || '') + '\uff08' + getWarehouseLocalTimeLabel(warehouse) + '\uff09';
  }

  function formatUsWarehouseTime(str, warehouse) {
    if (!str) return '-';
    if (!isUsWarehouseName(warehouse)) return str;
    return str + '\uff08' + getWarehouseLocalTimeLabel(warehouse) + '\uff09';
  }

  var MAX_EXPECTED_INBOUND_DATES = 3;

  /** 从单条时间/日期字符串提取 YYYY-MM-DD */
  function pickExpectedDatePart(str) {
    if (!str) return '';
    var s = String(str).trim();
    var m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) return m[1] + '-' + m[2] + '-' + m[3];
    m = s.match(/^(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})/);
    if (!m) return '';
    var mm = m[2].length === 1 ? '0' + m[2] : m[2];
    var dd = m[3].length === 1 ? '0' + m[3] : m[3];
    return m[1] + '-' + mm + '-' + dd;
  }

  /** 期望送仓候选日期（最多 3 个），与 expectedInboundTime 主日期同步 */
  function getExpectedInboundDates(item) {
    if (!item) return [];
    var out = [];
    if (Array.isArray(item.expectedInboundDates)) {
      item.expectedInboundDates.forEach(function (d) {
        var n = pickExpectedDatePart(d);
        if (n && out.indexOf(n) === -1) out.push(n);
      });
    }
    if (!out.length) {
      var primary = pickExpectedDatePart(item.expectedInboundTime);
      if (primary) out.push(primary);
    }
    return out.slice(0, MAX_EXPECTED_INBOUND_DATES);
  }

  function applyExpectedInboundDates(item, dates) {
    if (!item) return;
    var list = [];
    (dates || []).forEach(function (d) {
      var n = pickExpectedDatePart(d);
      if (n && list.indexOf(n) === -1) list.push(n);
    });
    list = list.slice(0, MAX_EXPECTED_INBOUND_DATES);
    item.expectedInboundDates = list;
    item.expectedInboundTime = list[0] || '';
  }

  /** 各端列表/详情展示：多候选日期用顿号连接，附仓库时区 */
  function formatExpectedInboundDatesDisplay(item, warehouse) {
    var dates = getExpectedInboundDates(item);
    if (!dates.length) return '-';
    var wh = warehouse || (item && (item.confirmedWarehouse || item.warehouse));
    var joined = dates.join('\u3001');
    if (isUsWarehouseName(wh)) {
      return joined + '\uff08' + getWarehouseLocalTimeLabel(wh) + '\uff09';
    }
    return joined;
  }

  function formatFgContactPhone(item) {
    var phone = item && item.contactPhone;
    return phone && String(phone).trim() ? String(phone).trim() : '-';
  }

  /** 联系邮箱展示（顿号分隔，去重） */
  function formatContactEmailsDisplay(item) {
    if (!item) return '-';
    var list = [];
    var primary = item.primaryEmail ? String(item.primaryEmail).trim() : '';
    if (primary) list.push(primary);
    (item.emails || []).forEach(function (e) {
      var v = String(e || '').trim();
      if (v && list.indexOf(v) === -1) list.push(v);
    });
    if (!list.length) return '-';
    return list.join('\u3001');
  }

  /** 货代端：仓库确认时段/地址 — 客户待确认及之后展示 */
  function shouldShowFgWarehouseConfirmFields(status) {
    return status === '\u5ba2\u6237\u5f85\u786e\u8ba4' ||
      status === '\u5f85\u9001\u4ed3' ||
      status === '\u5df2\u9001\u4ed3';
  }

  /** 货代端：W.BOL — 待送仓及之后展示 */
  function shouldShowFgWPodDownload(status) {
    return status === '\u5f85\u9001\u4ed3' || status === '\u5df2\u9001\u4ed3';
  }

  /** 货代端：实际送仓时段 — 仅已送仓展示 */
  function shouldShowFgActualDeliveryTime(status) {
    return status === '\u5df2\u9001\u4ed3';
  }

  function getFgEmailWarehouseConfirmFieldEntries(record) {
    if (!record || !shouldShowFgWarehouseConfirmFields(record.status)) return [];
    var wh = record.confirmedWarehouse || record.warehouse || '';
    var lt = getWarehouseLocalTimeLabel(wh);
    var slot = record.warehouseConfirmedInboundTime || '-';
    return [
      { label: '\u4ed3\u5e93\u786e\u8ba4\u5730\u5740', value: record.warehouseConfirmedAddress || '-' },
      { label: '\u6838\u5b9a\u5165\u4ed3\u65f6\u6bb5', value: slot + (slot !== '-' ? '\uff08' + lt + '\uff09' : '') }
    ];
  }

  function getFgEmailWarehouseConfirmBodyLines(record) {
    if (!record || !shouldShowFgWarehouseConfirmFields(record.status)) return [];
    var wh = record.confirmedWarehouse || record.warehouse || '';
    var lt = getWarehouseLocalTimeLabel(wh);
    var slot = record.warehouseConfirmedInboundTime || '-';
    return [
      '\u4ed3\u5e93\u786e\u8ba4\u5730\u5740\uff1a' + (record.warehouseConfirmedAddress || '-'),
      '\u6838\u5b9a\u5165\u4ed3\u65f6\u6bb5\uff1a' + slot + (slot !== '-' ? '\uff08' + lt + '\uff09' : '')
    ];
  }

  function getFgEmailWPodFieldEntries(record) {
    if (!record || !shouldShowFgWPodDownload(record.status)) return [];
    var url = getAppointmentWPodUrl(record);
    return [{ label: 'W.BOL \u4e0b\u8f7d', value: url || '-' }];
  }

  function getFgEmailWPodBodyLines(record) {
    if (!record || !shouldShowFgWPodDownload(record.status)) return [];
    var url = getAppointmentWPodUrl(record);
    return ['W.BOL \u4e0b\u8f7d\uff1a' + (url || '-')];
  }

  function getFgEmailActualDeliveryFieldEntries(record) {
    if (!record || !shouldShowFgActualDeliveryTime(record.status)) return [];
    var wh = record.confirmedWarehouse || record.warehouse || '';
    return [{
      label: '\u5b9e\u9645\u9001\u4ed3\u65f6\u6bb5',
      value: formatFgWarehouseTime(record.actualDeliveryTime, wh)
    }];
  }

  function getFgEmailActualDeliveryBodyLines(record) {
    if (!record || !shouldShowFgActualDeliveryTime(record.status)) return [];
    var wh = record.confirmedWarehouse || record.warehouse || '';
    return ['\u5b9e\u9645\u9001\u4ed3\u65f6\u6bb5\uff1a' + formatFgWarehouseTime(record.actualDeliveryTime, wh)];
  }

  function matchExpectedInboundDateRange(item, start, end) {
    var dates = getExpectedInboundDates(item);
    if (!dates.length) return matchDateRangeField('', start, end);
    for (var i = 0; i < dates.length; i++) {
      if (matchDateRangeField(dates[i], start, end)) return true;
    }
    return false;
  }

  function calcTotalCartons(item) {
    var orders = (item && item.inboundOrders) || [];
    if (!orders.length) return 0;
    var total = 0;
    orders.forEach(function (snap) {
      if (snap.deliveryCartons != null && snap.deliveryCartons !== '') {
        total += Number(snap.deliveryCartons) || 0;
        return;
      }
      if (snap.cartons != null) {
        total += Number(snap.cartons) || 0;
        return;
      }
      if (typeof MOCK_IN_ORDER_LIST === 'undefined') return;
      for (var i = 0; i < MOCK_IN_ORDER_LIST.length; i++) {
        var o = MOCK_IN_ORDER_LIST[i];
        if (o.id === snap.inOrderId || o.orderNo === snap.orderNo) {
          total += Number(o.cartons) || Number(o.totalQty) || 0;
          break;
        }
      }
    });
    return total;
  }

  function formatEstimatedCartons(item) {
    if (!item) return '-';
    if (item.estimatedCartons != null && item.estimatedCartons !== '') {
      return Number(item.estimatedCartons) || 0;
    }
    var total = calcTotalCartons(item);
    return total ? total : '-';
  }

  function calcTotalPalletsDisplay(item) {
    if (item && item.isPalletized === false) return '-';
    if (item.totalPallets != null && item.totalPallets !== '') return Number(item.totalPallets) || 0;
    var orders = item.inboundOrders || [];
    var total = 0;
    orders.forEach(function (snap) {
      total += Number(snap.pallets) || 0;
    });
    return total;
  }

  function isPalletized(item) {
    if (!item) return false;
    if (item.isPalletized === true || item.isPalletized === false) return item.isPalletized;
    if (item.isPalletized === 'true' || item.isPalletized === 'yes' || item.isPalletized === '是') return true;
    if (item.isPalletized === 'false' || item.isPalletized === 'no' || item.isPalletized === '否') return false;
    return Number(item.totalPallets) > 0;
  }

  function formatPalletized(item) {
    return isPalletized(item) ? '是' : '否';
  }

  function formatTotalPallets(item) {
    if (!isPalletized(item)) return '-';
    return calcTotalPalletsDisplay(item);
  }

  function formatTotalVolume(item) {
    if (!item || item.totalVolume == null || item.totalVolume === '') return '-';
    var n = Number(item.totalVolume);
    return isNaN(n) ? '-' : n;
  }

  function formatTotalWeight(item) {
    if (!item || item.totalWeight == null || item.totalWeight === '') return '-';
    var n = Number(item.totalWeight);
    return isNaN(n) ? '-' : n;
  }

  function formatInboundOrderSummary(item) {
    var orders = (item && item.inboundOrders) || [];
    if (!orders.length) return '-';
    return orders.map(function (snap) {
      return snap.orderNo || snap.inOrderNo || '';
    }).filter(Boolean).join('、') || '-';
  }

  /** 列表「查看明细」列：单条显示单号，多条显示可点击「查看明细」 */
  function buildInboundDetailListCell(item) {
    var orders = (item && item.inboundOrders) || [];
    if (!orders.length) return '-';
    if (orders.length === 1) {
      return escapeHtmlLite(orders[0].orderNo || orders[0].inOrderNo || '-');
    }
    var id = item && item.id ? encodeURIComponent(item.id) : '';
    return '<a href="javascript:void(0)" class="op-btn js-inbound-detail-link" data-appt-id="' +
      id + '">查看明细</a>';
  }

  function normSearchText(value) {
    return String(value == null ? '' : value).trim().toLowerCase();
  }

  function matchTextFuzzy(field, keyword) {
    var kw = normSearchText(keyword);
    if (!kw) return true;
    return normSearchText(field).indexOf(kw) !== -1;
  }

  function matchNumberLikeFuzzy(field, keyword) {
    var kw = normSearchText(keyword);
    if (!kw) return true;
    if (field == null || field === '' || field === '-') return false;
    return normSearchText(field).indexOf(kw) !== -1;
  }

  function matchEmailFuzzy(item, keyword) {
    var kw = normSearchText(keyword);
    if (!kw) return true;
    var emails = [];
    if (item && item.primaryEmail) emails.push(item.primaryEmail);
    if (item && item.emails && item.emails.length) {
      item.emails.forEach(function (e) { if (e) emails.push(e); });
    }
    if (!emails.length) return false;
    return emails.some(function (e) { return normSearchText(e).indexOf(kw) !== -1; });
  }

  function matchDateRangeField(fieldValue, start, end) {
    var startStr = String(start || '').trim();
    var endStr = String(end || '').trim();
    if (!startStr && !endStr) return true;
    var valueDate = parseAppointmentDateOnly(fieldValue);
    if (!valueDate) return false;
    var startDate = startStr ? parseAppointmentDateOnly(startStr) : null;
    var endDate = endStr ? parseAppointmentDateOnly(endStr) : null;
    if (startDate && valueDate < startDate) return false;
    if (endDate && valueDate > endDate) return false;
    return true;
  }

  function matchInboundDetailSearch(item, keyword) {
    var raw = String(keyword || '').trim();
    if (!raw) return true;
    var keys = raw.split(/[,，]/).map(function (s) { return normSearchText(s); }).filter(Boolean);
    if (!keys.length) return true;
    var orders = (item && item.inboundOrders) || [];
    return keys.some(function (kw) {
      return orders.some(function (snap) {
        var no = normSearchText(snap.orderNo || snap.inOrderNo || '');
        return no.indexOf(kw) !== -1;
      });
    });
  }

  /**
   * 客户前台预约列表统一筛选
   * @param {Array} list
   * @param {object} filters tabKey, appointmentNo, deliveryCode, warehouse, ...
   */
  function filterCustomerAppointmentList(list, filters) {
    filters = filters || {};
    var tabKey = filters.tabKey || '';
    return (list || []).filter(function (item) {
      if (tabKey && item.status !== tabKey) return false;
      if (!matchTextFuzzy(item.appointmentNo, filters.appointmentNo)) return false;
      if (!matchTextFuzzy(item.deliveryCode, filters.deliveryCode)) return false;
      if (filters.warehouse && !isSameWarehouse(item.warehouse, filters.warehouse)) return false;
      if (filters.deliveryType && item.deliveryType !== filters.deliveryType) return false;
      if (filters.status && item.status !== filters.status) return false;
      if (!matchInboundDetailSearch(item, filters.inboundDetail)) return false;
      if (filters.palletized) {
        var yes = isPalletized(item);
        if (filters.palletized === 'yes' ? !yes : yes) return false;
      }
      if (!matchNumberLikeFuzzy(formatEstimatedCartons(item), filters.estimatedCartons)) return false;
      if (!matchNumberLikeFuzzy(formatTotalVolume(item), filters.totalVolume)) return false;
      if (!matchNumberLikeFuzzy(formatTotalWeight(item), filters.totalWeight)) return false;
      if (!matchTextFuzzy(item.containerNo, filters.containerNo)) return false;
      if (!matchTextFuzzy(item.containerType || item.containerSeq, filters.containerType)) return false;
      if (!matchEmailFuzzy(item, filters.email)) return false;
      if (!matchDateRangeField(item.submitTime, filters.submitTimeStart, filters.submitTimeEnd)) {
        return false;
      }
      if (!matchExpectedInboundDateRange(item, filters.expectedTimeStart, filters.expectedTimeEnd)) {
        return false;
      }
      if (!matchDateRangeField(item.actualDeliveryTime, filters.actualTimeStart, filters.actualTimeEnd)) {
        return false;
      }
      return true;
    });
  }

  /**
   * 仓储中台预约列表筛选：复用客户前台规则，并增加客户编号
   * @param {Array} list
   * @param {object} filters 含 customerCode 及 filterCustomerAppointmentList 全部字段
   */
  function filterWhAppointmentList(list, filters) {
    filters = filters || {};
    var base = filterCustomerAppointmentList(list, filters);
    var customerCode = normSearchText(filters.customerCode);
    if (!customerCode) return base;
    return base.filter(function (item) {
      return normSearchText(item.customerCode).indexOf(customerCode) !== -1;
    });
  }

  function findInOrderForSnap(snap) {
    if (typeof MOCK_IN_ORDER_LIST === 'undefined') return null;
    for (var i = 0; i < MOCK_IN_ORDER_LIST.length; i++) {
      var o = MOCK_IN_ORDER_LIST[i];
      if (snap.inOrderId && o.id === snap.inOrderId) return o;
      if (snap.orderNo && o.orderNo === snap.orderNo) return o;
    }
    return null;
  }

  function isCustomerSpontaneousShipping(method) {
    var m = String(method || '').trim();
    return m === '\u5ba2\u6237\u81ea\u53d1' || m === '\u5ba2\u6237\u81ea\u53d1\u5934\u7a0b';
  }

  function isWedoHeadLegShipping(method) {
    return String(method || '').trim().indexOf('\u8fd0\u5fb7\u5934\u7a0b') >= 0;
  }

  function isInboundOrderSource(snap) {
    if (!snap) return false;
    if (snap.sourceType === '\u5165\u5e93\u5355' || snap.sourceType === 'inOrder') return true;
    return !!(snap.inOrderId || findInOrderForSnap(snap));
  }

  function resolveHandleMethod(shippingMethod, orderNo, snap) {
    if (isCustomerSpontaneousShipping(shippingMethod) && isInboundOrderSource(snap)) return '\u4e0a\u67b6';
    if (isWedoHeadLegShipping(shippingMethod)) {
      var no = String(orderNo || '').trim();
      if (no.length && (no.charAt(0) === 'R' || no.charAt(0) === 'r')) return '\u4e0a\u67b6';
      return '\u4e2d\u8f6c';
    }
    return '-';
  }

  function enrichInboundRow(snap) {
    var order = findInOrderForSnap(snap);
    var shippingMethod = snap.shippingMethod || (order && order.shippingMethod) || '-';
    var cartons = snap.cartons != null ? Number(snap.cartons) : (order ? (Number(order.cartons) || Number(order.totalQty) || 0) : 0);
    var deliveryCartons = snap.deliveryCartons != null && snap.deliveryCartons !== '' ? Number(snap.deliveryCartons) : cartons;
    var receivedCartons = snap.receivedCartons != null && snap.receivedCartons !== '' ? Number(snap.receivedCartons) : null;
    var weight = snap.grossWeight != null ? Number(snap.grossWeight) : (order ? Number(order.grossWeight) || 0 : 0);
    var volume = snap.volume != null ? Number(snap.volume) : (order ? Number(order.volume) || 0 : 0);
    return {
      orderNo: snap.orderNo || '-',
      status: snap.status || (order && order.status) || '-',
      warehouse: snap.warehouse || (order && order.warehouse) || '-',
      shippingMethod: shippingMethod,
      createDate: snap.createDate || (order && order.createDate) || '-',
      cartons: cartons,
      deliveryCartons: deliveryCartons,
      receivedCartons: receivedCartons,
      weight: weight,
      volume: volume,
      handleMethod: resolveHandleMethod(shippingMethod, snap.orderNo, snap)
    };
  }

  function buildInboundDetailRows(item) {
    var orders = (item && item.inboundOrders) || [];
    if (!orders.length) return [];
    return orders.map(enrichInboundRow);
  }

  function getReceivingById(id) {
    if (!id) return null;
    var list = getReceivingAppointmentList();
    for (var i = 0; i < list.length; i++) {
      if (list[i].id === id) return list[i];
    }
    return null;
  }

  function getUsWarehouseOptions() {
    if (typeof MOCK_US_WAREHOUSE_OPTIONS !== 'undefined' && MOCK_US_WAREHOUSE_OPTIONS.length) {
      return MOCK_US_WAREHOUSE_OPTIONS;
    }
    return [{ id: 'us-west-ca91761', name: '\u7f8e\u897f\u4ed3\u5e93(CA-91761)', address: '2281 S Haven Ave, Ontario, CA 91761' }];
  }

  function findUsWarehouseById(id) {
    var list = getUsWarehouseOptions();
    for (var i = 0; i < list.length; i++) {
      if (list[i].id === id) return list[i];
    }
    return list[0] || null;
  }

  function findUsWarehouseByName(name) {
    var n = normalizeWarehouseName(name);
    if (!n) return null;
    var list = getUsWarehouseOptions();
    for (var i = 0; i < list.length; i++) {
      if (normalizeWarehouseName(list[i].name) === n) return list[i];
    }
    return null;
  }

  /** 仓库审核通过 / 更新审核后发给货代的「请客户确认时段」邮件 */
  function buildWarehouseSlotPendingCustomerConfirmPayload(oldItem, record, isResend) {
    var no = record.appointmentNo || record.deliveryCode || record.id || '';
    var resend = isResend === true;
    return buildAppointmentEmailPayload(oldItem, record, {
      templateKey: resend ? 'warehouse_slot_updated_customer_confirm' : 'warehouse_slot_pending_customer_confirm',
      recipientRole: '\u8d27\u4ee3',
      subject: (resend
        ? '\u3010\u65f6\u6bb5\u66f4\u65b0\u3011\u60a8\u7684\u5165\u4ed3\u9884\u7ea6\u5df2\u66f4\u65b0\u5ba1\u6838\u7ed3\u679c\uff0c\u8bf7\u91cd\u65b0\u786e\u8ba4\u6700\u7ec8\u65f6\u6bb5 - \u5355\u53f7\uff1a'
        : '\u60a8\u7684\u5165\u4ed3\u9884\u7ea6\u5df2\u5ba1\u6838\u901a\u8fc7\uff0c\u8bf7\u70b9\u51fb\u786e\u8ba4\u6700\u7ec8\u65f6\u6bb5 - \u5355\u53f7\uff1a') + no,
      title: resend ? '\u5165\u4ed3\u9884\u7ea6\u5ba1\u6838\u5df2\u66f4\u65b0' : '\u5165\u4ed3\u9884\u7ea6\u5df2\u5ba1\u6838\u901a\u8fc7',
      intro: (resend
        ? '\u60a8\u597d\uff01\n\n\u4ed3\u5e93\u5df2\u6839\u636e\u5b9e\u9645\u60c5\u51b5\u8c03\u6574\u4e86\u60a8\u7684\u5165\u4ed3\u9884\u7ea6\u65f6\u6bb5\uff08\u5355\u53f7\uff1a' + no + '\uff09\u3002\n\n\u8bf7\u60a8\u5728 48\u5c0f\u65f6\u5185 \u91cd\u65b0\u786e\u8ba4\u4ee5\u4e0b\u6700\u65b0\u5206\u914d\u7684\u65f6\u6bb5\uff1a'
        : '\u60a8\u597d\uff01\n\n\u597d\u6d88\u606f\uff01\u60a8\u63d0\u4ea4\u7684\u5165\u4ed3\u9884\u7ea6\u7533\u8bf7\uff08\u5355\u53f7\uff1a' + no + '\uff09\u5df2\u901a\u8fc7\u4ed3\u5e93\u5ba1\u6838\u3002\n\n\u4e3a\u4e86\u786e\u4fdd\u60a8\u7684\u8d27\u7269\u80fd\u51c6\u65f6\u5165\u4ed3\uff0c\u8bf7\u60a8\u5728 48\u5c0f\u65f6\u5185 \u5b8c\u6210\u6700\u540e\u7684\u786e\u8ba4\u64cd\u4f5c\uff1a'),
      actionText: '\u3010\u5fc5\u987b\u64cd\u4f5c\u3011\n\u8bf7\u70b9\u51fb\u4e0b\u65b9\u94fe\u63a5\u8fdb\u5165\u7cfb\u7edf\uff0c\u786e\u8ba4\u4e0a\u8ff0\u5206\u914d\u7684\u65f6\u6bb5\u3002\u903e\u671f\u672a\u786e\u8ba4\uff0c\u8be5\u65f6\u6bb5\u53ef\u80fd\u4f1a\u91cd\u65b0\u91ca\u653e\u7ed9\u5176\u4ed6\u9884\u7ea6\u3002\n\n[\u70b9\u51fb\u6b64\u5904\uff1a\u786e\u8ba4\u662f\u5426\u63a5\u53d7\u9884\u7ea6]\n\n\u6e29\u99a8\u63d0\u793a\uff1a\n\n\u786e\u8ba4\u540e\uff0c\u7cfb\u7edf\u5c06\u751f\u6210\u6700\u7ec8\u7684\u201c\u5165\u4ed3\u4e8c\u7ef4\u7801/\u51ed\u8bc1\u201d\uff0c\u8bf7\u4ea4\u7531\u53f8\u673a\u968f\u8d27\u643a\u5e26\u3002\n\u8bf7\u786e\u4fdd\u53f8\u673a\u5728\u6838\u5b9a\u65f6\u95f4\u5185\u5230\u8fbe\uff0c\u5982\u9700\u53d6\u6d88\u6216\u53d8\u66f4\uff0c\u8bf7\u81f3\u5c11\u63d0\u524d12\u5c0f\u65f6\u5728\u7cfb\u7edf\u5904\u7406\u3002\n\u795d\u5de5\u4f5c\u987a\u5229\uff01',
      actionUrl: getAppointmentConfirmUrl(record),
      hideActionButton: true,
      inlineActionLinkLabel: '\u70b9\u51fb\u6b64\u5904\uff1a\u786e\u8ba4\u662f\u5426\u63a5\u53d7\u9884\u7ea6',
      footerNote: '\u4ed3\u5e93\u9884\u7ea6\u7cfb\u7edf\n[WEDO EXPRESS]\n\n\uff08\u5f53\u524d\u4e3a\u7cfb\u7edf\u90ae\u4ef6\uff0c\u8bf7\u52ff\u56de\u590d\uff09',
      footerColor: '#1f5f9f',
      hideRecipientRole: true,
      fields: [
        { label: '\u9884\u7ea6\u5355\u53f7', value: record.appointmentNo || '-' }
      ].concat(getEmailPartyFieldEntries(record)).concat([
        { label: '\u9884\u7ea6\u4ed3\u5e93', value: (record.warehouse || record.confirmedWarehouse || '-') + ' (US West Warehouse)' }
      ]).concat(getFgEmailWarehouseConfirmFieldEntries(record)),
      bodyLines: [
        '\u60a8\u597d\uff01',
        '',
        resend
          ? '\u4ed3\u5e93\u5df2\u6839\u636e\u5b9e\u9645\u60c5\u51b5\u8c03\u6574\u4e86\u60a8\u7684\u5165\u4ed3\u9884\u7ea6\u65f6\u6bb5\uff08\u5355\u53f7\uff1a' + no + '\uff09\u3002'
          : '\u597d\u6d88\u606f\uff01\u60a8\u63d0\u4ea4\u7684\u5165\u4ed3\u9884\u7ea6\u7533\u8bf7\uff08\u5355\u53f7\uff1a' + no + '\uff09\u5df2\u901a\u8fc7\u4ed3\u5e93\u5ba1\u6838\u3002',
        '',
        resend
          ? '\u8bf7\u60a8\u5728 48\u5c0f\u65f6\u5185 \u91cd\u65b0\u786e\u8ba4\u4ee5\u4e0b\u6700\u65b0\u5206\u914d\u7684\u65f6\u6bb5\uff1a'
          : '\u4e3a\u4e86\u786e\u4fdd\u60a8\u7684\u8d27\u7269\u80fd\u51c6\u65f6\u5165\u4ed3\uff0c\u8bf7\u60a8\u5728 48\u5c0f\u65f6\u5185 \u5b8c\u6210\u6700\u540e\u7684\u786e\u8ba4\u64cd\u4f5c\uff1a',
        '',
        '\u9884\u7ea6\u5355\u53f7\uff1a' + (record.appointmentNo || '-')
      ].concat(getEmailPartyBodyLines(record)).concat([
        '\u9884\u7ea6\u4ed3\u5e93\uff1a' + (record.warehouse || record.confirmedWarehouse || '-') + ' (US West Warehouse)'
      ]).concat(getFgEmailWarehouseConfirmBodyLines(record)).concat([
        '',
        '\u3010\u5fc5\u987b\u64cd\u4f5c\u3011',
        '\u8bf7\u70b9\u51fb\u4e0b\u65b9\u94fe\u63a5\u8fdb\u5165\u7cfb\u7edf\uff0c\u786e\u8ba4\u4e0a\u8ff0\u5206\u914d\u7684\u65f6\u6bb5\u3002\u903e\u671f\u672a\u786e\u8ba4\uff0c\u8be5\u65f6\u6bb5\u53ef\u80fd\u4f1a\u91cd\u65b0\u91ca\u653e\u7ed9\u5176\u4ed6\u9884\u7ea6\u3002',
        '',
        '[\u70b9\u51fb\u6b64\u5904\uff1a\u786e\u8ba4\u662f\u5426\u63a5\u53d7\u9884\u7ea6]',
        '',
        '\u6e29\u99a8\u63d0\u793a\uff1a',
        '',
        '\u786e\u8ba4\u540e\uff0c\u7cfb\u7edf\u5c06\u751f\u6210\u6700\u7ec8\u7684\u201c\u5165\u4ed3\u4e8c\u7ef4\u7801/\u51ed\u8bc1\u201d\uff0c\u8bf7\u4ea4\u7531\u53f8\u673a\u968f\u8d27\u643a\u5e26\u3002',
        '\u8bf7\u786e\u4fdd\u53f8\u673a\u5728\u6838\u5b9a\u65f6\u95f4\u5185\u5230\u8fbe\uff0c\u5982\u9700\u53d6\u6d88\u6216\u53d8\u66f4\uff0c\u8bf7\u81f3\u5c11\u63d0\u524d12\u5c0f\u65f6\u5728\u7cfb\u7edf\u5904\u7406\u3002',
        '\u795d\u5de5\u4f5c\u987a\u5229\uff01',
        '',
        '\u4ed3\u5e93\u9884\u7ea6\u7cfb\u7edf',
        '[WEDO EXPRESS]',
        '',
        '\uff08\u5f53\u524d\u4e3a\u7cfb\u7edf\u90ae\u4ef6\uff0c\u8bf7\u52ff\u56de\u590d\uff09'
      ])
    });
  }

  function buildWarehouseSlotResendEmailMessages(oldItem, record) {
    if (!record || record.status !== '\u5ba2\u6237\u5f85\u786e\u8ba4') return [];
    return [buildWarehouseSlotPendingCustomerConfirmPayload(oldItem, record, true)];
  }

  function dispatchAppointmentNotifyPayloads(payloads) {
    if (!payloads || !payloads.length) return;
    payloads.forEach(function (payload, index) {
      var localEntry = {
        id: 'mail-local-' + Date.now() + '-' + index,
        sentAt: new Date().toISOString(),
        to: payload.to,
        subject: payload.subject,
        body: payload.body,
        templateKey: payload.templateKey,
        recipientRole: payload.recipientRole,
        title: payload.title,
        intro: payload.intro,
        actionUrl: payload.actionUrl,
        actionLabel: payload.actionLabel,
        footerNote: payload.footerNote,
        footerColor: payload.footerColor,
        hideRecipientRole: payload.hideRecipientRole,
        hideActionButton: payload.hideActionButton,
        inlineActionLinkLabel: payload.inlineActionLinkLabel,
        fields: payload.fields,
        appointmentId: payload.appointmentId,
        appointmentNo: payload.appointmentNo,
        deliveryCode: payload.deliveryCode,
        oldStatus: payload.oldStatus,
        newStatus: payload.newStatus
      };
      appendLocalNotifyMailLog(localEntry);
      if (typeof console !== 'undefined' && console.info) {
        console.info('[预约通知邮件]', payload.templateKey, payload.recipientRole, payload.to, payload.oldStatus, '->', payload.newStatus);
      }
      if (typeof fetch === 'undefined') return;
      fetch(APPOINTMENT_NOTIFY_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
        .then(function (res) {
          return res.json().then(function (body) {
            if (!res.ok) throw new Error((body && body.error) || '邮件发送失败');
            if (body && body.entry && body.entry.status === 'sent' && console.info) {
              console.info('[预约通知邮件] SMTP 已发送', body.entry.templateKey || payload.templateKey, body.entry.messageId || '');
            }
            return body;
          });
        })
        .catch(function (err) {
          if (console.warn) console.warn('[预约通知邮件]', err.message || err);
        });
    });
  }

  function sendAppointmentWarehouseSlotResendEmail(oldItem, record) {
    dispatchAppointmentNotifyPayloads(buildWarehouseSlotResendEmailMessages(oldItem, record));
  }

  /** 还柜：整柜或已填集装箱号 */
  function isEligibleForEmptyContainerReturn(record) {
    if (!record) return false;
    if (record.deliveryType === '\u6574\u67dc') return true;
    return !!(String(record.containerNo || '').trim());
  }

  var US_SIGNOFF_EDIT_STATUSES = ['\u5f85\u9001\u4ed3', '\u5df2\u9001\u4ed3'];

  /** 海外仓 Web 签收/更新签收：待送仓、已送仓 */
  function isEligibleForUsSignOff(record) {
    return !!(record && US_SIGNOFF_EDIT_STATUSES.indexOf(record.status) >= 0);
  }

  function isUsSignOffContentUpdate(record) {
    return !!(record && record.status === '\u5df2\u9001\u4ed3');
  }

  /** 列表多选：待送仓/已送仓可签收；整柜/有箱号可还柜 */
  function isEligibleForRecvListSelect(record) {
    return isEligibleForEmptyContainerReturn(record) || isEligibleForUsSignOff(record);
  }

  function getContactNotifyEmails(record) {
    if (!record) return APPOINTMENT_NOTIFY_EMAIL;
    var list = [];
    var primary = record.primaryEmail ? String(record.primaryEmail).trim() : '';
    if (primary) list.push(primary);
    (record.emails || []).forEach(function (e) {
      var v = String(e || '').trim();
      if (v && list.indexOf(v) === -1) list.push(v);
    });
    return list.length ? list.join(',') : APPOINTMENT_NOTIFY_EMAIL;
  }

  /** 还柜通知：业务联系人 + 演示固定抄送 */
  function getEmptyContainerReturnNotifyEmails(record) {
    return withDemoCcEmail(getContactNotifyEmails(record));
  }

  /** 从预约单仓库名称解析代码，如「美西仓库(CA-91761)」→ CA-91761 */
  function extractAppointmentWarehouseCode(record) {
    var whName = (record && (record.confirmedWarehouse || record.warehouse)) || '';
    var m = String(whName).match(/\(([^)]+)\)/);
    if (m && m[1]) return String(m[1]).trim();
    return String(whName || '').trim() || '-';
  }

  function getWarehouseNotifyMeta(record) {
    var whName = (record && (record.confirmedWarehouse || record.warehouse)) || '';
    var entry = null;
    if (typeof findWarehouseRegistryEntry === 'function') {
      entry = findWarehouseRegistryEntry(whName);
    }
    if (!entry) entry = findWarehouseAddressBook(whName);
    var notifyCode = (entry && entry.warehouseNotifyCode) || 'USAHOU-K001';
    return {
      warehouseNotifyCode: notifyCode,
      warehouseCode: extractAppointmentWarehouseCode(record)
    };
  }

  function formatEmptyReturnNotifyTimeUs(isoOrStr) {
    var s = String(isoOrStr || formatNow()).trim();
    var m = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}))?/);
    if (!m) return s;
    var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    var month = months[parseInt(m[2], 10) - 1] || m[2];
    var day = parseInt(m[3], 10);
    var year = m[1];
    if (!m[4]) return month + ' ' + day + ', ' + year;
    var hour24 = parseInt(m[4], 10);
    var minute = m[5];
    var ampm = hour24 >= 12 ? 'PM' : 'AM';
    var hour12 = hour24 % 12;
    if (hour12 === 0) hour12 = 12;
    return month + ' ' + day + ', ' + year + ', ' + hour12 + ':' + minute + ' ' + ampm;
  }

  function buildEmptyContainerReturnSubject(record) {
    var deliveryCode = String((record && record.deliveryCode) || '-').trim() || '-';
    var containerNo = String((record && record.containerNo) || '-').trim() || '-';
    var whCode = extractAppointmentWarehouseCode(record);
    return 'PICKUP NOTICE-' + deliveryCode + '-' + containerNo + '-' + whCode;
  }

  function buildEmptyContainerReturnEmailPayload(record, notifyAt) {
    var at = notifyAt || formatNow();
    var containerNo = String((record && record.containerNo) || '').trim() || '-';
    var whCode = extractAppointmentWarehouseCode(record);
    var usDate = formatEmptyReturnNotifyTimeUs(at);
    var mailSubject = buildEmptyContainerReturnSubject(record);
    var mainLines = [
      'Wedo Warehouse (' + whCode + ') has released the empty container below for pickup.',
      'Notification time: ' + usDate,
      'Please arrange empty container pickup within 48 hours.'
    ];
    var warehouseForContact = resolveWarehouseForContact(record);
    var contactFooter = getWarehouseContactEmailFooter(warehouseForContact);
    var systemFooter = 'Wedo Booking System\n[WEDO EXPRESS]\n\nThis is an automated message. Please do not reply.';
    var footerNote = systemFooter;
    if (contactFooter) footerNote = footerNote + '\n\n' + contactFooter;
    var bodyLines = mainLines.slice();
    if (contactFooter) bodyLines.push('', contactFooter);
    bodyLines.push('', systemFooter);
    return {
      to: getEmptyContainerReturnNotifyEmails(record),
      subject: mailSubject,
      body: bodyLines.join('\n'),
      templateKey: 'empty_container_return_notify',
      recipientRole: '\u8d27\u4ee3',
      title: 'Empty Container Pickup Notice',
      intro: mainLines.join('\n'),
      hideRecipientRole: true,
      hideActionButton: true,
      footerNote: footerNote,
      footerColor: '#1f5f9f',
      warehouse: warehouseForContact,
      warehouseContactFooter: contactFooter,
      brand: {
        name: 'Wedo Supply Chain',
        subtitle: 'WEDO SCM',
        description: 'Inbound appointment and warehouse coordination for first-mile, warehousing, and last-mile delivery.',
        logoUrl: APPOINTMENT_MAIL_BRAND_LOGO_URL,
        watermarkUrl: APPOINTMENT_MAIL_BRAND_WATERMARK_URL || APPOINTMENT_MAIL_BRAND_LOGO_URL
      },
      fields: [
        { label: 'Appt. No.', value: (record && record.appointmentNo) || '-' },
        { label: 'Booking Code', value: (record && record.deliveryCode) || '-' },
        { label: 'Container No.', value: containerNo },
        { label: 'Notification Time', value: usDate },
        { label: 'Warehouse Code', value: whCode }
      ],
      appointmentId: (record && record.id) || '',
      appointmentNo: (record && record.appointmentNo) || '',
      deliveryCode: (record && record.deliveryCode) || '',
      oldStatus: (record && record.status) || '',
      newStatus: (record && record.status) || ''
    };
  }

  function applyEmptyContainerReturnNotify(record) {
    if (!record) return null;
    var updated = JSON.parse(JSON.stringify(record));
    var at = formatNow();
    updated.emptyReturnNotifyTime = at;
    pushOperationLogByKind(updated, LOG_OPERATOR_WAREHOUSE, 'empty_container_return', {
      at: at,
      containerNo: record.containerNo,
      emails: getEmptyContainerReturnNotifyEmails(record)
    }, { audience: LOG_AUDIENCE_INTERNAL });
    return updated;
  }

  function submitEmptyContainerReturnNotify(records, done) {
    var list = (records || []).filter(isEligibleForEmptyContainerReturn);
    if (!list.length) {
      if (done) done(new Error('no eligible records'), []);
      return;
    }
    var payloads = [];
    var updatedList = [];
    list.forEach(function (record) {
      var updated = applyEmptyContainerReturnNotify(record);
      if (!updated) return;
      updatedList.push(updated);
      payloads.push(buildEmptyContainerReturnEmailPayload(updated, updated.emptyReturnNotifyTime));
    });
    if (!updatedList.length) {
      if (done) done(new Error('apply failed'), []);
      return;
    }
    var pending = updatedList.length;
    var firstErr = null;
    updatedList.forEach(function (updated) {
      addOrUpdateInMockAndPersist(updated, null, function (err) {
        if (err && !firstErr) firstErr = err;
        pending--;
        if (pending === 0) {
          dispatchAppointmentNotifyPayloads(payloads);
          if (done) done(firstErr, updatedList);
        }
      });
    });
  }

  function formatTimeSlot(start, end) {
    if (!start && !end) return '';
    if (start && end) return start + ' ~ ' + end;
    return start || end || '';
  }

  /**
   * 仓库确认时段格式：YYYY-MM-DD HH:MM--HH:MM（同日开始结束）
   */
  function formatWarehouseSlot(date, startHHMM, endHHMM) {
    var d = String(date || '').trim();
    var s = String(startHHMM || '').trim();
    var e = String(endHHMM || '').trim();
    if (!d || !s || !e) return '';
    return d + ' ' + s + '--' + e;
  }

  function parseWarehouseSlot(str) {
    var empty = { date: '', startHHMM: '', endHHMM: '' };
    if (!str) return empty;
    var s = String(str).trim();
    var m = s.match(/^(\d{4}-\d{2}-\d{2})\s+(\d{1,2}:\d{2})\s*--\s*(\d{1,2}:\d{2})$/);
    if (!m) return empty;
    return { date: m[1], startHHMM: m[2], endHHMM: m[3] };
  }

  /** 从 operationLogs 中数已有"第N轮审核"出现次数，返回下一轮序号（>=1） */
  function nextAuditRound(item) {
    var logs = (item && item.operationLogs) || [];
    var count = 0;
    for (var i = 0; i < logs.length; i++) {
      var action = String(logs[i].action || '');
      if (action.indexOf('\u8f6e\u5ba1\u6838') !== -1) count++;
    }
    return count + 1;
  }

  var LOG_AUDIENCE_ALL = 'all';
  var LOG_AUDIENCE_CUSTOMER = 'customer';
  var LOG_AUDIENCE_WAREHOUSE = 'warehouse';
  var LOG_AUDIENCE_INTERNAL = 'internal';

  var LOG_OPERATOR_WAREHOUSE = '\u6d77\u5916\u4ed3';
  var LOG_OPERATOR_WAREHOUSE_AUDIT = '\u6d77\u5916\u4ed3\u5ba1\u6838';
  var LOG_OPERATOR_PLATFORM = '\u5e73\u53f0';

  function logStatusChangeTail(status) {
    return '\uff0c\u72b6\u6001\u53d8\u66f4\u4e3a\u300c' + (status || '-') + '\u300d';
  }

  function logAuditRoundPrefix(round) {
    return round ? '\u7b2c' + round + '\u8f6e\u5ba1\u6838 \u00b7 ' : '';
  }

  function logConfirmRoundTag(round) {
    return round ? '\uff08\u7b2c' + round + '\u6b21\u786e\u8ba4\uff09' : '';
  }

  function logSignOffCustomerSummary(at, cartons, pallets) {
    var sum = '\u8d27\u7269\u5df2\u4e8e ' + (at || '-') + ' \u5b8c\u6210\u9001\u4ed3\u3002';
    var c = cartons != null && cartons !== '' ? cartons : null;
    var p = pallets != null && pallets !== '' ? pallets : null;
    if (c != null && c !== '-') {
      sum += '\uff08\u6536\u8d27\u7bb1\u6570 ' + c;
      if (p != null && p !== '-') sum += '\uff0c\u6258\u6570 ' + p;
      sum += '\uff09';
    } else if (p != null && p !== '-') {
      sum += '\uff08\u6258\u6570 ' + p + '\uff09';
    }
    return sum;
  }

  /**
   * 统一中文日志话术（内部 action + 客户短句）
   * @param {string} kind logKind
   * @param {object} [p]
   */
  function buildOperationLogBundle(kind, p) {
    p = p || {};
    var round = p.round;
    var prefix = logAuditRoundPrefix(round);
    var roundTag = logConfirmRoundTag(round);
    var slot = p.slot || '';
    var wh = p.warehouseName ? '\uff0c\u4ed3\u5e93\uff1a' + p.warehouseName : '';
    var remark = p.remark ? '\uff0c\u5907\u6ce8\uff1a' + p.remark : '';
    var reason = p.reason || '';
    var at = p.at || p.actualDeliveryTime || '';
    var cartons = p.cartons != null ? p.cartons : '-';
    var pallets = p.pallets != null ? p.pallets : '-';
    var photoCount = p.photoCount || 0;
    var photoExtra = photoCount > 0
      ? (p.appendPhotos ? '\uff0c\u8ffd\u52a0\u7b7e\u6536\u6587\u4ef6 ' + photoCount + ' \u4e2a' : '\uff0c\u4e0a\u4f20\u7b7e\u6536\u6587\u4ef6 ' + photoCount + ' \u4e2a')
      : '';
    var pdaDetail = p.pdaDetailMode ? '\uff08\u6309\u660e\u7ec6\u767b\u8bb0\uff09' : '';

    switch (kind) {
      case 'official_submit':
        return {
          action: '\u63d0\u4ea4\u9884\u7ea6' + logStatusChangeTail('\u4ed3\u5e93\u5f85\u5ba1\u6838'),
          customerSummary: '\u9884\u7ea6\u4fe1\u606f\u5df2\u63d0\u4ea4\uff0c\u7b49\u5f85\u4ed3\u5e93\u786e\u8ba4\u3002',
          customerRole: '\u60a8'
        };
      case 'official_withdraw':
        return {
          action: '\u64a4\u56de\u9884\u7ea6' + logStatusChangeTail('\u5f85\u9884\u7ea6'),
          customerSummary: '\u9884\u7ea6\u4fe1\u606f\u5df2\u66f4\u65b0\u3002',
          customerRole: '\u60a8'
        };
      case 'official_cancel':
        return {
          action: '\u53d6\u6d88\u9884\u7ea6' + logStatusChangeTail('\u5f85\u9884\u7ea6'),
          customerSummary: '\u60a8\u5df2\u53d6\u6d88\u672c\u6b21\u9884\u7ea6\u3002',
          customerRole: '\u60a8'
        };
      case 'official_rebook':
        return {
          action: '\u91cd\u65b0\u9884\u7ea6' + logStatusChangeTail('\u5f85\u9884\u7ea6'),
          customerSummary: '\u9884\u7ea6\u4fe1\u606f\u5df2\u66f4\u65b0\u3002',
          customerRole: '\u60a8'
        };
      case 'customer_accept_slot':
        return {
          action: '\u5ba2\u6237\u786e\u8ba4\u9001\u4ed3\u65f6\u6bb5 ' + (slot || '-') + logStatusChangeTail('\u5f85\u9001\u4ed3'),
          customerSummary: '\u60a8\u5df2\u786e\u8ba4\u63a5\u53d7\u4ed3\u5e93\u5b89\u6392\u7684\u9001\u4ed3\u65f6\u6bb5\u3002',
          customerRole: '\u60a8'
        };
      case 'customer_rebook':
        return {
          action: '\u5ba2\u6237\u672a\u63a5\u53d7\u9001\u4ed3\u65f6\u6bb5\uff0c\u91cd\u65b0\u9884\u7ea6' +
            (reason ? '\uff0c\u539f\u56e0\uff1a' + reason : '') + logStatusChangeTail('\u5f85\u9884\u7ea6'),
          customerSummary: '\u60a8\u672a\u63a5\u53d7\u5f53\u524d\u65f6\u6bb5\uff0c\u5df2\u91cd\u65b0\u63d0\u4ea4\u9884\u7ea6\u4fe1\u606f\u3002',
          customerRole: '\u60a8'
        };
      case 'customer_cancel':
        return {
          action: '\u5ba2\u6237\u53d6\u6d88\u9884\u7ea6' +
            (reason ? '\uff0c\u539f\u56e0\uff1a' + reason : '') + logStatusChangeTail('\u5f85\u9884\u7ea6'),
          customerSummary: '\u60a8\u5df2\u53d6\u6d88\u672c\u6b21\u9884\u7ea6\u3002',
          customerRole: '\u60a8'
        };
      case 'audit_reject':
        return {
          action: prefix + '\u62d2\u6536\uff0c\u539f\u56e0\uff1a' + reason + logStatusChangeTail('\u9884\u7ea6\u5931\u8d25'),
          customerSummary: '\u4ed3\u5e93\u672a\u80fd\u63a5\u53d7\u672c\u6b21\u9884\u7ea6\uff0c\u539f\u56e0\uff1a' + reason + '\u3002\u9884\u7ea6\u672a\u901a\u8fc7\u3002',
          customerRole: '\u4ed3\u5e93'
        };
      case 'audit_confirm':
        return {
          action: prefix + '\u786e\u8ba4\u9001\u4ed3\u65f6\u6bb5 ' + slot + wh + remark +
            logStatusChangeTail('\u5ba2\u6237\u5f85\u786e\u8ba4'),
          customerSummary: '\u4ed3\u5e93\u5df2\u786e\u8ba4\u9001\u4ed3\u65f6\u6bb5\uff1a' + slot + roundTag + '\u3002',
          customerRole: '\u4ed3\u5e93'
        };
      case 'audit_update':
        return {
          action: prefix + '\u66f4\u65b0\u9001\u4ed3\u65f6\u6bb5 ' + slot + wh + remark + '\uff0c\u5df2\u91cd\u53d1\u5ba2\u6237\u786e\u8ba4\u90ae\u4ef6',
          customerSummary: '\u4ed3\u5e93\u5df2\u66f4\u65b0\u9001\u4ed3\u65f6\u6bb5\uff1a' + slot + roundTag + '\u3002',
          customerRole: '\u4ed3\u5e93'
        };
      case 'empty_container_return':
        return {
          action: '\u53d1\u9001\u8fd8\u7a7a\u901a\u77e5\uff0c\u67dc\u53f7 ' + (p.containerNo || '-') +
            '\uff0c\u901a\u77e5\u65f6\u95f4 ' + at + '\uff0c\u901a\u77e5\u90ae\u7bb1\uff1a' + (p.emails || '-'),
          customerSummary: '',
          customerRole: ''
        };
      case 'pda_signoff':
        return {
          action: 'PDA\u6536\u8d27\u7b7e\u6536' + pdaDetail + '\uff0c\u6536\u8d27\u603b\u6258\u6570\uff1a' + pallets +
            '\uff0c\u6536\u8d27\u603b\u7bb1\u6570\uff1a' + cartons + logStatusChangeTail('\u5df2\u9001\u4ed3'),
          customerSummary: logSignOffCustomerSummary(at, cartons, pallets),
          customerRole: '\u4ed3\u5e93'
        };
      case 'us_web_signoff':
        return {
          action: '\u7f51\u9875\u7b7e\u6536\uff0c\u5b9e\u9645\u9001\u4ed3\u65f6\u95f4 ' + at +
            '\uff0c\u6536\u8d27\u603b\u7bb1\u6570\uff1a' + cartons + '\uff0c\u6536\u8d27\u603b\u6258\u6570\uff1a' + pallets +
            photoExtra + logStatusChangeTail('\u5df2\u9001\u4ed3') + (p.remark ? '\uff0c\u5907\u6ce8\uff1a' + p.remark : ''),
          customerSummary: logSignOffCustomerSummary(at, cartons, pallets),
          customerRole: '\u4ed3\u5e93'
        };
      case 'us_web_signoff_update':
        return {
          action: '\u7f51\u9875\u66f4\u65b0\u7b7e\u6536\uff0c\u5b9e\u9645\u9001\u4ed3\u65f6\u95f4 ' + at +
            '\uff0c\u6536\u8d27\u603b\u7bb1\u6570\uff1a' + cartons + '\uff0c\u6536\u8d27\u603b\u6258\u6570\uff1a' + pallets +
            photoExtra + (p.remark ? '\uff0c\u5907\u6ce8\uff1a' + p.remark : ''),
          customerSummary: '\u4ed3\u5e93\u5df2\u66f4\u65b0\u9001\u4ed3\u6536\u8d27\u4fe1\u606f\u3002',
          customerRole: '\u4ed3\u5e93'
        };
      case 'wh_force_signoff':
        return {
          action: '\u5e73\u53f0\u5f3a\u5236\u7b7e\u6536\uff0c\u5b9e\u9645\u9001\u4ed3\u65f6\u95f4 ' + at +
            logStatusChangeTail('\u5df2\u9001\u4ed3') + (p.remark ? '\uff0c\u5907\u6ce8\uff1a' + p.remark : ''),
          customerSummary: '\u5e73\u53f0\u5df2\u786e\u8ba4\u9001\u4ed3\uff0c\u9001\u4ed3\u65f6\u95f4\uff1a' + at + '\u3002',
          customerRole: '\u5e73\u53f0'
        };
      default:
        return { action: '', customerSummary: '', customerRole: '' };
    }
  }

  function normalizeWithdrawLogKind(arg) {
    if (!arg || typeof arg !== 'string') return 'official_withdraw';
    if (arg === 'official_cancel' || arg === 'official_rebook' || arg === 'official_withdraw') return arg;
    if (arg.indexOf('\u53d6\u6d88') >= 0) return 'official_cancel';
    if (arg.indexOf('\u91cd\u65b0\u9884\u7ea6') >= 0) return 'official_rebook';
    return 'official_withdraw';
  }

  function pushOperationLogByKind(item, operator, kind, params, extraMeta) {
    var bundle = buildOperationLogBundle(kind, params);
    var meta = {
      logKind: kind,
      customerSummary: bundle.customerSummary,
      customerRole: bundle.customerRole
    };
    if (extraMeta) {
      for (var k in extraMeta) {
        if (Object.prototype.hasOwnProperty.call(extraMeta, k)) meta[k] = extraMeta[k];
      }
    }
    pushOperationLog(item, operator, bundle.action, meta);
  }

  /**
   * @param {object} [meta] audience, logKind, customerSummary, customerRole
   */
  function pushOperationLog(item, operator, action, meta) {
    if (!item.operationLogs) item.operationLogs = [];
    var m = meta || {};
    item.operationLogs.push({
      time: formatNow(),
      operator: operator,
      action: action,
      audience: m.audience || LOG_AUDIENCE_ALL,
      logKind: m.logKind || '',
      customerSummary: m.customerSummary || '',
      customerRole: m.customerRole || ''
    });
  }

  function parseAuditRoundFromAction(action) {
    var m = String(action || '').match(/\u7b2c(\d+)\u8f6e\u5ba1\u6838/);
    return m ? m[1] : '';
  }

  function auditRoundLabel(action) {
    var n = parseAuditRoundFromAction(action);
    return n ? '\uff08\u7b2c' + n + '\u6b21\u786e\u8ba4\uff09' : '';
  }

  function isCustomerPortalLogVisible(entry, item) {
    var kind = String(entry.logKind || '');
    if (kind === 'empty_container_return' || kind === 'us_web_signoff_update') return false;
    var aud = entry.audience || LOG_AUDIENCE_ALL;
    if (aud === LOG_AUDIENCE_INTERNAL || aud === LOG_AUDIENCE_WAREHOUSE) return false;
    var action = String(entry.action || '');
    if (!kind && (action.indexOf('\u8fd8\u7a7a\u901a\u77e5') >= 0 || action.indexOf('\u53d1\u9001\u8fd8\u7a7a') >= 0)) return false;
    if (!kind && action.indexOf('\u7f51\u9875\u66f4\u65b0\u7b7e\u6536') >= 0) return false;
    if (!kind && action.indexOf('Web\u66f4\u65b0') >= 0) return false;
    return true;
  }

  function resolveCustomerRole(entry, item) {
    if (entry.customerRole) return entry.customerRole;
    var op = String(entry.operator || '');
    var action = String(entry.action || '');
    if (op === LOG_OPERATOR_PLATFORM || op.indexOf('\u4ed3\u50a8\u4e2d\u53f0') >= 0 ||
        action.indexOf('\u5e73\u53f0\u5f3a\u5236') >= 0 || action.indexOf('\u5e73\u53f0\u5df2\u786e\u8ba4') >= 0 ||
        action.indexOf('\u4ed3\u50a8\u4e2d\u53f0') >= 0 || action.indexOf('\u5f3a\u5236\u7b7e\u6536') >= 0) {
      return '\u5e73\u53f0';
    }
    if (op.indexOf('\u6d77\u5916\u4ed3') >= 0 || action.indexOf('\u8f6e\u5ba1\u6838') >= 0 ||
        action.indexOf('PDA') >= 0 || action.indexOf('\u7f51\u9875\u7b7e\u6536') >= 0 ||
        action.indexOf('Web\u7b7e\u6536') >= 0 || action.indexOf('\u534f\u5546\u65f6\u95f4') >= 0 ||
        action.indexOf('\u786e\u8ba4\u9001\u4ed3\u65f6\u6bb5') >= 0 || action.indexOf('\u66f4\u65b0\u9001\u4ed3\u65f6\u6bb5') >= 0) {
      return '\u4ed3\u5e93';
    }
    var cc = item && item.customerCode ? String(item.customerCode).trim() : '';
    if ((cc && op === cc) || action.indexOf('\u5ba2\u6237') >= 0 || action.indexOf('\u5b98\u7f51') >= 0) {
      return '\u60a8';
    }
    if (item && getBookerParty(item) === op) return '\u60a8';
    return '\u7cfb\u7edf';
  }

  function inferCustomerSummaryFromAction(entry, item) {
    var action = String(entry.action || '');
    var roundTag = auditRoundLabel(action);
    var slotM;
    var timeM;
    if (action.indexOf('\u5e73\u53f0\u5f3a\u5236') >= 0 || action.indexOf('\u4ed3\u50a8\u4e2d\u53f0') >= 0 ||
        action.indexOf('\u5f3a\u5236\u7b7e\u6536') >= 0) {
      timeM = action.match(/\u5b9e\u9645\u9001\u4ed3\u65f6\u95f4\s+([^\uff0c,]+)/) ||
        action.match(/\u5b9e\u9645\u5230\u4ed3\u65f6\u95f4\s+([^\uff0c,]+)/);
      return '\u5e73\u53f0\u5df2\u786e\u8ba4\u9001\u4ed3\uff0c\u9001\u4ed3\u65f6\u95f4\uff1a' + (timeM ? timeM[1] : '-') + '\u3002';
    }
    if (action.indexOf('\u62d2\u6536') >= 0 || action.indexOf('\u9884\u7ea6\u5931\u8d25') >= 0) {
      var reasonM = action.match(/\u539f\u56e0[：:]\s*([^，,\uff0c]+)/);
      return '\u4ed3\u5e93\u672a\u80fd\u63a5\u53d7\u672c\u6b21\u9884\u7ea6' +
        (reasonM ? '\uff0c\u539f\u56e0\uff1a' + reasonM[1] : '') + '\u3002\u9884\u7ea6\u672a\u901a\u8fc7\u3002';
    }
    if (action.indexOf('\u66f4\u65b0\u9001\u4ed3\u65f6\u6bb5') >= 0 || action.indexOf('\u66f4\u65b0\u786e\u8ba4\u65f6\u6bb5') >= 0) {
      slotM = action.match(/\u9001\u4ed3\u65f6\u6bb5\s+([^\uff0c,]+)/) ||
        action.match(/\u786e\u8ba4\u65f6\u6bb5\s+([^\uff0c,]+)/);
      return '\u4ed3\u5e93\u5df2\u66f4\u65b0\u9001\u4ed3\u65f6\u6bb5\uff1a' + (slotM ? slotM[1] : '-') + roundTag + '\u3002';
    }
    if (action.indexOf('\u786e\u8ba4\u9001\u4ed3\u65f6\u6bb5') >= 0 || action.indexOf('\u786e\u8ba4\u65f6\u6bb5') >= 0 ||
        action.indexOf('\u534f\u5546\u65f6\u95f4') >= 0 ||
        (action.indexOf('\u8f6e\u5ba1\u6838') >= 0 && action.indexOf('\u786e\u8ba4') >= 0)) {
      slotM = action.match(/\u9001\u4ed3\u65f6\u6bb5\s+([^\uff0c,]+)/) ||
        action.match(/\u786e\u8ba4\u65f6\u6bb5\s+([^\uff0c,]+)/) ||
        action.match(/\u65f6\u6bb5[：:]\s*([^\uff0c,]+)/);
      return '\u4ed3\u5e93\u5df2\u786e\u8ba4\u9001\u4ed3\u65f6\u6bb5\uff1a' + (slotM ? slotM[1] : '-') + roundTag + '\u3002';
    }
    if (action.indexOf('PDA') >= 0 || action.indexOf('\u7f51\u9875\u7b7e\u6536') >= 0 ||
        action.indexOf('Web\u7b7e\u6536') >= 0 || action.indexOf('\u786e\u8ba4\u5230\u4ed3') >= 0 ||
        action.indexOf('\u5df2\u9001\u4ed3') >= 0) {
      timeM = action.match(/(\d{4}-\d{2}-\d{2}[ \d:]*)/);
      var cartM = action.match(/\u6536\u8d27\u603b\u7bb1\u6570[：:]\s*([^，,\uff0c]+)/);
      var palM = action.match(/\u6536\u8d27\u603b\u6258\u6570[：:]\s*([^，,\uff0c]+)/) ||
        action.match(/\u603b\u6258\u6570[：:]\s*([^，,\uff0c]+)/);
      var s = '\u8d27\u7269\u5df2\u4e8e ' + (timeM ? timeM[1].trim() : '-') + ' \u5b8c\u6210\u9001\u4ed3\u3002';
      if (cartM && cartM[1] !== '-') s += '\uff08\u6536\u8d27\u7bb1\u6570 ' + cartM[1];
      if (palM && palM[1] !== '-') {
        s += (cartM && cartM[1] !== '-' ? '\uff0c' : '\uff08') + '\u6258\u6570 ' + palM[1];
      }
      if ((cartM && cartM[1] !== '-') || (palM && palM[1] !== '-')) s += '\uff09';
      return s;
    }
    if (action.indexOf('\u5ba2\u6237\u786e\u8ba4\u63a5\u53d7') >= 0 || action.indexOf('\u5b98\u7f51\u786e\u8ba4\u63a5\u53d7') >= 0 ||
        action.indexOf('\u63a5\u53d7\u4ed3\u5e93') >= 0) {
      return '\u60a8\u5df2\u786e\u8ba4\u63a5\u53d7\u4ed3\u5e93\u5b89\u6392\u7684\u9001\u4ed3\u65f6\u6bb5\u3002';
    }
    if (action.indexOf('\u91cd\u65b0\u9884\u7ea6') >= 0 || action.indexOf('\u4e0d\u63a5\u53d7') >= 0) {
      return '\u60a8\u672a\u63a5\u53d7\u5f53\u524d\u65f6\u6bb5\uff0c\u5df2\u91cd\u65b0\u63d0\u4ea4\u9884\u7ea6\u4fe1\u606f\u3002';
    }
    if (action.indexOf('\u53d6\u6d88\u9884\u7ea6') >= 0 || action.indexOf('\u5ba2\u6237\u53d6\u6d88') >= 0) {
      return '\u60a8\u5df2\u53d6\u6d88\u672c\u6b21\u9884\u7ea6\u3002';
    }
    if (action.indexOf('\u63d0\u4ea4\u9884\u7ea6') >= 0 || action.indexOf('\u5ba2\u6237\u63d0\u4ea4') >= 0) {
      return '\u60a8\u5df2\u63d0\u4ea4\u9884\u7ea6\u9001\u4ed3\u7533\u8bf7\u3002';
    }
    if (action.indexOf('\u5b98\u7f51\u63d0\u4ea4') >= 0) {
      return '\u9884\u7ea6\u4fe1\u606f\u5df2\u63d0\u4ea4\uff0c\u7b49\u5f85\u4ed3\u5e93\u786e\u8ba4\u3002';
    }
    if (action.indexOf('\u5f85\u9884\u7ea6') >= 0 && action.indexOf('\u53d8\u66f4') >= 0) {
      return '\u9884\u7ea6\u4fe1\u606f\u5df2\u66f4\u65b0\u3002';
    }
    if (action.length > 100) return action.slice(0, 100) + '\u2026';
    return action;
  }

  function resolveCustomerSummary(entry, item) {
    if (entry.customerSummary) return entry.customerSummary;
    return inferCustomerSummaryFromAction(entry, item);
  }

  /**
   * @param {object} [options] portal: customer|warehouse；sort: asc|desc（默认 customer=asc，warehouse=desc）
   */
  function getOperationLogs(item, options) {
    if (!item || !Array.isArray(item.operationLogs)) return [];
    var opts = options || {};
    var portal = opts.portal || 'warehouse';
    var raw = item.operationLogs.slice();
    var list = raw;
    if (portal === 'customer') {
      list = raw.filter(function (entry) { return isCustomerPortalLogVisible(entry, item); });
      list = list.map(function (entry) {
        return {
          time: entry.time,
          operator: resolveCustomerRole(entry, item),
          action: resolveCustomerSummary(entry, item),
          customerView: true
        };
      });
    }
    var sort = opts.sort || (portal === 'customer' ? 'asc' : 'desc');
    if (sort === 'desc') list = list.slice().reverse();
    return list;
  }

  /**
   * 海外仓审核（仓库待审核状态下）
   * @param {object} item 预约单
   * @param {object} opts
   *   - decision: 'confirm'（确认时段，统一→客户待确认）| 'reject'（拒收→预约失败）
   *   - warehouseId: 仓库 id（confirm 必填）
   *   - slotDate / slotStartHHMM / slotEndHHMM: 仓库回的时段（confirm 必填，同日 HH:MM）
   *   - remark: 审核备注（confirm 选填）/ 拒收原因（reject 必填）
   */
  function applyReceivingAudit(item, opts) {
    if (!item || item.status !== '\u4ed3\u5e93\u5f85\u5ba1\u6838' || !opts || !opts.decision) return null;
    var updated = JSON.parse(JSON.stringify(item));
    var operator = LOG_OPERATOR_WAREHOUSE_AUDIT;
    var round = nextAuditRound(updated);

    if (opts.decision === 'reject') {
      var reason = String(opts.remark || '').trim();
      if (reason.length < 5) return null;
      updated.status = '\u9884\u7ea6\u5931\u8d25';
      updated.rejectRemark = reason;
      pushOperationLogByKind(updated, operator, 'audit_reject', { round: round, reason: reason });
      return updated;
    }

    if (opts.decision === 'confirm') {
      var wh = opts.warehouseId ? findUsWarehouseById(opts.warehouseId) : findUsWarehouseById('us-west-ca91761');
      var whName = wh ? wh.name : '';
      var whAddr = wh ? wh.address : '';
      var slot = formatWarehouseSlot(opts.slotDate, opts.slotStartHHMM, opts.slotEndHHMM);
      if (!slot) return null;
      if (opts.slotStartHHMM >= opts.slotEndHHMM) return null;
      var remark = String(opts.remark || '').trim();
      updated.status = '\u5ba2\u6237\u5f85\u786e\u8ba4';
      updated.confirmedWarehouse = whName;
      updated.warehouse = whName || updated.warehouse;
      updated.warehouseConfirmedAddress = whAddr;
      updated.warehouseConfirmedInboundTime = slot;
      updated.auditRemark = remark;
      updated.rejectRemark = '';
      pushOperationLogByKind(updated, operator, 'audit_confirm', {
        round: round,
        slot: slot,
        warehouseName: whName,
        remark: remark
      });
      return updated;
    }

    return null;
  }

  function submitReceivingAudit(item, opts, done) {
    var updated = applyReceivingAudit(item, opts);
    if (!updated) {
      if (done) done(new Error('audit failed'), null);
      return null;
    }
    return addOrUpdateInMockAndPersist(updated, null, done);
  }

  /**
   * 海外仓更新审核（客户待确认状态下，修改仓库/时段后重发确认邮件）
   */
  function applyReceivingAuditUpdate(item, opts) {
    if (!item || item.status !== '\u5ba2\u6237\u5f85\u786e\u8ba4' || !opts) return null;
    if (opts.decision && opts.decision !== 'confirm') return null;
    var updated = JSON.parse(JSON.stringify(item));
    var operator = LOG_OPERATOR_WAREHOUSE_AUDIT;
    var round = nextAuditRound(updated);
    var wh = opts.warehouseId ? findUsWarehouseById(opts.warehouseId) : findUsWarehouseById('us-west-ca91761');
    var whName = wh ? wh.name : '';
    var whAddr = wh ? wh.address : '';
    var slot = formatWarehouseSlot(opts.slotDate, opts.slotStartHHMM, opts.slotEndHHMM);
    if (!slot) return null;
    if (opts.slotStartHHMM >= opts.slotEndHHMM) return null;
    var remark = String(opts.remark || '').trim();
    updated.status = '\u5ba2\u6237\u5f85\u786e\u8ba4';
    updated.confirmedWarehouse = whName;
    updated.warehouse = whName || updated.warehouse;
    updated.warehouseConfirmedAddress = whAddr;
    updated.warehouseConfirmedInboundTime = slot;
    updated.auditRemark = remark;
    pushOperationLogByKind(updated, operator, 'audit_update', {
      round: round,
      slot: slot,
      warehouseName: whName,
      remark: remark
    });
    return updated;
  }

  function submitReceivingAuditUpdate(item, opts, done) {
    var oldItem = item ? JSON.parse(JSON.stringify(item)) : null;
    var updated = applyReceivingAuditUpdate(item, opts);
    if (!updated) {
      if (done) done(new Error('audit update failed'), null);
      return null;
    }
    addOrUpdateInMockAndPersist(updated, null, function (err, record) {
      if (record) sendAppointmentWarehouseSlotResendEmail(oldItem, record);
      if (done) done(err, record);
    });
    return updated;
  }

  /** 演示用：一键确认（确认时段，默认下午时段） */
  function auditReceivingAppointment(item, done) {
    var today = formatNow().slice(0, 10);
    return submitReceivingAudit(item, {
      decision: 'confirm',
      warehouseId: 'us-west-ca91761',
      slotDate: (item && ((getExpectedInboundDates(item)[0]) || item.expectedInboundTime)) || today,
      slotStartHHMM: '14:00',
      slotEndHHMM: '17:00'
    }, done);
  }

  /** 待提交未生成送仓码，客户前台不展示送仓码/预约链接 */
  function isDeliveryCodePublished(item) {
    if (!item) return false;
    if (String(item.status || '').trim() === '\u5f85\u63d0\u4ea4') return false;
    return !!String(item.deliveryCode || '').trim();
  }

  function formatDeliveryCodeCell(item) {
    if (!isDeliveryCodePublished(item)) return '-';
    return formatCell(item.deliveryCode);
  }

  function defaultBookingLink(item) {
    if (!isDeliveryCodePublished(item)) return '';
    if (item && item.bookingLink) return item.bookingLink;
    if (item && item.deliveryCode) {
      return '/fg/index.html?code=' + encodeURIComponent(item.deliveryCode);
    }
    return '';
  }

  function escapeHtmlLite(str) {
    if (str == null) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /** \u9884\u7ea6\u94fe\u63a5\u5c55\u793a\uff08\u5b98\u7f51\u9001\u4ed3\u7801\u5165\u53e3\uff09 */
  function buildBookingLinkHtml(item) {
    var link = defaultBookingLink(item);
    if (!link) return '-';
    var href = resolvePublicUrl(link);
    var safe = escapeHtmlLite(href);
    return '<a href="' + safe + '" target="_blank" rel="noopener" class="detail-booking-link">' + safe + '</a>';
  }

  /** \u5217\u8868\u9884\u7ea6\u94fe\u63a5\uff1a\u4ee5\u300c\u4e0b\u8f7d\u94fe\u63a5\u300d\u6587\u6848\u5c55\u793a */
  function buildBookingLinkListCell(item) {
    if (!isDeliveryCodePublished(item)) return '-';
    var link = defaultBookingLink(item);
    if (!link) return '-';
    var href = resolvePublicUrl(link);
    return '<a href="' + escapeHtmlLite(href) + '" target="_blank" rel="noopener" class="list-download-link">\u4e0b\u8f7d\u94fe\u63a5</a>';
  }

  /**
   * \u64cd\u4f5c\u65e5\u5fd7\u5217\u8868 HTML
   * @param {object} options portal(customer|warehouse), sort, emptyClass, timeClass, emptyText, roleClass
   */
  function buildOperationLogListHtml(item, options) {
    var opts = options || {};
    var emptyClass = opts.emptyClass || 'detail-log-empty';
    var timeClass = opts.timeClass || 'detail-log-time';
    var roleClass = opts.roleClass || 'detail-log-role';
    var emptyText = opts.emptyText != null ? opts.emptyText : '\u6682\u65e0\u65e5\u5fd7';
    var portal = opts.portal || 'warehouse';
    if (portal === 'customer') emptyText = opts.emptyText != null ? opts.emptyText : '\u6682\u65e0\u64cd\u4f5c\u8bb0\u5f55';
    var logs = getOperationLogs(item, { portal: portal, sort: opts.sort });
    if (!logs.length) {
      return '<li class="' + emptyClass + '">' + escapeHtmlLite(emptyText) + '</li>';
    }
    return logs.map(function (log) {
      if (log.customerView) {
        return '<li><span class="' + timeClass + '">' + escapeHtmlLite(log.time || '-') + '</span>' +
          '<strong class="' + roleClass + '">' + escapeHtmlLite(log.operator || '-') + '</strong> ' +
          escapeHtmlLite(log.action || '') + '</li>';
      }
      return '<li><span class="' + timeClass + '">' + escapeHtmlLite(log.time || '-') + '</span>' +
        '<strong>' + escapeHtmlLite(log.operator || '-') + '</strong> ' +
        escapeHtmlLite(log.action || '') + '</li>';
    }).join('');
  }

  function getWPodTemplateFile(item) {
    if (!item) return 'w.Pod\u6563\u8d27\u6a21\u677f.html';
    return item.deliveryType === '\u6574\u67dc'
      ? 'w.pod\u6574\u67dc\u6a21\u677f.html'
      : 'w.Pod\u6563\u8d27\u6a21\u677f.html';
  }

  /**
   * \u5f85\u9001\u4ed3 / \u5df2\u9001\u4ed3 \u65f6\u8fd4\u56de W.BOL \u6a21\u677f\u9875 URL
   * pathPrefix: '/fg/'（绝对）、'../fg/'（相对上级）、'' 等同 '/fg/'（模板固定在此目录）
   */
  function getWPodDocumentUrl(item, pathPrefix) {
    if (!item || !item.deliveryCode) return '';
    var prefix = pathPrefix == null ? '' : pathPrefix;
    if (prefix === '') prefix = '/fg/';
    if (item.status !== '\u5f85\u9001\u4ed3' && item.status !== '\u5df2\u9001\u4ed3') {
      return item.wPodUrl ? resolvePublicUrl(item.wPodUrl) : '';
    }
    var rel = prefix + getWPodTemplateFile(item) + '?code=' + encodeURIComponent(item.deliveryCode);
    if (prefix.indexOf('../') === 0 || prefix.indexOf('./') === 0) return rel;
    return resolvePublicUrl(rel.charAt(0) === '/' ? rel : '/' + rel);
  }

  function getOfficialOperator(item) {
    return (item && item.customerCode) || getCurrentCustomerCode() || '\u5b98\u7f51\u7528\u6237';
  }

  function clearOfficialNegotiationFields(updated) {
    updated.confirmedWarehouse = '';
    updated.negotiatedSlotStart = '';
    updated.negotiatedSlotEnd = '';
    updated.auditRemark = '';
    updated.rejectRemark = '';
    updated.warehouseConfirmedInboundTime = '';
    updated.warehouseConfirmedAddress = '';
    updated.actualDeliveryTime = '';
    updated.receivedPallets = '';
    updated.receivedCartons = '';
    updated.arrivalPhotos = [];
    updated.wPodUrl = '';
  }

  /**
   * 读取预约单到仓拍照（模拟数据字段 arrivalPhotos）
   * @param {object|Array} itemOrPhotos 预约单或照片数组
   * @returns {Array<{id?,url,name?,shotAt?,uploadedBy?}|string>}
   */
  function getArrivalPhotos(itemOrPhotos) {
    var raw = Array.isArray(itemOrPhotos)
      ? itemOrPhotos
      : (itemOrPhotos && itemOrPhotos.arrivalPhotos);
    if (!Array.isArray(raw)) return [];
    return raw.filter(function (p) {
      if (!p) return false;
      return typeof p === 'string' ? !!p.trim() : !!p.url;
    });
  }

  /**
   * 到仓拍照缩略图 HTML（客户/仓储/海外仓详情页共用）
   * @param {object|Array} itemOrPhotos
   * @param {object} options listClass, thumbClass, emptyText
   */
  function buildArrivalPhotosHtml(itemOrPhotos, options) {
    var opts = options || {};
    var listClass = opts.listClass || 'detail-arrival-photo-list';
    var thumbClass = opts.thumbClass || 'detail-arrival-photo-thumb';
    var emptyText = opts.emptyText != null ? opts.emptyText : '-';
    var photos = getArrivalPhotos(itemOrPhotos);
    if (!photos.length) return escapeHtmlLite(emptyText);
    return '<ul class="' + escapeHtmlLite(listClass) + '">' + photos.map(function (p, i) {
      var url = typeof p === 'string' ? p : p.url;
      var title = (p && p.name) ? escapeHtmlLite(p.name) : ('\u5230\u4ed3\u7167\u7247' + (i + 1));
      var safeUrl = escapeHtmlLite(url);
      return '<li><a class="' + escapeHtmlLite(thumbClass) + '" href="' + safeUrl +
        '" target="_blank" rel="noopener" title="' + title + '">' +
        '<img src="' + safeUrl + '" alt="' + title + '"></a></li>';
    }).join('') + '</ul>';
  }

  /** 从 MOCK_ARRIVAL_PHOTO_SAMPLES 克隆照片（需已加载 deliveryAppointment.js） */
  function cloneMockArrivalPhotosFromSampleIds(ids) {
    if (typeof mockArrivalPhotosFromSampleIds === 'function') {
      return mockArrivalPhotosFromSampleIds(ids);
    }
    return [];
  }

  /** \u5b98\u7f51\u64a4\u56de\uff1a\u53d6\u6d88\u9884\u7ea6 / \u91cd\u65b0\u9884\u7ea6 \u2192 \u5f85\u9884\u7ea6 */
  function officialWithdrawToPendingBook(item, withdrawKind) {
    if (!item) return null;
    var updated = JSON.parse(JSON.stringify(item));
    updated.status = '\u5f85\u9884\u7ea6';
    clearOfficialNegotiationFields(updated);
    pushOperationLogByKind(updated, getOfficialOperator(item),
      normalizeWithdrawLogKind(withdrawKind));
    return updated;
  }

  /** \u5b98\u7f51\u63d0\u4ea4\u9884\u7ea6\uff1a\u5f85\u9884\u7ea6 \u2192 \u4ed3\u5e93\u5f85\u5ba1\u6838 */
  function officialSubmitToWarehousePending(item) {
    if (!item) return null;
    var updated = JSON.parse(JSON.stringify(item));
    if (updated.status !== '\u5f85\u9884\u7ea6' && updated.status !== '\u5f85\u63d0\u4ea4') return null;
    updated.status = '\u4ed3\u5e93\u5f85\u5ba1\u6838';
    if (!updated.submitTime) updated.submitTime = formatNow();
    if (!updated.bookingLink && updated.deliveryCode) {
      updated.bookingLink = '/fg/index.html?code=' + encodeURIComponent(updated.deliveryCode);
    }
    pushOperationLogByKind(updated, getOfficialOperator(item), 'official_submit');
    return updated;
  }

  /** 官网客户确认接受：客户待确认 → 待送仓 */
  function officialAcceptCustomerConfirm(item) {
    if (!item || item.status !== '\u5ba2\u6237\u5f85\u786e\u8ba4') return null;
    var updated = JSON.parse(JSON.stringify(item));
    var addr = String(updated.warehouseConfirmedAddress || '').trim();
    var time = String(updated.warehouseConfirmedInboundTime || '').trim();
    if (!addr && !time) return null;
    updated.status = '\u5f85\u9001\u4ed3';
    if (updated.confirmedWarehouse) updated.warehouse = updated.confirmedWarehouse;
    pushOperationLogByKind(updated, getOfficialOperator(item), 'customer_accept_slot', { slot: time });
    return updated;
  }

  /**
   * 官网客户重新预约：客户待确认 → 待预约
   * 清空仓库确认信息，保留 expectedInboundTime / remark 让货代基于上轮再改
   * @param {object} item
   * @param {string} [reason] 不接受的原因（选填，可作为日志补充）
   */
  function customerRebookFromCustomerPending(item, reason) {
    if (!item || item.status !== '\u5ba2\u6237\u5f85\u786e\u8ba4') return null;
    var updated = JSON.parse(JSON.stringify(item));
    var note = String(reason || '').trim();
    updated.status = '\u5f85\u9884\u7ea6';
    updated.warehouseConfirmedInboundTime = '';
    updated.warehouseConfirmedAddress = '';
    updated.auditRemark = '';
    updated.rejectRemark = '';
    updated.confirmedWarehouse = '';
    pushOperationLogByKind(updated, getOfficialOperator(item), 'customer_rebook', { reason: note });
    return updated;
  }

  /**
   * 官网客户取消（客户待确认状态）：客户待确认 → 待预约
   * 业务规则：预约失败仅由海外仓拒收产生；客户主动取消视为撤回到待预约，
   * 清空仓库确认信息但保留期望日期/备注供货代再次提交。
   * @param {object} item
   * @param {string} [reason] 取消原因（选填，演示阶段简化为可空）
   */
  function customerCancelFromCustomerPending(item, reason) {
    if (!item || item.status !== '\u5ba2\u6237\u5f85\u786e\u8ba4') return null;
    var note = String(reason || '').trim();
    var updated = JSON.parse(JSON.stringify(item));
    updated.status = '\u5f85\u9884\u7ea6';
    updated.warehouseConfirmedInboundTime = '';
    updated.warehouseConfirmedAddress = '';
    updated.auditRemark = '';
    updated.rejectRemark = '';
    updated.confirmedWarehouse = '';
    pushOperationLogByKind(updated, getOfficialOperator(item), 'customer_cancel', { reason: note });
    return updated;
  }

  function persistOfficialAppointment(item, done) {
    return addOrUpdateInMockAndPersist(item, null, done);
  }

  /**
   * 跨标签页 / 返回页面时刷新（sessionStorage 变更后同步 UI）
   * @param {function} onSync 回调
   */
  function bindAppointmentStorageSync(onSync) {
    if (typeof window === 'undefined' || typeof onSync !== 'function') return;
    window.addEventListener('storage', function (e) {
      if (e.key === STORAGE_KEY) onSync();
    });
    window.addEventListener('pageshow', function () {
      onSync();
    });
  }

  function normScanCode(code) {
    return String(code == null ? '' : code).trim();
  }

  /**
   * PDA 收货扫描：按预约码 / 预约单号 / 入库单号查找预约单
   */
  function findReceivingByScanCode(code) {
    var raw = normScanCode(code);
    if (!raw) return null;
    var upper = raw.toUpperCase();
    var list = getReceivingAppointmentList();
    var i;
    var j;
    var item;
    var orders;
    var ono;

    for (i = 0; i < list.length; i++) {
      item = list[i];
      if (item.deliveryCode && String(item.deliveryCode).trim().toUpperCase() === upper) {
        return JSON.parse(JSON.stringify(item));
      }
    }
    for (i = 0; i < list.length; i++) {
      item = list[i];
      if (item.appointmentNo && String(item.appointmentNo).trim() === raw) {
        return JSON.parse(JSON.stringify(item));
      }
    }
    for (i = 0; i < list.length; i++) {
      item = list[i];
      if (item.appointmentNo && String(item.appointmentNo).indexOf(raw) !== -1) {
        return JSON.parse(JSON.stringify(item));
      }
    }
    for (i = 0; i < list.length; i++) {
      item = list[i];
      orders = item.inboundOrders || [];
      for (j = 0; j < orders.length; j++) {
        ono = orders[j].orderNo;
        if (ono && String(ono).trim() === raw) {
          return JSON.parse(JSON.stringify(item));
        }
      }
    }
    for (i = 0; i < list.length; i++) {
      item = list[i];
      orders = item.inboundOrders || [];
      for (j = 0; j < orders.length; j++) {
        ono = orders[j].orderNo;
        if (ono && String(ono).indexOf(raw) !== -1) {
          return JSON.parse(JSON.stringify(item));
        }
      }
    }
    return null;
  }

  function validatePdaReceivingSubmit(item, photos, registerPayload) {
    if (!item) return { ok: false, msg: '\u8bf7\u5148\u626b\u63cf\u5e76\u67e5\u8be2\u9884\u7ea6\u5355' };
    if (item.status === '\u5df2\u9001\u4ed3') {
      return { ok: false, msg: '\u8be5\u9884\u7ea6\u5355\u5df2\u5b8c\u6210\u6536\u8d27\uff0c\u4e0d\u53ef\u91cd\u590d\u63d0\u4ea4' };
    }
    if (item.status === '\u4ed3\u5e93\u5f85\u5ba1\u6838') {
      return { ok: false, msg: '\u9884\u7ea6\u5c1a\u672a\u5ba1\u6838\u901a\u8fc7\uff0c\u4e0d\u53ef\u6536\u8d27' };
    }
    if (item.status === '\u5ba2\u6237\u5f85\u786e\u8ba4') {
      return { ok: false, msg: '\u5ba2\u6237\u5c1a\u672a\u786e\u8ba4\u4ed3\u5e93\u5b89\u6392\uff0c\u4e0d\u53ef\u6536\u8d27' };
    }
    if (item.status !== '\u5f85\u9001\u4ed3') {
      return {
        ok: false,
        msg: '\u5f53\u524d\u72b6\u6001\u4e3a\u300c' + (item.status || '-') + '\u300d\uff0c\u4e0d\u53ef\u6536\u8d27'
      };
    }
    var hasPhotos = photos && photos.length > 0;
    if (!hasPhotos) {
      return { ok: false, msg: '\u8bf7\u4e0a\u4f20\u9001\u4ed3\u6587\u4ef6' };
    }
    return { ok: true };
  }

  /**
   * PDA 收货扫描：校验单号是否可进入收货确认页（仅查状态，不要求拍照）
   */
  function validatePdaReceivingLookup(item) {
    if (!item) return { ok: false, msg: '\u672a\u627e\u5230\u5bf9\u5e94\u9884\u7ea6\u5355\uff0c\u8bf7\u6838\u5bf9\u5355\u53f7' };
    if (item.status === '\u5df2\u9001\u4ed3') {
      return { ok: false, msg: '\u8be5\u9884\u7ea6\u5355\u5df2\u5b8c\u6210\u6536\u8d27\uff0c\u4e0d\u53ef\u91cd\u590d\u63d0\u4ea4' };
    }
    if (item.status === '\u4ed3\u5e93\u5f85\u5ba1\u6838') {
      return { ok: false, msg: '\u9884\u7ea6\u5c1a\u672a\u5ba1\u6838\u901a\u8fc7\uff0c\u4e0d\u53ef\u6536\u8d27' };
    }
    if (item.status === '\u5ba2\u6237\u5f85\u786e\u8ba4') {
      return { ok: false, msg: '\u5ba2\u6237\u5c1a\u672a\u786e\u8ba4\u4ed3\u5e93\u5b89\u6392\uff0c\u4e0d\u53ef\u6536\u8d27' };
    }
    if (item.status !== '\u5f85\u9001\u4ed3') {
      return {
        ok: false,
        msg: '\u5f53\u524d\u72b6\u6001\u4e3a\u300c' + (item.status || '-') + '\u300d\uff0c\u4e0d\u53ef\u6536\u8d27'
      };
    }
    return { ok: true };
  }

  function applyInboundLineReceipts(updated, lineReceipts) {
    if (!lineReceipts || !lineReceipts.length) return;
    var orders = updated.inboundOrders || [];
    lineReceipts.forEach(function (line) {
      var ono = String(line.orderNo || '').trim();
      if (!ono) return;
      for (var i = 0; i < orders.length; i++) {
        if (String(orders[i].orderNo || '').trim() === ono) {
          orders[i].receivedCartons = line.receivedCartons;
          break;
        }
      }
    });
    updated.inboundOrders = orders;
  }

  /**
   * PDA 收货扫描提交：待送仓 → 已送仓
   * @param {object} item 预约单
   * @param {Array} photoPayloads 图片 data URL 或 { url, name, shotAt, uploadedBy }
   * @param {string} [operator] 操作人
   * @param {{receivedPallets?: number|string, receivedCartons?: number|string, registerMode?: string, inboundLineReceipts?: Array}} [registerPayload] 收货登记
   * @param {function} [done] 回调
   */
  var WH_FORCE_SIGNOFF_STATUSES = ['\u5f85\u9001\u4ed3', '\u5ba2\u6237\u5f85\u786e\u8ba4', '\u5df2\u8d85\u65f6'];

  function isPositiveIntValue(value) {
    if (value === '' || value === null || value === undefined) return false;
    var n = Number(value);
    return Number.isInteger(n) && n > 0;
  }

  function normalizeActualDeliveryTimeInput(val) {
    var s = String(val || '').trim();
    if (!s) return formatNow();
    if (s.indexOf('T') >= 0) {
      var parts = s.split('T');
      var date = parts[0];
      var time = parts[1] || '00:00';
      if (time.length === 5) time += ':00';
      return date + ' ' + time;
    }
    return s;
  }

  function toDatetimeLocalInputValue(isoOrStr) {
    var s = String(isoOrStr || formatNow()).trim();
    var m = s.match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2})/);
    if (m) return m[1] + 'T' + m[2];
    return '';
  }

  function isWhForceSignOffEligible(item) {
    return !!(item && WH_FORCE_SIGNOFF_STATUSES.indexOf(item.status) >= 0);
  }

  function mapSignOffPhotoPayloads(photoPayloads, operator, shotAt) {
    var op = operator || '\u6d77\u5916\u4ed3';
    var at = shotAt || formatNow();
    return (photoPayloads || []).map(function (p, idx) {
      if (typeof p === 'string') {
        return {
          url: p,
          name: '\u7b7e\u6536\u6587\u4ef6' + (idx + 1),
          shotAt: at,
          uploadedBy: op
        };
      }
      return {
        url: p.url,
        name: p.name || ('\u7b7e\u6536\u6587\u4ef6' + (idx + 1)),
        shotAt: p.shotAt || at,
        uploadedBy: p.uploadedBy || op
      };
    });
  }

  function applyReceivingDeliverySignOff(item, opts) {
    if (!item || !opts) return null;
    var updated = JSON.parse(JSON.stringify(item));
    var at = normalizeActualDeliveryTimeInput(opts.actualDeliveryTime);
    var op = opts.operator || LOG_OPERATOR_WAREHOUSE;
    var isContentUpdate = opts.signOffKind === 'us_web_update' || item.status === '\u5df2\u9001\u4ed3';
    updated.status = '\u5df2\u9001\u4ed3';
    updated.actualDeliveryTime = at;
    if (opts.receivedCartons !== undefined && opts.receivedCartons !== '') {
      updated.receivedCartons = opts.receivedCartons;
    }
    if (opts.receivedPallets !== undefined && opts.receivedPallets !== '') {
      updated.receivedPallets = opts.receivedPallets;
    }
    var photoCount = (opts.photoPayloads && opts.photoPayloads.length) || 0;
    if (photoCount) {
      var mapped = mapSignOffPhotoPayloads(opts.photoPayloads, op, at);
      updated.arrivalPhotos = opts.appendPhotos
        ? (updated.arrivalPhotos || []).concat(mapped)
        : mapped;
    }
    if (opts.logAction) {
      pushOperationLog(updated, op, opts.logAction, { logKind: opts.signOffKind || '' });
      return updated;
    }
    var signParams = {
      at: at,
      cartons: updated.receivedCartons,
      pallets: updated.receivedPallets,
      photoCount: photoCount,
      appendPhotos: !!opts.appendPhotos,
      remark: opts.remark ? String(opts.remark).trim() : ''
    };
    if (opts.signOffKind === 'wh_force') {
      pushOperationLogByKind(updated, LOG_OPERATOR_PLATFORM, 'wh_force_signoff', signParams);
    } else if (opts.signOffKind === 'us_web_update' || isContentUpdate) {
      pushOperationLogByKind(updated, op, 'us_web_signoff_update', signParams,
        { audience: LOG_AUDIENCE_WAREHOUSE });
    } else {
      pushOperationLogByKind(updated, op, 'us_web_signoff', signParams);
    }
    return updated;
  }

  function validateUsReceivingSignOff(item, opts) {
    opts = opts || {};
    if (!item) return { ok: false, msg: '\u9884\u7ea6\u5355\u4e0d\u5b58\u5728' };
    if (!isEligibleForUsSignOff(item)) {
      if (item.status === '\u4ed3\u5e93\u5f85\u5ba1\u6838') {
        return { ok: false, msg: '\u9884\u7ea6\u5c1a\u672a\u5ba1\u6838\u901a\u8fc7\uff0c\u4e0d\u53ef\u6536\u8d27' };
      }
      if (item.status === '\u5ba2\u6237\u5f85\u786e\u8ba4') {
        return { ok: false, msg: '\u5ba2\u6237\u5c1a\u672a\u786e\u8ba4\u4ed3\u5e93\u5b89\u6392\uff0c\u4e0d\u53ef\u6536\u8d27' };
      }
      return {
        ok: false,
        msg: '\u5f53\u524d\u72b6\u6001\u4e3a\u300c' + (item.status || '-') + '\u300d\uff0c\u4e0d\u53ef\u7b7e\u6536\u6216\u66f4\u65b0\u7b7e\u6536'
      };
    }
    if (!normalizeActualDeliveryTimeInput(opts.actualDeliveryTime)) {
      return { ok: false, msg: '\u8bf7\u586b\u5199\u5b9e\u9645\u5230\u4ed3\u65f6\u95f4' };
    }
    var cartons = opts.receivedCartons;
    var pallets = opts.receivedPallets;
    if (cartons !== '' && cartons !== undefined && cartons !== null && !isPositiveIntValue(cartons)) {
      return { ok: false, msg: '\u6536\u8d27\u603b\u7bb1\u6570\u9700\u4e3a\u6b63\u6574\u6570' };
    }
    if (pallets !== '' && pallets !== undefined && pallets !== null && !isPositiveIntValue(pallets)) {
      return { ok: false, msg: '\u6536\u8d27\u603b\u6258\u6570\u9700\u4e3a\u6b63\u6574\u6570' };
    }
    return { ok: true };
  }

  function submitWhForceSignOff(items, opts, done) {
    var list = (items || []).filter(isWhForceSignOffEligible);
    if (!list.length) {
      if (done) done(new Error('no eligible'), []);
      return;
    }
    var at = normalizeActualDeliveryTimeInput(opts && opts.actualDeliveryTime);
    var remark = opts && opts.remark ? String(opts.remark).trim() : '';
    var pending = list.length;
    var results = [];
    var firstErr = null;
    list.forEach(function (item) {
      var updated = applyReceivingDeliverySignOff(item, {
        actualDeliveryTime: at,
        operator: LOG_OPERATOR_PLATFORM,
        signOffKind: 'wh_force',
        remark: remark
      });
      addOrUpdateInMockAndPersist(updated, null, function (err, record) {
        if (err && !firstErr) firstErr = err;
        if (record) results.push(record);
        pending--;
        if (pending === 0 && done) done(firstErr, results);
      });
    });
  }

  function submitUsReceivingSignOff(item, opts, done) {
    var validation = validateUsReceivingSignOff(item, opts || {});
    if (!validation.ok) {
      if (done) done(new Error(validation.msg), null);
      return null;
    }
    var o = opts || {};
    var isUpdate = isUsSignOffContentUpdate(item);
    var updated = applyReceivingDeliverySignOff(item, {
      actualDeliveryTime: o.actualDeliveryTime,
      receivedCartons: o.receivedCartons !== '' && o.receivedCartons != null ? Number(o.receivedCartons) : '',
      receivedPallets: o.receivedPallets !== '' && o.receivedPallets != null ? Number(o.receivedPallets) : '',
      photoPayloads: o.photoPayloads,
      appendPhotos: isUpdate,
      operator: o.operator || '\u6d77\u5916\u4ed3\u7b7e\u6536',
      signOffKind: isUpdate ? 'us_web_update' : 'us_web',
      remark: o.remark ? String(o.remark).trim() : ''
    });
    return addOrUpdateInMockAndPersist(updated, null, done);
  }

  function submitUsReceivingSignOffBatch(entries, done) {
    var list = (entries || []).filter(function (e) { return e && e.item; });
    if (!list.length) {
      if (done) done(new Error('no entries'), []);
      return;
    }
    var pending = list.length;
    var results = [];
    var firstErr = null;
    list.forEach(function (entry) {
      submitUsReceivingSignOff(entry.item, entry.opts || {}, function (err, updated) {
        if (err && !firstErr) firstErr = err;
        if (updated) results.push(updated);
        pending--;
        if (pending === 0 && done) done(firstErr, results);
      });
    });
  }

  function submitPdaReceivingScan(item, photoPayloads, operator, registerPayload, done) {
    var op = LOG_OPERATOR_WAREHOUSE;
    var cb = done;
    var register = registerPayload || {};
    if (typeof operator === 'function') {
      cb = operator;
    } else if (typeof operator === 'string' && operator) {
      op = operator;
    }
    if (typeof registerPayload === 'function') {
      cb = registerPayload;
      register = {};
    }
    var validation = validatePdaReceivingSubmit(item, photoPayloads, register);
    if (!validation.ok) {
      if (cb) cb(new Error(validation.msg), null);
      return null;
    }
    var updated = JSON.parse(JSON.stringify(item));
    var now = formatNow();
    updated.status = '\u5df2\u9001\u4ed3';
    updated.actualDeliveryTime = now;
    updated.receivedPallets = register.receivedPallets !== undefined ? register.receivedPallets : '';
    updated.receivedCartons = register.receivedCartons !== undefined ? register.receivedCartons : '';
    if (register.registerMode === 'detail' && register.inboundLineReceipts) {
      applyInboundLineReceipts(updated, register.inboundLineReceipts);
    }
    updated.arrivalPhotos = (photoPayloads || []).map(function (p, idx) {
      if (typeof p === 'string') {
        return {
          url: p,
          name: '\u5230\u4ed3\u7167\u7247' + (idx + 1),
          shotAt: now,
          uploadedBy: op
        };
      }
      return {
        url: p.url,
        name: p.name || ('\u5230\u4ed3\u7167\u7247' + (idx + 1)),
        shotAt: p.shotAt || now,
        uploadedBy: p.uploadedBy || op
      };
    });
    pushOperationLogByKind(updated, op, 'pda_signoff', {
      at: now,
      cartons: updated.receivedCartons,
      pallets: updated.receivedPallets,
      pdaDetailMode: register.registerMode === 'detail'
    });
    return addOrUpdateInMockAndPersist(updated, null, cb);
  }

  function parseAppointmentDateOnly(str) {
    if (!str) return null;
    var m = String(str).trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!m) return null;
    var d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    return isNaN(d.getTime()) ? null : d;
  }

  function formatDateOnlyValue(d) {
    if (!d) return '';
    var y = d.getFullYear();
    var m = d.getMonth() + 1;
    var day = d.getDate();
    return y + '-' + (m < 10 ? '0' : '') + m + '-' + (day < 10 ? '0' : '') + day;
  }

  function getLocalWeekRange(refDate) {
    var base = refDate instanceof Date && !isNaN(refDate.getTime()) ? new Date(refDate) : new Date();
    var day = base.getDay();
    var diffToMon = day === 0 ? -6 : 1 - day;
    var start = new Date(base.getFullYear(), base.getMonth(), base.getDate());
    start.setDate(start.getDate() + diffToMon);
    start.setHours(0, 0, 0, 0);
    var end = new Date(start);
    end.setDate(start.getDate() + 6);
    end.setHours(23, 59, 59, 999);
    return { start: start, end: end };
  }

  function getAppointmentDeliveryDate(item) {
    if (!item) return null;
    var confirmed = parseAppointmentDateOnly(item.warehouseConfirmedInboundTime);
    if (confirmed) return confirmed;
    var dates = getExpectedInboundDates(item);
    if (dates.length) {
      var parts = dates[0].split('-');
      return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    }
    return parseAppointmentDateOnly(item.expectedInboundTime);
  }

  function isPendingDeliveryThisWeek(item, refDate) {
    if (!item || item.status !== '\u5f85\u9001\u4ed3') return false;
    var d = getAppointmentDeliveryDate(item);
    if (!d) return false;
    var range = getLocalWeekRange(refDate);
    return d >= range.start && d <= range.end;
  }

  function getReceivingReminderStats(refDate) {
    var list = getReceivingAppointmentList();
    var range = getLocalWeekRange(refDate);
    var stats = {
      whPending: 0,
      timeout: 0,
      weekPendingDelivery: 0,
      weekRangeLabel: formatDateOnlyValue(range.start) + ' ~ ' + formatDateOnlyValue(range.end)
    };
    list.forEach(function (item) {
      if (item.status === '\u4ed3\u5e93\u5f85\u5ba1\u6838') stats.whPending++;
      if (item.status === '\u5df2\u8d85\u65f6') stats.timeout++;
      if (isPendingDeliveryThisWeek(item, refDate)) stats.weekPendingDelivery++;
    });
    return stats;
  }

  return {
    STORAGE_KEY: STORAGE_KEY,
    bindAppointmentStorageSync: bindAppointmentStorageSync,
    getCurrentCustomerCode: getCurrentCustomerCode,
    getAppointmentList: getAppointmentList,
    saveAppointmentList: saveAppointmentList,
    getById: getById,
    getByDeliveryCode: getByDeliveryCode,
    getBaseList: getBaseList,
    MOCK_PERSIST_API: MOCK_PERSIST_API,
    persistListToSource: persistListToSource,
    fetchAndApplyMockSource: fetchAndApplyMockSource,
    persistSuccessMessage: persistSuccessMessage,
    addOrUpdateInMock: addOrUpdateInMock,
    addOrUpdateInMockAndPersist: addOrUpdateInMockAndPersist,
    submitAppointmentRecord: submitAppointmentRecord,
    submitSuccessMessage: submitSuccessMessage,
    updateAppointment: updateAppointment,
    getEligibleInOrders: getEligibleInOrders,
    snapshotInOrder: snapshotInOrder,
    calcTotals: calcTotals,
    validateDeliveryCartonsConsistency: validateDeliveryCartonsConsistency,
    getOperationsByStatus: getOperationsByStatus,
    getOpLabel: getOpLabel,
    getStatusClass: getStatusClass,
    applyStatusAction: applyStatusAction,
    formatNow: formatNow,
    genAppointmentNo: genAppointmentNo,
    genDeliveryCode: genDeliveryCode,
    genId: genId,
    formatCell: formatCell,
    formatNumber: formatNumber,
    RECEIVING_APPT_STATUSES: RECEIVING_APPT_STATUSES,
    getReceivingAppointmentList: getReceivingAppointmentList,
    getBookerParty: getBookerParty,
    getUsTimezoneLabel: getUsTimezoneLabel,
    getWarehouseLocalTimeLabel: getWarehouseLocalTimeLabel,
    getFgWarehouseLocalTimeLabel: getFgWarehouseLocalTimeLabel,
    formatFgEmptyDisplay: formatFgEmptyDisplay,
    formatFgWarehouseTime: formatFgWarehouseTime,
    localTimeFieldLabel: localTimeFieldLabel,
    formatUsWarehouseTime: formatUsWarehouseTime,
    MAX_EXPECTED_INBOUND_DATES: MAX_EXPECTED_INBOUND_DATES,
    getExpectedInboundDates: getExpectedInboundDates,
    applyExpectedInboundDates: applyExpectedInboundDates,
    formatExpectedInboundDatesDisplay: formatExpectedInboundDatesDisplay,
    formatFgContactPhone: formatFgContactPhone,
    formatContactEmailsDisplay: formatContactEmailsDisplay,
    shouldShowFgWarehouseConfirmFields: shouldShowFgWarehouseConfirmFields,
    shouldShowFgWPodDownload: shouldShowFgWPodDownload,
    shouldShowFgActualDeliveryTime: shouldShowFgActualDeliveryTime,
    getFgEmailWarehouseConfirmFieldEntries: getFgEmailWarehouseConfirmFieldEntries,
    getFgEmailWPodFieldEntries: getFgEmailWPodFieldEntries,
    getFgEmailActualDeliveryFieldEntries: getFgEmailActualDeliveryFieldEntries,
    pickExpectedDatePart: pickExpectedDatePart,
    calcTotalCartons: calcTotalCartons,
    formatEstimatedCartons: formatEstimatedCartons,
    calcTotalPalletsDisplay: calcTotalPalletsDisplay,
    isPalletized: isPalletized,
    formatPalletized: formatPalletized,
    formatTotalPallets: formatTotalPallets,
    formatTotalVolume: formatTotalVolume,
    formatTotalWeight: formatTotalWeight,
    formatInboundOrderSummary: formatInboundOrderSummary,
    buildInboundDetailListCell: buildInboundDetailListCell,
    normSearchText: normSearchText,
    matchTextFuzzy: matchTextFuzzy,
    matchInboundDetailSearch: matchInboundDetailSearch,
    filterCustomerAppointmentList: filterCustomerAppointmentList,
    filterWhAppointmentList: filterWhAppointmentList,
    enrichInboundRow: enrichInboundRow,
    buildInboundDetailRows: buildInboundDetailRows,
    resolveHandleMethod: resolveHandleMethod,
    getReceivingById: getReceivingById,
    isSameWarehouse: isSameWarehouse,
    normalizeWarehouseName: normalizeWarehouseName,
    findWarehouseAddressBook: findWarehouseAddressBook,
    renderWarehouseAddressTip: renderWarehouseAddressTip,
    getWarehouseContactEmailFooter: getWarehouseContactEmailFooter,
    getUsWarehouseOptions: getUsWarehouseOptions,
    findUsWarehouseById: findUsWarehouseById,
    findUsWarehouseByName: findUsWarehouseByName,
    applyReceivingAudit: applyReceivingAudit,
    submitReceivingAudit: submitReceivingAudit,
    applyReceivingAuditUpdate: applyReceivingAuditUpdate,
    submitReceivingAuditUpdate: submitReceivingAuditUpdate,
    auditReceivingAppointment: auditReceivingAppointment,
    resolvePublicUrl: resolvePublicUrl,
    getPublicBaseUrl: getPublicBaseUrl,
    defaultBookingLink: defaultBookingLink,
    isDeliveryCodePublished: isDeliveryCodePublished,
    formatDeliveryCodeCell: formatDeliveryCodeCell,
    buildBookingLinkHtml: buildBookingLinkHtml,
    buildBookingLinkListCell: buildBookingLinkListCell,
    getWPodTemplateFile: getWPodTemplateFile,
    getWPodDocumentUrl: getWPodDocumentUrl,
    getArrivalPhotos: getArrivalPhotos,
    buildArrivalPhotosHtml: buildArrivalPhotosHtml,
    cloneMockArrivalPhotosFromSampleIds: cloneMockArrivalPhotosFromSampleIds,
    officialWithdrawToPendingBook: officialWithdrawToPendingBook,
    officialSubmitToWarehousePending: officialSubmitToWarehousePending,
    officialAcceptCustomerConfirm: officialAcceptCustomerConfirm,
    customerRebookFromCustomerPending: customerRebookFromCustomerPending,
    customerCancelFromCustomerPending: customerCancelFromCustomerPending,
    formatWarehouseSlot: formatWarehouseSlot,
    parseWarehouseSlot: parseWarehouseSlot,
    nextAuditRound: nextAuditRound,
    persistOfficialAppointment: persistOfficialAppointment,
    pushOperationLog: pushOperationLog,
    getOperationLogs: getOperationLogs,
    buildOperationLogListHtml: buildOperationLogListHtml,
    findReceivingByScanCode: findReceivingByScanCode,
    validatePdaReceivingLookup: validatePdaReceivingLookup,
    validatePdaReceivingSubmit: validatePdaReceivingSubmit,
    submitPdaReceivingScan: submitPdaReceivingScan,
    isWhForceSignOffEligible: isWhForceSignOffEligible,
    normalizeActualDeliveryTimeInput: normalizeActualDeliveryTimeInput,
    toDatetimeLocalInputValue: toDatetimeLocalInputValue,
    submitWhForceSignOff: submitWhForceSignOff,
    validateUsReceivingSignOff: validateUsReceivingSignOff,
    submitUsReceivingSignOff: submitUsReceivingSignOff,
    submitUsReceivingSignOffBatch: submitUsReceivingSignOffBatch,
    APPOINTMENT_NOTIFY_EMAIL: APPOINTMENT_NOTIFY_EMAIL,
    sendAppointmentStatusChangeEmail: sendAppointmentStatusChangeEmail,
    getReceivingReminderStats: getReceivingReminderStats,
    isPendingDeliveryThisWeek: isPendingDeliveryThisWeek,
    getLocalWeekRange: getLocalWeekRange,
    isEligibleForEmptyContainerReturn: isEligibleForEmptyContainerReturn,
    isEligibleForUsSignOff: isEligibleForUsSignOff,
    isUsSignOffContentUpdate: isUsSignOffContentUpdate,
    isEligibleForRecvListSelect: isEligibleForRecvListSelect,
    getContactNotifyEmails: getContactNotifyEmails,
    buildEmptyContainerReturnEmailPayload: buildEmptyContainerReturnEmailPayload,
    submitEmptyContainerReturnNotify: submitEmptyContainerReturnNotify
  };
})();
