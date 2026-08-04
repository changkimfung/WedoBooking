(function () {
  var C = ProductCommon;
  var hasImage = false;

  function fillCategories() {
    var sel = document.getElementById('category');
    if (!sel || typeof MOCK_PRODUCT_CUSTOMER_CATEGORIES === 'undefined') return;
    MOCK_PRODUCT_CUSTOMER_CATEGORIES.forEach(function (cat) {
      var opt = document.createElement('option');
      opt.value = cat;
      opt.textContent = cat;
      sel.appendChild(opt);
    });
  }

  function bindImageTabs() {
    var tabs = document.querySelectorAll('.product-image-tab');
    var localPanel = document.getElementById('imageTabLocal');
    var urlPanel = document.getElementById('imageTabUrl');
    tabs.forEach(function (tab) {
      tab.addEventListener('click', function () {
        tabs.forEach(function (t) { t.classList.remove('active'); });
        tab.classList.add('active');
        var key = tab.getAttribute('data-tab');
        localPanel.style.display = key === 'local' ? 'block' : 'none';
        urlPanel.style.display = key === 'url' ? 'block' : 'none';
      });
    });

    var uploadBox = document.getElementById('uploadBox');
    var fileInput = document.getElementById('imageFile');
    if (uploadBox && fileInput) {
      uploadBox.addEventListener('click', function () { fileInput.click(); });
      fileInput.addEventListener('change', function () {
        if (fileInput.files && fileInput.files[0]) {
          hasImage = true;
          uploadBox.textContent = fileInput.files[0].name;
        }
      });
    }
    var urlInput = document.getElementById('imageUrl');
    if (urlInput) {
      urlInput.addEventListener('input', function () {
        hasImage = !!urlInput.value.trim();
      });
    }
  }

  function collectForm() {
    return {
      productCode: document.getElementById('productCode').value,
      productName: document.getElementById('productName').value,
      category: document.getElementById('category').value,
      description: document.getElementById('description').value,
      netWeight: document.getElementById('netWeight').value,
      upc: document.getElementById('upc').value,
      packLength: document.getElementById('packLength').value,
      packWidth: document.getElementById('packWidth').value,
      packHeight: document.getElementById('packHeight').value,
      chargeWeight: document.getElementById('chargeWeight').value,
      declareNameCn: document.getElementById('declareNameCn').value,
      declareNameEn: document.getElementById('declareNameEn').value,
      declarePrice: document.getElementById('declarePrice').value,
      hsCode: document.getElementById('hsCode').value,
      declareWeight: document.getElementById('declareWeight').value,
      materialCn: document.getElementById('materialCn').value,
      materialEn: document.getElementById('materialEn').value,
      usageCn: document.getElementById('usageCn').value,
      brand: document.getElementById('brand').value,
      model: document.getElementById('model').value,
      unit: document.getElementById('unit').value,
      hasImage: hasImage || !!document.getElementById('imageUrl').value.trim()
    };
  }

  function bind() {
    C.initSidebarMenus();
    fillCategories();
    bindImageTabs();

    document.getElementById('btnCancel').addEventListener('click', function () {
      window.location.href = 'productList.html';
    });

    document.getElementById('btnSubmit').addEventListener('click', function () {
      var form = collectForm();
      var errors = C.validateCreateForm(form);
      if (errors.length) {
        window.alert(errors.join('\n'));
        return;
      }

      var product = C.buildProductFromForm(form);
      var list = C.getBaseList();
      list.unshift(product);
      C.persistList(list);

      C.persistListToSource(function (err) {
        if (err) {
          window.alert('产品已保存到当前会话，但写入源文件失败（请确认 npm run dev 已启动）：\n' + err.message);
          window.location.href = 'productList.html?created=1';
          return;
        }
        C.syncProductToWecom(product, function (syncErr, syncResult) {
          var msg = '产品提交成功！\n\n运德编号：' + product.yundeNo + '\n状态：待审核\n\n数据已同步至仓储中台。';
          if (syncErr) {
            msg += '\n\n企业微信同步失败：' + syncErr.message;
          } else if (syncResult && syncResult.skipped) {
            msg += '\n\n企业微信：未配置 Webhook（.env 中 WECOM_SMARTSHEET_WEBHOOK）';
          } else if (syncResult && syncResult.ok) {
            msg += '\n\n' + syncResult.message;
          } else if (syncResult) {
            msg += '\n\n企业微信：' + (syncResult.message || '同步失败');
            if (syncResult.webhook && syncResult.webhook.error) {
              msg += '\n' + syncResult.webhook.error;
            }
          }
          window.alert(msg);
          window.location.href = 'productList.html?created=1';
        });
      });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bind);
  } else {
    bind();
  }
})();
