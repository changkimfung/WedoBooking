/**
 * 货代端（fg）中英文切换
 */
var FgI18n = (function () {
  var STORAGE_KEY = 'fg_locale';
  var listeners = [];

  var STRINGS = {
    zh: {
      brandName: '运德供应链',
      pageTitleIndex: '预约送仓 - 运德供应链 WEDO SCM',
      pageTitleDetail: '预约详情 - 运德供应链 WEDO SCM',
      step1: '输入预约码',
      step1En: 'Enter Reservation Code',
      step2: '预约送仓',
      step2En: 'Schedule Delivery',
      step3: '送仓完成',
      step3En: 'Delivery Completed',
      codePlaceholder: '请输入预约码',
      confirmBtn: '确定',
      errEmptyCode: '请输入预约码',
      errInvalidCode: '预约码无效或不存在，请检查后重试',
      alertTimezone: '预约送仓时间为海外仓当日，海外仓当地人员操作预约审核，为避免时差影响送仓，请您提前2个工作日提交预约单。',
      sectionApptInfo: '预约单信息',
      sectionCargo: '发货信息',
      sectionDelivery: '送仓信息',
      negotiationHistory: '协商历史',
      thApptNo: '预约单号',
      thDeliveryCode: '预约码',
      thWarehouse: '预约仓',
      thStatus: '预约状态',
      thDeliveryType: '送仓类型',
      thTotalCartons: '送仓总箱数',
      thContainerNo: '集装箱号',
      thContainerType: '柜型',
      thPalletized: '是否打托',
      thTotalPallets: '送仓总托数',
      thOrderNo: '入库单/票号',
      thShippingMethod: '运输方式',
      thCreateDate: '下单时间',
      thDeliveryCartons: '送仓箱数',
      labelRemark: '备注',
      labelWhAddress: '仓库确认地址',
      labelWhAuditRemark: '仓库审核备注',
      labelRejectRemark: '驳回原因',
      labelWPod: 'W.BOL 下载',
      labelContactPhone: '联系电话',
      contactPhonePlaceholder: '选填，便于仓库联系',
      labelContactEmail: '货代联系邮箱',
      labelPrimaryEmail: '主邮箱',
      addBackupDate: '添加备选日期',
      removeBackupDate: '移除备选日期',
      remarkPlaceholder: '如有多个候选日期或特殊时段要求请在此说明（例：6/2 或 6/3，上午到货最佳）',
      hintExpectedPrefix: '请选择期望送仓日期（',
      hintExpectedSuffix: '），周末（周六、周日）不收货。多个候选日期或特殊时段请在备注中说明。',
      hintExpectedHtml: '请选择期望送仓日期（{lt}），<strong>周末（周六、周日）不收货</strong>。最多可添加 3 个候选日期，第一个必填。',
      valSelectAltDate: '请先填写上一个备选日期',
      valMaxExpectedDates: '最多只能选择 3 个期望送仓日期',
      valDupExpectedDate: '候选日期不能重复：',
      valContactPhone: '联系电话格式不正确',
      phWhPending: '-',
      phDelivered: '-',
      phWPod: '-',
      downloadWPod: '下载 W.BOL',
      btnSubmit: '提交预约',
      btnAccept: '确认接受',
      btnCustomerRebook: '重新预约',
      btnCancel: '取消预约',
      btnRebook: '重新预约',
      btnBack: '返回',
      btnClose: '关闭',
      btnYes: '是',
      btnNo: '否',
      btnGiveUp: '放弃',
      btnConfirmCancel: '确认取消',
      btnConfirmAccept: '确认接受',
      btnConfirmRebook: '确认重新预约',
      modalWithdrawTitle: '确认撤回',
      modalWithdrawText: '是否需要撤回本次预约？撤回后预约单将恢复为「待预约」状态。',
      modalAcceptTitle: '确认接受',
      modalAcceptBody: '请确认是否接受以下仓库安排：',
      modalAcceptAddress: '仓库确认地址',
      modalAcceptTime: '仓库确认送仓时段',
      modalRebookTitle: '重新预约',
      modalRebookBody: '不接受当前仓库时段？预约将回到「待预约」，可在协商历史中查看完整记录。',
      modalHistoryTitle: '协商历史',
      modalHistoryBody: '本预约单从首次提交到当前的全部协商动作。',
      modalCancelTitle: '取消预约',
      modalCancelBody: '确定要取消本次预约？取消后预约单将回到「待预约」状态，可在协商历史中查看完整记录。',
      emptyNotFound: '未找到该预约码对应的预约单',
      emptyBackLink: '返回输入预约码',
      noCargo: '暂无关联入库单',
      noHistory: '暂无协商记录',
      tabDelivery: '送仓信息',
      tabOverview: '预约单信息',
      labelExpectedDate: '期望送仓日期',
      labelWhConfirmedTime: '仓库确认送仓时段',
      labelActualDeliveryTime: '实际送仓时段',
      localTimeSuffix: '当地时间',
      addBackupEmail: '添加备用邮箱',
      removeBackupEmail: '移除备用邮箱',
      valSelectExpectedDate: '请选择期望送仓日期',
      valDatePast: '期望送仓日期不能早于今天',
      valWeekend: '仓库周末（周六、周日）不收货，请选择工作日',
      valRemarkLen: '备注长度不能超过 500 字符',
      valPrimaryEmail: '请填写主邮箱',
      valContactEmail: '请至少填写一个货代联系邮箱',
      valEmailFormat: '邮箱格式不正确：',
      statusPendingWh: '待仓库审核',
      statusPendingCustomer: '待客户确认'
    },
    en: {
      brandName: 'WEDO SCM',
      pageTitleIndex: 'Delivery Appointment - WEDO SCM',
      pageTitleDetail: 'Appointment Details - WEDO SCM',
      step1: 'Enter Code',
      step1En: 'Enter Reservation Code',
      step2: 'Schedule Delivery',
      step2En: 'Schedule Delivery',
      step3: 'Completed',
      step3En: 'Delivery Completed',
      codePlaceholder: 'Enter reservation code',
      confirmBtn: 'Confirm',
      errEmptyCode: 'Please enter a reservation code',
      errInvalidCode: 'Invalid or unknown code. Please check and try again.',
      alertTimezone: 'Delivery appointments follow the overseas warehouse local calendar. To avoid time-zone issues, please submit at least 2 business days in advance.',
      sectionApptInfo: 'Appointment Info',
      sectionCargo: 'Shipment Info',
      sectionDelivery: 'Delivery Info',
      negotiationHistory: 'Negotiation History',
      thApptNo: 'Appointment No.',
      thDeliveryCode: 'Reservation Code',
      thWarehouse: 'Appointment WH',
      thStatus: 'Status',
      thDeliveryType: 'Delivery Type',
      thTotalCartons: 'Total Cartons',
      thContainerNo: 'Container No.',
      thContainerType: 'Container Type',
      thPalletized: 'Palletized',
      thTotalPallets: 'Total Pallets',
      thOrderNo: 'Inbound Order / Ticket',
      thShippingMethod: 'Shipping Method',
      thCreateDate: 'Order Date',
      thDeliveryCartons: 'Delivery Cartons',
      labelRemark: 'Remarks',
      labelWhAddress: 'Confirmed Warehouse Address',
      labelWhAuditRemark: 'Warehouse Audit Notes',
      labelRejectRemark: 'Rejection Reason',
      labelWPod: 'W.BOL Download',
      labelContactPhone: 'Contact Phone',
      contactPhonePlaceholder: 'Optional',
      labelContactEmail: 'Forwarder Contact Email',
      labelPrimaryEmail: 'Primary Email',
      addBackupDate: 'Add alternate date',
      removeBackupDate: 'Remove alternate date',
      remarkPlaceholder: 'Add alternate dates or special time requests here (e.g. 6/2 or 6/3, morning preferred)',
      hintExpectedPrefix: 'Select expected delivery date (',
      hintExpectedSuffix: '). No receiving on weekends (Sat/Sun). Add alternate dates in remarks if needed.',
      hintExpectedHtml: 'Select expected delivery date ({lt}). <strong>No receiving on weekends (Sat/Sun).</strong> Up to 3 dates; the first is required.',
      valSelectAltDate: 'Please complete the previous alternate date first',
      valMaxExpectedDates: 'You can select at most 3 expected delivery dates',
      valDupExpectedDate: 'Duplicate date not allowed: ',
      valContactPhone: 'Invalid contact phone number',
      phWhPending: '-',
      phDelivered: '-',
      phWPod: '-',
      downloadWPod: 'Download W.BOL',
      btnSubmit: 'Submit Appointment',
      btnAccept: 'Accept',
      btnCustomerRebook: 'Rebook',
      btnCancel: 'Cancel Appointment',
      btnRebook: 'Rebook',
      btnBack: 'Back',
      btnClose: 'Close',
      btnYes: 'Yes',
      btnNo: 'No',
      btnGiveUp: 'Dismiss',
      btnConfirmCancel: 'Confirm Cancel',
      btnConfirmAccept: 'Confirm Acceptance',
      btnConfirmRebook: 'Confirm Rebook',
      modalWithdrawTitle: 'Confirm Withdrawal',
      modalWithdrawText: 'Withdraw this appointment? It will return to Pending Booking status.',
      modalAcceptTitle: 'Confirm Acceptance',
      modalAcceptBody: 'Please confirm the warehouse arrangement below:',
      modalAcceptAddress: 'Confirmed Address',
      modalAcceptTime: 'Confirmed Delivery Window',
      modalRebookTitle: 'Rebook Appointment',
      modalRebookBody: 'Reject the current warehouse slot? The appointment will return to Pending Booking. See negotiation history for details.',
      modalHistoryTitle: 'Negotiation History',
      modalHistoryBody: 'All negotiation actions from first submission to the current state.',
      modalCancelTitle: 'Cancel Appointment',
      modalCancelBody: 'Cancel this appointment? It will return to Pending Booking. See negotiation history for details.',
      emptyNotFound: 'No appointment found for this code',
      emptyBackLink: 'Back to code entry',
      noCargo: 'No linked inbound orders',
      noHistory: 'No negotiation records',
      tabDelivery: 'Delivery Info',
      tabOverview: 'Appointment Info',
      labelExpectedDate: 'Expected Delivery Date',
      labelWhConfirmedTime: 'Confirmed Delivery Window',
      labelActualDeliveryTime: 'Actual Delivery Window',
      localTimeSuffix: 'local time',
      addBackupEmail: 'Add backup email',
      removeBackupEmail: 'Remove backup email',
      valSelectExpectedDate: 'Please select an expected delivery date',
      valDatePast: 'Expected delivery date cannot be earlier than today',
      valWeekend: 'Warehouse is closed on weekends (Sat/Sun). Please choose a weekday',
      valRemarkLen: 'Remarks cannot exceed 500 characters',
      valPrimaryEmail: 'Primary email is required',
      valEmailFormat: 'Invalid email format: ',
      statusPendingWh: 'Pending WH Confirmation',
      statusPendingCustomer: 'Pending Customer Confirmation'
    }
  };

  function getLocale() {
    try {
      var saved = localStorage.getItem(STORAGE_KEY);
      if (saved === 'en' || saved === 'zh') return saved;
    } catch (e) { /* ignore */ }
    return 'zh';
  }

  function setLocale(locale) {
    var next = locale === 'en' ? 'en' : 'zh';
    try { localStorage.setItem(STORAGE_KEY, next); } catch (e) { /* ignore */ }
    document.documentElement.lang = next === 'en' ? 'en' : 'zh-CN';
    applyStaticTexts();
    listeners.forEach(function (fn) { fn(next); });
    return next;
  }

  function t(key) {
    var locale = getLocale();
    var pack = STRINGS[locale] || STRINGS.zh;
    return pack[key] != null ? pack[key] : (STRINGS.zh[key] || key);
  }

  function stepLabel(mainKey, subKey) {
    if (getLocale() === 'en') {
      return t(mainKey) + '<br /><small>' + t(subKey) + '</small>';
    }
    return t(mainKey) + '<br /><small>' + t(subKey) + '</small>';
  }

  function applyStaticTexts() {
    document.querySelectorAll('[data-i18n]').forEach(function (el) {
      var key = el.getAttribute('data-i18n');
      if (!key) return;
      el.textContent = t(key);
    });
    document.querySelectorAll('[data-i18n-html]').forEach(function (el) {
      var key = el.getAttribute('data-i18n-html');
      if (!key) return;
      el.innerHTML = t(key);
    });
    document.querySelectorAll('[data-i18n-placeholder]').forEach(function (el) {
      var key = el.getAttribute('data-i18n-placeholder');
      if (!key) return;
      el.placeholder = t(key);
    });
    document.querySelectorAll('[data-i18n-step]').forEach(function (el) {
      var step = el.getAttribute('data-i18n-step');
      if (step === '1') el.innerHTML = stepLabel('step1', 'step1En');
      if (step === '2') el.innerHTML = stepLabel('step2', 'step2En');
      if (step === '3') el.innerHTML = stepLabel('step3', 'step3En');
    });
    document.querySelectorAll('.fg-lang-switch__btn').forEach(function (btn) {
      var lang = btn.getAttribute('data-lang');
      btn.classList.toggle('is-active', lang === getLocale());
    });
    var brandStrong = document.querySelector('.official-logo-text strong, .m-official-logo-text strong');
    if (brandStrong) brandStrong.textContent = getLocale() === 'en' ? 'WEDO SCM' : '运德供应链';
    if (document.body.classList.contains('official-page') && document.getElementById('detailMain')) {
      document.title = t('pageTitleDetail');
    } else if (document.body.classList.contains('official-page') || document.body.classList.contains('m-official-page')) {
      document.title = t('pageTitleIndex');
    }
  }

  function mountLangSwitch(containerSelector) {
    var header = document.querySelector(containerSelector);
    if (!header || header.querySelector('.fg-lang-switch')) return;
    var wrap = document.createElement('div');
    wrap.className = 'fg-lang-switch';
    wrap.innerHTML =
      '<button type="button" class="fg-lang-switch__btn" data-lang="zh" aria-label="中文">中文</button>' +
      '<span class="fg-lang-switch__sep">|</span>' +
      '<button type="button" class="fg-lang-switch__btn" data-lang="en" aria-label="English">EN</button>';
    header.appendChild(wrap);
    wrap.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-lang]');
      if (!btn) return;
      setLocale(btn.getAttribute('data-lang'));
    });
  }

  function onChange(fn) {
    if (typeof fn === 'function') listeners.push(fn);
  }

  function initHeaderLangSwitch(headerSelector) {
    mountLangSwitch(headerSelector || '.official-header, .m-official-header');
    applyStaticTexts();
  }

  return {
    getLocale: getLocale,
    setLocale: setLocale,
    t: t,
    applyStaticTexts: applyStaticTexts,
    initHeaderLangSwitch: initHeaderLangSwitch,
    onChange: onChange
  };
})();
