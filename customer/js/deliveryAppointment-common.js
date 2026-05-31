/**
 * 预约送仓 - 公共数据与状态机（客户前台）
 */
var DeliveryAppointmentCommon = (function () {
  var STORAGE_KEY = 'pm_demo_delivery_appointments';
  var MOCK_PERSIST_API = '/api/mock/delivery-appointment';
  var APPOINTMENT_NOTIFY_EMAIL = 'zhengjianfengb@sailvan.com';
  var APPOINTMENT_NOTIFY_API = '/api/mock/appointment-notify-email';
  var NOTIFY_MAIL_STORAGE_KEY = 'pm_demo_appointment_notify_mail';
  var APPOINTMENT_MAIL_BRAND_LOGO_URL = '';
  var APPOINTMENT_MAIL_BRAND_WATERMARK_URL = '';

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

  function getAppointmentNotifyRecipients(record, recipientRole) {
    return APPOINTMENT_NOTIFY_EMAIL;
  }

  function compactLines(lines) {
    return lines.filter(function (line) {
      return line !== null && line !== undefined && line !== false;
    });
  }

  function commonAppointmentFields(record, oldItem) {
    var wh = record.warehouse || record.confirmedWarehouse || '-';
    var fields = [
      { label: '\u9884\u7ea6\u5355\u53f7', value: record.appointmentNo || '-' },
      { label: '\u9001\u4ed3\u7801', value: record.deliveryCode || '-' },
      { label: '\u5ba2\u6237\u7f16\u53f7', value: record.customerCode || '-' },
      { label: '\u9884\u7ea6\u4ed3\u5e93', value: wh },
      { label: '\u539f\u72b6\u6001', value: (oldItem && oldItem.status) || '-' },
      { label: '\u65b0\u72b6\u6001', value: record.status || '-' }
    ];
    return fields;
  }

  function appendField(fields, label, value) {
    fields.push({ label: label, value: value == null || value === '' ? '-' : value });
  }

  function getAppointmentActionUrl(record) {
    var link = defaultBookingLink(record);
    if (!link) return '';
    if (/^https?:\/\//i.test(link)) return link;
    if (typeof window !== 'undefined' && window.location && window.location.origin) {
      return window.location.origin + (link.charAt(0) === '/' ? link : '/' + link);
    }
    return link;
  }

  function getAppointmentConfirmUrl(record) {
    if (!record || !record.deliveryCode) return getAppointmentActionUrl(record);
    var link = '/fg/reservationDetail.html?code=' + encodeURIComponent(record.deliveryCode);
    if (typeof window !== 'undefined' && window.location && window.location.origin) {
      return window.location.origin + link;
    }
    return link;
  }

  function getAppointmentWPodUrl(record) {
    var link = getWPodDocumentUrl(record, '/fg/');
    if (!link) return '';
    if (/^https?:\/\//i.test(link)) return link;
    if (typeof window !== 'undefined' && window.location && window.location.origin) {
      return window.location.origin + (link.charAt(0) === '/' ? link : '/' + link);
    }
    return link;
  }

  function getWarehouseAuditUrl(record) {
    if (!record || !record.id) return '';
    var link = '/us/receiving-appointment-detail.html?id=' + encodeURIComponent(record.id);
    if (typeof window !== 'undefined' && window.location && window.location.origin) {
      return window.location.origin + link;
    }
    return link;
  }

  function getMockWarehouseAddress(record) {
    var wh = (record && (record.warehouse || record.confirmedWarehouse)) || '';
    if (wh.indexOf('\u7f8e\u897f') >= 0) return '18501 Arenth Ave, City of Industry, CA 91748';
    if (wh.indexOf('\u7f8e\u4e1c') >= 0) return '1000 High Street, Perth Amboy, NJ 08861';
    if (wh.indexOf('\u7f8e\u4e2d') >= 0) return '3501 S Pulaski Rd, Chicago, IL 60623';
    return '18501 Arenth Ave, City of Industry, CA 91748';
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
      footerNote: cfg.footerNote || '',
      footerColor: cfg.footerColor || '',
      hideRecipientRole: cfg.hideRecipientRole === true,
      hideActionButton: cfg.hideActionButton === true,
      inlineActionLinkLabel: cfg.inlineActionLinkLabel || '',
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

    if (isStatusTransition(oldItem, record, ['\u5f85\u9884\u7ea6', '\u5f85\u63d0\u4ea4'], '\u4ed3\u5e93\u5f85\u786e\u8ba4')) {
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
          { label: '\u9884\u7ea6\u5355\u53f7', value: record.appointmentNo || '-' },
          { label: '\u76ee\u7684\u5730', value: (record.warehouse || record.confirmedWarehouse || '-') + ' (US West Warehouse)' },
          { label: '\u9884\u7ea6\u4ed3\u5e93\u5730\u5740', value: getMockWarehouseAddress(record) },
          { label: '\u9884\u8ba1\u6d3e\u9001\u65e5\u671f', value: record.expectedInboundTime || '-' },
          { label: '\u5f53\u524d\u72b6\u6001', value: '\u5f85\u4ed3\u5e93\u5ba1\u6838\uff08Pending Review\uff09' },
          { label: '\u5907\u6ce8', value: record.remark || '-' },
          { label: '\u8d27\u91cf', value: submitCargoSummary }
        ],
        bodyLines: [
          '\u60a8\u597d\uff01',
          '',
          '\u6211\u4eec\u5df2\u6210\u529f\u6536\u5230\u60a8\u63d0\u4ea4\u7684\u5165\u4ed3\u9884\u7ea6\u7533\u8bf7\uff0c\u76f8\u5173\u4fe1\u606f\u5982\u4e0b\uff1a',
          '',
          '\u9884\u7ea6\u5355\u53f7\uff1a' + (record.appointmentNo || '-'),
          '\u76ee\u7684\u5730\uff1a' + (record.warehouse || record.confirmedWarehouse || '-') + ' (US West Warehouse)',
          '\u9884\u7ea6\u4ed3\u5e93\u5730\u5740\uff1a' + getMockWarehouseAddress(record),
          '\u9884\u8ba1\u6d3e\u9001\u65e5\u671f\uff1a' + (record.expectedInboundTime || '-'),
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
        ]
      }));
      return messages;
    }

    if (isStatusTransition(oldItem, record, ['\u4ed3\u5e93\u5f85\u786e\u8ba4'], '\u5ba2\u6237\u5f85\u786e\u8ba4')) {
      messages.push(buildAppointmentEmailPayload(oldItem, record, {
        templateKey: 'warehouse_slot_pending_customer_confirm',
        recipientRole: '\u8d27\u4ee3',
        subject: '\u60a8\u7684\u5165\u4ed3\u9884\u7ea6\u5df2\u5ba1\u6838\u901a\u8fc7\uff0c\u8bf7\u70b9\u51fb\u786e\u8ba4\u6700\u7ec8\u65f6\u6bb5 - \u5355\u53f7\uff1a' + no,
        title: '\u5165\u4ed3\u9884\u7ea6\u5df2\u5ba1\u6838\u901a\u8fc7',
        intro: '\u60a8\u597d\uff01\n\n\u597d\u6d88\u606f\uff01\u60a8\u63d0\u4ea4\u7684\u5165\u4ed3\u9884\u7ea6\u7533\u8bf7\uff08\u5355\u53f7\uff1a' + no + '\uff09\u5df2\u901a\u8fc7\u4ed3\u5e93\u5ba1\u6838\u3002\n\n\u4e3a\u4e86\u786e\u4fdd\u60a8\u7684\u8d27\u7269\u80fd\u51c6\u65f6\u5165\u4ed3\uff0c\u8bf7\u60a8\u5728 48\u5c0f\u65f6\u5185 \u5b8c\u6210\u6700\u540e\u7684\u786e\u8ba4\u64cd\u4f5c\uff1a',
        actionText: '\u3010\u5fc5\u987b\u64cd\u4f5c\u3011\n\u8bf7\u70b9\u51fb\u4e0b\u65b9\u94fe\u63a5\u8fdb\u5165\u7cfb\u7edf\uff0c\u786e\u8ba4\u4e0a\u8ff0\u5206\u914d\u7684\u65f6\u6bb5\u3002\u903e\u671f\u672a\u786e\u8ba4\uff0c\u8be5\u65f6\u6bb5\u53ef\u80fd\u4f1a\u91cd\u65b0\u91ca\u653e\u7ed9\u5176\u4ed6\u9884\u7ea6\u3002\n\n[\u70b9\u51fb\u6b64\u5904\uff1a\u786e\u8ba4\u662f\u5426\u63a5\u53d7\u9884\u7ea6]\n\n\u6e29\u99a8\u63d0\u793a\uff1a\n\n\u786e\u8ba4\u540e\uff0c\u7cfb\u7edf\u5c06\u751f\u6210\u6700\u7ec8\u7684\u201c\u5165\u4ed3\u4e8c\u7ef4\u7801/\u51ed\u8bc1\u201d\uff0c\u8bf7\u4ea4\u7531\u53f8\u673a\u968f\u8d27\u643a\u5e26\u3002\n\u8bf7\u786e\u4fdd\u53f8\u673a\u5728\u6838\u5b9a\u65f6\u95f4\u5185\u5230\u8fbe\uff0c\u5982\u9700\u53d6\u6d88\u6216\u53d8\u66f4\uff0c\u8bf7\u81f3\u5c11\u63d0\u524d12\u5c0f\u65f6\u5728\u7cfb\u7edf\u5904\u7406\u3002\n\u795d\u5de5\u4f5c\u987a\u5229\uff01',
        actionUrl: getAppointmentConfirmUrl(record),
        hideActionButton: true,
        inlineActionLinkLabel: '\u70b9\u51fb\u6b64\u5904\uff1a\u786e\u8ba4\u662f\u5426\u63a5\u53d7\u9884\u7ea6',
        footerNote: '\u4ed3\u5e93\u9884\u7ea6\u7cfb\u7edf\n[WEDO EXPRESS]\n\n\uff08\u5f53\u524d\u4e3a\u7cfb\u7edf\u90ae\u4ef6\uff0c\u8bf7\u52ff\u56de\u590d\uff09',
        footerColor: '#1f5f9f',
        hideRecipientRole: true,
        fields: [
          { label: '\u9884\u7ea6\u5355\u53f7', value: record.appointmentNo || '-' },
          { label: '\u9884\u7ea6\u4ed3\u5e93', value: (record.warehouse || record.confirmedWarehouse || '-') + ' (US West Warehouse)' },
          { label: '\u4ed3\u5e93\u786e\u8ba4\u5730\u5740', value: record.warehouseConfirmedAddress || '-' },
          { label: '\u6838\u5b9a\u5165\u4ed3\u65f6\u6bb5', value: (record.warehouseConfirmedInboundTime || '-') + '\uff08\u5f53\u5730\u65f6\u95f4\uff09' }
        ],
        bodyLines: [
          '\u60a8\u597d\uff01',
          '',
          '\u597d\u6d88\u606f\uff01\u60a8\u63d0\u4ea4\u7684\u5165\u4ed3\u9884\u7ea6\u7533\u8bf7\uff08\u5355\u53f7\uff1a' + no + '\uff09\u5df2\u901a\u8fc7\u4ed3\u5e93\u5ba1\u6838\u3002',
          '',
          '\u4e3a\u4e86\u786e\u4fdd\u60a8\u7684\u8d27\u7269\u80fd\u51c6\u65f6\u5165\u4ed3\uff0c\u8bf7\u60a8\u5728 48\u5c0f\u65f6\u5185 \u5b8c\u6210\u6700\u540e\u7684\u786e\u8ba4\u64cd\u4f5c\uff1a',
          '',
          '\u9884\u7ea6\u5355\u53f7\uff1a' + (record.appointmentNo || '-'),
          '\u9884\u7ea6\u4ed3\u5e93\uff1a' + (record.warehouse || record.confirmedWarehouse || '-') + ' (US West Warehouse)',
          '\u4ed3\u5e93\u786e\u8ba4\u5730\u5740\uff1a' + (record.warehouseConfirmedAddress || '-'),
          '\u6838\u5b9a\u5165\u4ed3\u65f6\u6bb5\uff1a' + (record.warehouseConfirmedInboundTime || '-') + '\uff08\u5f53\u5730\u65f6\u95f4\uff09',
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
        ]
      }));
      return messages;
    }

    if (isStatusTransition(oldItem, record, ['\u4ed3\u5e93\u5f85\u786e\u8ba4'], '\u9884\u7ea6\u5931\u8d25')) {
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
        fields: [
          { label: '\u9a73\u56de\u539f\u56e0', value: record.rejectRemark || '\u8bf7\u5728\u6b64\u5904\u8f93\u5165\u5177\u4f53\u539f\u56e0\uff0c\u4f8b\u5982\uff1a\u6240\u9009\u65f6\u6bb5\u6708\u53f0\u5df2\u6ee1 / \u9644\u4ef6\u5355\u636e\u4e0d\u6e05\u6670 / \u7f3a\u5c11\u5546\u6807\u6388\u6743\u6587\u4ef6 / \u76ee\u7684\u5730\u4ed3\u5e93\u9009\u62e9\u9519\u8bef' }
        ],
        bodyLines: [
          '\u60a8\u597d\uff01',
          '',
          '\u5f88\u62b1\u6b49\u5730\u901a\u77e5\u60a8\uff0c\u60a8\u63d0\u4ea4\u7684\u5165\u4ed3\u9884\u7ea6\u7533\u8bf7\uff08\u5355\u53f7\uff1a' + no + '\uff09\u672a\u901a\u8fc7\u5ba1\u6838\u3002',
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
        ]
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
        extraFields: [
          { label: '\u4ed3\u5e93\u786e\u8ba4\u5730\u5740', value: record.warehouseConfirmedAddress || '-' },
          { label: '\u4ed3\u5e93\u786e\u8ba4\u65f6\u6bb5', value: record.warehouseConfirmedInboundTime || '-' },
          { label: '\u9001\u4ed3\u7801', value: record.deliveryCode || '-' },
          { label: '\u8d27\u7269\u6982\u8981', value: cargoSummary },
          { label: '\u4ed3\u5e93\u5907\u6ce8', value: record.auditRemark || '-' }
        ]
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
          { label: '\u9884\u7ea6\u5355\u53f7', value: record.appointmentNo || '-' },
          { label: '\u76ee\u7684\u5730', value: (record.warehouse || record.confirmedWarehouse || '-') + ' (US West Warehouse)' },
          { label: '\u8be6\u7ec6\u5730\u5740', value: record.warehouseConfirmedAddress || '-' },
          { label: '\u5165\u4ed3\u65e5\u671f', value: inboundDate },
          { label: '\u5165\u4ed3\u65f6\u6bb5', value: inboundTimeRange + '\uff08\u5f53\u5730\u65f6\u95f4\uff09' }
        ],
        bodyLines: [
          '[\u7cfb\u7edf\u81ea\u52a8\u901a\u77e5]',
          '',
          '\u60a8\u597d\uff01',
          '',
          '\u606d\u559c\uff0c\u60a8\u7684\u5165\u4ed3\u9884\u7ea6\u7533\u8bf7\u5df2\u5ba1\u6838\u6210\u529f\u3002\u7cfb\u7edf\u5df2\u4e3a\u60a8\u9501\u5b9a\u4ee5\u4e0b\u5165\u4ed3\u65f6\u6bb5\uff1a',
          '',
          '\u3010\u9884\u7ea6\u4fe1\u606f\u3011',
          '',
          '\u9884\u7ea6\u5355\u53f7\uff1a' + (record.appointmentNo || '-'),
          '\u76ee\u7684\u5730\uff1a' + (record.warehouse || record.confirmedWarehouse || '-') + ' (US West Warehouse)',
          '\u8be6\u7ec6\u5730\u5740\uff1a' + (record.warehouseConfirmedAddress || '-'),
          '\u5165\u4ed3\u65e5\u671f\uff1a' + inboundDate,
          '\u5165\u4ed3\u65f6\u6bb5\uff1a' + inboundTimeRange + '\uff08\u5f53\u5730\u65f6\u95f4\uff09',
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
        ]
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
    var payloads = buildAppointmentEmailMessages(oldItem, record);
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

  function getEligibleInOrders(warehouse) {
    if (typeof MOCK_IN_ORDER_LIST === 'undefined') return [];
    return MOCK_IN_ORDER_LIST.filter(function (item) {
      return (
        item.status === '运输在途' &&
        item.shippingMethod === '客户自发头程' &&
        item.warehouse === warehouse
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
      warehouse: item.warehouse,
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
      '仓库待确认': ['detail', 'cancel'],
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
      '仓库待确认': 'warehouse-pending',
      '客户待确认': 'customer-pending',
      '待送仓': 'processing',
      '已送仓': 'delivered',
      '已超时': 'timeout',
      '预约失败': 'failed',
      '已废弃': 'discarded'
    };
    return map[status] || 'default';
  }

  function applyStatusAction(appointment, action) {
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
      if (!window.confirm('是否接受仓库确认时段：' + time + '？')) return null;
      a.status = '待送仓';
      if (a.confirmedWarehouse) a.warehouse = a.confirmedWarehouse;
      pushOperationLog(a, getOfficialOperator(a),
        '客户确认接受仓库时段 ' + time + '，状态变更为待送仓');
    } else if (action === 'rebook' && a.status === '已超时') {
      a.status = '待预约';
      a.expectedInboundTime = '';
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
    : ['\u4ed3\u5e93\u5f85\u786e\u8ba4', '\u5ba2\u6237\u5f85\u786e\u8ba4', '\u5f85\u9001\u4ed3', '\u5df2\u9001\u4ed3', '\u5df2\u8d85\u65f6'];

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
    return '\u8fd0\u5fb7\u8239\u52a1';
  }

  function getUsTimezoneLabel(warehouse) {
    if (!warehouse) return 'US/Pacific';
    if (warehouse.indexOf('\u7f8e\u4e1c') >= 0) return 'US/Eastern';
    if (warehouse.indexOf('\u7f8e\u4e2d') >= 0) return 'US/Central';
    if (warehouse.indexOf('\u7f8e\u897f') >= 0) return 'US/Pacific';
    return 'US/Pacific';
  }

  function formatUsWarehouseTime(str, warehouse) {
    if (!str) return '-';
    if (!warehouse || warehouse.indexOf('\u7f8e') < 0) return str;
    return str + ' (' + getUsTimezoneLabel(warehouse) + ')';
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
    return [{ id: 'us-west-4', name: '\u7f8e\u897f4\u4ed3', address: '\u7f8e\u897f4\u4ed3\u9001\u4ed3\u5730\u5740\uff08\u6f14\u793a\uff09' }];
  }

  function findUsWarehouseById(id) {
    var list = getUsWarehouseOptions();
    for (var i = 0; i < list.length; i++) {
      if (list[i].id === id) return list[i];
    }
    return list[0] || null;
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

  function pushOperationLog(item, operator, action) {
    if (!item.operationLogs) item.operationLogs = [];
    item.operationLogs.push({ time: formatNow(), operator: operator, action: action });
  }

  /** \u64cd\u4f5c\u65e5\u5fd7\u5217\u8868\uff08\u6d77\u5916\u4ed3 / \u4e2d\u53f0\u7b49\u9875\u9762\u540c\u6e90\uff09 */
  function getOperationLogs(item) {
    if (!item || !Array.isArray(item.operationLogs)) return [];
    return item.operationLogs.slice();
  }

  /**
   * 海外仓审核（仓库待确认状态下）
   * @param {object} item 预约单
   * @param {object} opts
   *   - decision: 'confirm'（确认时段，统一→客户待确认）| 'reject'（拒收→预约失败）
   *   - warehouseId: 仓库 id（confirm 必填）
   *   - slotDate / slotStartHHMM / slotEndHHMM: 仓库回的时段（confirm 必填，同日 HH:MM）
   *   - remark: 审核备注（confirm 选填）/ 拒收原因（reject 必填）
   */
  function applyReceivingAudit(item, opts) {
    if (!item || item.status !== '\u4ed3\u5e93\u5f85\u786e\u8ba4' || !opts || !opts.decision) return null;
    var updated = JSON.parse(JSON.stringify(item));
    var operator = '\u6d77\u5916\u4ed3\u5ba1\u6838';
    var round = nextAuditRound(updated);

    if (opts.decision === 'reject') {
      var reason = String(opts.remark || '').trim();
      if (reason.length < 5) return null;
      updated.status = '\u9884\u7ea6\u5931\u8d25';
      updated.rejectRemark = reason;
      pushOperationLog(updated, operator,
        '\u7b2c' + round + '\u8f6e\u5ba1\u6838 \u00b7 \u62d2\u6536\uff0c\u539f\u56e0\uff1a' + reason +
        '\uff0c\u72b6\u6001\u53d8\u66f4\u4e3a\u9884\u7ea6\u5931\u8d25');
      return updated;
    }

    if (opts.decision === 'confirm') {
      var wh = opts.warehouseId ? findUsWarehouseById(opts.warehouseId) : findUsWarehouseById('us-west-4');
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
      pushOperationLog(updated, operator,
        '\u7b2c' + round + '\u8f6e\u5ba1\u6838 \u00b7 \u786e\u8ba4\u65f6\u6bb5 ' + slot +
        '\uff0c\u4ed3\u5e93\uff1a' + whName +
        (remark ? '\uff0c\u5907\u6ce8\uff1a' + remark : '') +
        '\uff0c\u72b6\u6001\u53d8\u66f4\u4e3a\u5ba2\u6237\u5f85\u786e\u8ba4');
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

  /** 演示用：一键确认（确认时段，默认下午时段） */
  function auditReceivingAppointment(item, done) {
    var today = formatNow().slice(0, 10);
    return submitReceivingAudit(item, {
      decision: 'confirm',
      warehouseId: 'us-west-4',
      slotDate: (item && item.expectedInboundTime) || today,
      slotStartHHMM: '14:00',
      slotEndHHMM: '17:00'
    }, done);
  }

  function defaultBookingLink(item) {
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
    var safe = escapeHtmlLite(link);
    return '<a href="' + safe + '" target="_blank" rel="noopener" class="detail-booking-link">' + safe + '</a>';
  }

  /**
   * \u64cd\u4f5c\u65e5\u5fd7\u5217\u8868 HTML\uff08\u4e0e us/receiving-appointment-detail \u540c\u6e90\u3001\u540c\u987a\u5e8f\uff09
   * @param {object} options emptyClass, timeClass, emptyText
   */
  function buildOperationLogListHtml(item, options) {
    var opts = options || {};
    var emptyClass = opts.emptyClass || 'detail-log-empty';
    var timeClass = opts.timeClass || 'detail-log-time';
    var emptyText = opts.emptyText != null ? opts.emptyText : '\u6682\u65e0\u65e5\u5fd7';
    var logs = getOperationLogs(item);
    if (!logs.length) {
      return '<li class="' + emptyClass + '">' + escapeHtmlLite(emptyText) + '</li>';
    }
    return logs.map(function (log) {
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
   * \u5f85\u9001\u4ed3 / \u5df2\u9001\u4ed3 \u65f6\u8fd4\u56de W.BOL \u6a21\u677f\u9875 URL（pathPrefix \u5982 '' \u6216 '../fg/'）
   */
  function getWPodDocumentUrl(item, pathPrefix) {
    if (!item || !item.deliveryCode) return '';
    var prefix = pathPrefix == null ? '' : pathPrefix;
    if (item.status !== '\u5f85\u9001\u4ed3' && item.status !== '\u5df2\u9001\u4ed3') {
      return item.wPodUrl || '';
    }
    return prefix + getWPodTemplateFile(item) + '?code=' + encodeURIComponent(item.deliveryCode);
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
  function officialWithdrawToPendingBook(item, logAction) {
    if (!item) return null;
    var updated = JSON.parse(JSON.stringify(item));
    updated.status = '\u5f85\u9884\u7ea6';
    clearOfficialNegotiationFields(updated);
    pushOperationLog(updated, getOfficialOperator(item),
      logAction || '\u5b98\u7f51\u64a4\u56de\u9884\u7ea6\uff0c\u72b6\u6001\u53d8\u66f4\u4e3a\u5f85\u9884\u7ea6');
    return updated;
  }

  /** \u5b98\u7f51\u63d0\u4ea4\u9884\u7ea6\uff1a\u5f85\u9884\u7ea6 \u2192 \u4ed3\u5e93\u5f85\u786e\u8ba4 */
  function officialSubmitToWarehousePending(item) {
    if (!item) return null;
    var updated = JSON.parse(JSON.stringify(item));
    if (updated.status !== '\u5f85\u9884\u7ea6' && updated.status !== '\u5f85\u63d0\u4ea4') return null;
    updated.status = '\u4ed3\u5e93\u5f85\u786e\u8ba4';
    if (!updated.submitTime) updated.submitTime = formatNow();
    if (!updated.bookingLink && updated.deliveryCode) {
      updated.bookingLink = '/fg/index.html?code=' + encodeURIComponent(updated.deliveryCode);
    }
    pushOperationLog(updated, getOfficialOperator(item),
      '\u5b98\u7f51\u63d0\u4ea4\u9884\u7ea6\uff0c\u72b6\u6001\u53d8\u66f4\u4e3a\u4ed3\u5e93\u5f85\u786e\u8ba4');
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
    pushOperationLog(updated, getOfficialOperator(item),
      '\u5ba2\u6237\u786e\u8ba4\u63a5\u53d7\u4ed3\u5e93\u65f6\u6bb5 ' + (time || '-') +
      '\uff0c\u72b6\u6001\u53d8\u66f4\u4e3a\u5f85\u9001\u4ed3');
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
    pushOperationLog(updated, getOfficialOperator(item),
      '\u5ba2\u6237\u4e0d\u63a5\u53d7\u5f53\u524d\u65f6\u6bb5\uff0c\u91cd\u65b0\u9884\u7ea6' +
      (note ? '\uff0c\u539f\u56e0\uff1a' + note : '') +
      '\uff0c\u72b6\u6001\u53d8\u66f4\u4e3a\u5f85\u9884\u7ea6');
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
    pushOperationLog(updated, getOfficialOperator(item),
      '\u5ba2\u6237\u53d6\u6d88\u9884\u7ea6' +
      (note ? '\uff0c\u539f\u56e0\uff1a' + note : '') +
      '\uff0c\u72b6\u6001\u53d8\u66f4\u4e3a\u5f85\u9884\u7ea6');
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

  function hasPdaReceivedCartons(registerPayload) {
    var register = registerPayload || {};
    var cartons = register.receivedCartons;
    if (cartons === '' || cartons == null || cartons === undefined) return false;
    var n = Number(cartons);
    return Number.isFinite(n) && n > 0 && /^[1-9]\d*$/.test(String(cartons).trim());
  }

  function validatePdaReceivingSubmit(item, photos, registerPayload) {
    if (!item) return { ok: false, msg: '\u8bf7\u5148\u626b\u63cf\u5e76\u67e5\u8be2\u9884\u7ea6\u5355' };
    if (item.status === '\u5df2\u9001\u4ed3') {
      return { ok: false, msg: '\u8be5\u9884\u7ea6\u5355\u5df2\u5b8c\u6210\u6536\u8d27\uff0c\u4e0d\u53ef\u91cd\u590d\u63d0\u4ea4' };
    }
    if (item.status === '\u4ed3\u5e93\u5f85\u786e\u8ba4') {
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
    if (!hasPhotos && !hasPdaReceivedCartons(registerPayload)) {
      return { ok: false, msg: '\u8bf7\u4e0a\u4f20\u5230\u4ed3\u6587\u4ef6 \u6216\u5f55\u5165\u6536\u8d27\u603b\u7bb1\u6570' };
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
    if (item.status === '\u4ed3\u5e93\u5f85\u786e\u8ba4') {
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
  function submitPdaReceivingScan(item, photoPayloads, operator, registerPayload, done) {
    var op = 'PDA\u64cd\u4f5c\u5458';
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
    var logMode = register.registerMode === 'detail' ? '\uff08\u6309\u660e\u7ec6\u767b\u8bb0\uff09' : '';
    pushOperationLog(updated, op, 'PDA\u6536\u8d27\u626b\u63cf\u786e\u8ba4\u5230\u4ed3' + logMode + '\uff0c\u767b\u8bb0\u6536\u8d27\u603b\u6258\u6570\uff1a' +
      (updated.receivedPallets || '-') + '\uff0c\u6536\u8d27\u603b\u7bb1\u6570\uff1a' +
      (updated.receivedCartons || '-') + '\uff0c\u72b6\u6001\u53d8\u66f4\u4e3a\u5df2\u9001\u4ed3');
    return addOrUpdateInMockAndPersist(updated, null, cb);
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
    formatUsWarehouseTime: formatUsWarehouseTime,
    calcTotalCartons: calcTotalCartons,
    formatEstimatedCartons: formatEstimatedCartons,
    calcTotalPalletsDisplay: calcTotalPalletsDisplay,
    isPalletized: isPalletized,
    formatPalletized: formatPalletized,
    formatTotalPallets: formatTotalPallets,
    enrichInboundRow: enrichInboundRow,
    buildInboundDetailRows: buildInboundDetailRows,
    resolveHandleMethod: resolveHandleMethod,
    getReceivingById: getReceivingById,
    getUsWarehouseOptions: getUsWarehouseOptions,
    findUsWarehouseById: findUsWarehouseById,
    applyReceivingAudit: applyReceivingAudit,
    submitReceivingAudit: submitReceivingAudit,
    auditReceivingAppointment: auditReceivingAppointment,
    defaultBookingLink: defaultBookingLink,
    buildBookingLinkHtml: buildBookingLinkHtml,
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
    APPOINTMENT_NOTIFY_EMAIL: APPOINTMENT_NOTIFY_EMAIL,
    sendAppointmentStatusChangeEmail: sendAppointmentStatusChangeEmail
  };
})();
