/**
 * 客户前台 · 产品管理公共逻辑
 * 数据流：前台创建/编辑 → POST 写入 mock_data/productInfo.js → 中台读取同一份源
 */
var ProductCommon = (function () {
  var MOCK_PERSIST_API = '/api/mock/product-info';
  var WECOM_SYNC_API = '/api/wecom/sync-product';

  function normCode(s) {
    return String(s == null ? '' : s).trim().toUpperCase();
  }

  function getCurrentCustomerCode() {
    return typeof MOCK_CUSTOMER_CODE !== 'undefined' ? MOCK_CUSTOMER_CODE : 'CN0000438';
  }

  function getBaseList() {
    if (typeof window !== 'undefined' && window.MOCK_PRODUCT_INFO_LIST) {
      return JSON.parse(JSON.stringify(window.MOCK_PRODUCT_INFO_LIST));
    }
    if (typeof MOCK_PRODUCT_INFO_LIST !== 'undefined') {
      return JSON.parse(JSON.stringify(MOCK_PRODUCT_INFO_LIST));
    }
    return [];
  }

  function persistList(list) {
    if (typeof window !== 'undefined') {
      window.MOCK_PRODUCT_INFO_LIST = JSON.parse(JSON.stringify(list));
    }
  }

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

  function fetchAndApplyMockSource(done) {
    if (typeof fetch === 'undefined') {
      if (done) done(new Error('当前环境不支持 fetch'));
      return;
    }
    fetch(MOCK_PERSIST_API, { method: 'GET' })
      .then(function (res) {
        return res.json().then(function (body) {
          if (!res.ok) throw new Error((body && body.error) || '读取源文件失败');
          if (body && Array.isArray(body.list)) {
            persistList(body.list);
          }
          if (done) done(null, body);
        });
      })
      .catch(function (err) {
        if (done) done(err);
      });
  }

  function getCustomerProducts(list) {
    var code = normCode(getCurrentCustomerCode());
    return (list || getBaseList()).filter(function (row) {
      return normCode(row.userCode) === code;
    });
  }

  function countByAuditStatus(list) {
    var counts = { '待审核': 0, '已审核': 0, '已驳回': 0 };
    getCustomerProducts(list).forEach(function (row) {
      var st = row.auditStatus || '待审核';
      if (counts[st] != null) counts[st] += 1;
    });
    return counts;
  }

  function generateId() {
    return 'cust-prod-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  }

  function generateYundeNo() {
    var d = new Date();
    var y = d.getFullYear();
    var m = String(d.getMonth() + 1).padStart(2, '0');
    var day = String(d.getDate()).padStart(2, '0');
    var seq = String(Math.floor(Math.random() * 900) + 100);
    return 'YD' + y + m + day + seq;
  }

  function formatDateTime(d) {
    var dt = d || new Date();
    var pad = function (n) { return String(n).padStart(2, '0'); };
    return dt.getFullYear() + '-' + pad(dt.getMonth() + 1) + '-' + pad(dt.getDate()) +
      ' ' + pad(dt.getHours()) + ':' + pad(dt.getMinutes()) + ':' + pad(dt.getSeconds());
  }

  function mapCategoryToSpecialAttr(category) {
    var map = {
      '普通品': '普货',
      '带电品': '带电',
      '液体': '液体',
      '粉末': '粉末',
      '磁性': '磁性'
    };
    return map[category] || '普货';
  }

  function buildProductFromForm(form) {
    var packSpec = [form.packLength, form.packWidth, form.packHeight].join('*');
    var volCm3 = Number(form.packLength) * Number(form.packWidth) * Number(form.packHeight);
    var volumeM3 = volCm3 / 1000000;
    return {
      id: generateId(),
      userCode: getCurrentCustomerCode(),
      productCode: form.productCode.trim(),
      skuCode: form.productCode.trim(),
      yundeNo: generateYundeNo(),
      productName: form.productName.trim(),
      category: form.category,
      categoryL1: form.category,
      productStyle: form.model || '',
      model: form.model || '',
      weightKg: Number(form.netWeight),
      chargeWeightKg: Number(form.chargeWeight),
      volumeM3: volumeM3,
      chargeVolumeM3: volumeM3,
      packSpec: packSpec,
      chargeSpec: packSpec,
      specialAttr: mapCategoryToSpecialAttr(form.category),
      nameCn: form.declareNameCn.trim(),
      nameEn: form.declareNameEn.trim(),
      declarePrice: Number(form.declarePrice),
      declareWeight: form.declareWeight ? Number(form.declareWeight) : Number(form.netWeight),
      upc: form.upc.trim(),
      hsCode: (form.hsCode || '').trim(),
      unCode: '',
      sizeType: '均码',
      auditStatus: '待审核',
      measureStatus: '未测量',
      status: '是',
      sizeStandard: '否',
      sensitiveMark: form.category === '带电品' || form.category === '液体' ||
        form.category === '粉末' || form.category === '磁性' ? '是' : '否',
      hasImage: !!form.hasImage,
      hasFile: false,
      fileExpireDate: '',
      description: form.description.trim(),
      materialCn: form.materialCn.trim(),
      materialEn: form.materialEn.trim(),
      usageCn: form.usageCn.trim(),
      brand: (form.brand || '').trim(),
      unit: form.unit.trim(),
      subBoxNo: '',
      createSource: 'customer',
      createTime: formatDateTime()
    };
  }

  function validateCreateForm(form) {
    var errors = [];
    var codeRe = /^[A-Za-z0-9_\-\.]{1,20}$/;
    if (!form.productCode.trim()) errors.push('请填写产品编号');
    else if (!codeRe.test(form.productCode.trim())) errors.push('产品编号最多20位，仅支持字母、数字、下划线、中划线、点号');
    if (!form.productName.trim()) errors.push('请填写产品名称');
    if (!form.category) errors.push('请选择产品类别');
    if (!form.description.trim()) errors.push('请填写产品描述');
    if (!form.netWeight || Number(form.netWeight) <= 0) errors.push('请填写有效的产品净重');
    if (!form.upc.trim()) errors.push('请填写UPC全称');
    if (!form.packLength || !form.packWidth || !form.packHeight) errors.push('请填写完整包装规格');
    else {
      var l = Number(form.packLength);
      var w = Number(form.packWidth);
      var h = Number(form.packHeight);
      if (l < 10 || w < 10 || h < 1) errors.push('包装规格长宽高至少为 10×10×1 cm');
      if (Math.max(l, w, h) > 118) errors.push('包装规格单边长度不能超过 118cm');
      var volWeight = (l * w * h) / 6000;
      if (volWeight > 14) errors.push('体积重（长×宽×高/6000）不能超过 14kg');
    }
    if (!form.chargeWeight || Number(form.chargeWeight) <= 0) errors.push('请填写计费重量');
    if (!form.declareNameCn.trim()) errors.push('请填写中文申报名称');
    if (!form.declareNameEn.trim()) errors.push('请填写英文申报名称');
    if (!form.declarePrice || Number(form.declarePrice) <= 0) errors.push('请填写申报价格');
    if (!form.materialCn.trim()) errors.push('请填写材质（中文）');
    if (!form.materialEn.trim()) errors.push('请填写材质（英文）');
    if (!form.usageCn.trim()) errors.push('请填写用途（中文）');
    if (!form.unit.trim()) errors.push('请填写商品单位');
    var list = getBaseList();
    var code = form.productCode.trim().toLowerCase();
    if (list.some(function (row) {
      return normCode(row.userCode) === normCode(getCurrentCustomerCode()) &&
        String(row.productCode).toLowerCase() === code;
    })) {
      errors.push('产品编号已存在，请更换');
    }
    return errors;
  }

  function syncProductToWecom(product, done) {
    if (typeof fetch === 'undefined') {
      if (done) done(new Error('当前环境不支持 fetch'));
      return;
    }
    fetch(WECOM_SYNC_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ product: product })
    })
      .then(function (res) {
        return res.json().then(function (body) {
          if (!res.ok) throw new Error((body && body.error) || '企微同步失败');
          if (done) done(null, body);
        });
      })
      .catch(function (err) {
        if (done) done(err);
      });
  }

  function initSidebarMenus() {
    var docBtn = document.getElementById('docManageBtn');
    var docSub = document.getElementById('docManageSubmenu');
    if (docBtn && docSub) {
      docBtn.addEventListener('click', function () {
        docSub.classList.toggle('show');
      });
    }
    var prodBtn = document.getElementById('productManageBtn');
    var prodSub = document.getElementById('productManageSubmenu');
    if (prodBtn && prodSub) {
      prodBtn.addEventListener('click', function () {
        prodSub.classList.toggle('show');
      });
    }
  }

  function escapeHtml(s) {
    if (s == null || s === '') return '';
    var div = document.createElement('div');
    div.textContent = s;
    return div.innerHTML;
  }

  return {
    MOCK_PERSIST_API: MOCK_PERSIST_API,
    WECOM_SYNC_API: WECOM_SYNC_API,
    normCode: normCode,
    getCurrentCustomerCode: getCurrentCustomerCode,
    getBaseList: getBaseList,
    persistList: persistList,
    persistListToSource: persistListToSource,
    fetchAndApplyMockSource: fetchAndApplyMockSource,
    syncProductToWecom: syncProductToWecom,
    getCustomerProducts: getCustomerProducts,
    countByAuditStatus: countByAuditStatus,
    buildProductFromForm: buildProductFromForm,
    validateCreateForm: validateCreateForm,
    initSidebarMenus: initSidebarMenus,
    escapeHtml: escapeHtml
  };
})();
