/**
 * 仓储中台 PDA · 产品拍照
 * 扫描 SKU → Enter 校验中台 → 批量选图 → 提交 → 企微在线表
 */
(function () {
  var LOOKUP_API = '/api/mock/product-photo/lookup';
  var INBOUND_LOOKUP_API = '/api/mock/product-photo/inbound-lookup';
  var SUBMIT_API = '/api/mock/product-photo/submit';
  var DEFAULT_WAREHOUSE = '深圳A仓';

  var currentInbound = null;
  var currentProduct = null;
  var currentPhotos = [];
  var submitQueue = [];

  function $(id) {
    return document.getElementById(id);
  }

  function escapeHtml(str) {
    if (str == null) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function setStatus(msg, type) {
    var el = $('scanStatus');
    if (!el) return;
    el.textContent = msg || '';
    el.className = 'pda-ris-mstatus' + (type ? ' ' + type : '');
  }

  function showPdaAlertModal(msg) {
    var backdrop = $('pdaAlertModal');
    var text = $('pdaAlertModalText');
    if (!backdrop || !text) {
      window.alert(msg);
      return;
    }
    text.textContent = msg || '';
    backdrop.classList.remove('pda-hidden');
    backdrop.setAttribute('aria-hidden', 'false');
  }

  function hidePdaAlertModal() {
    var backdrop = $('pdaAlertModal');
    if (!backdrop) return;
    backdrop.classList.add('pda-hidden');
    backdrop.setAttribute('aria-hidden', 'true');
  }

  function getWarehouseName() {
    if (typeof WAREHOUSE_REGISTRY !== 'undefined' && WAREHOUSE_REGISTRY.length) {
      var domestic = WAREHOUSE_REGISTRY.find(function (w) { return w.region === 'domestic'; });
      if (domestic && domestic.name) return domestic.name;
      return WAREHOUSE_REGISTRY[0].name;
    }
    return DEFAULT_WAREHOUSE;
  }

  function togglePanel(id, show) {
    var el = $(id);
    if (!el) return;
    if (show) el.classList.remove('pda-hidden');
    else el.classList.add('pda-hidden');
  }

  function updateSubmitButton() {
    var btn = $('btnSubmit');
    if (!btn) return;
    var hasQueue = submitQueue.length > 0;
    var hasCurrent = !!(currentProduct && currentPhotos.length);
    btn.disabled = !(hasQueue || hasCurrent);
  }

  function renderInboundPanel(order) {
    if (!order) {
      togglePanel('inboundPanel', false);
      return;
    }
    $('infoInboundUserCode').textContent = order.userCode || '-';
    $('infoInboundWarehouse').textContent = order.warehouse || '-';
    $('infoInboundStatus').textContent = order.status || '-';
    togglePanel('inboundPanel', true);
  }

  function renderProductPanel(product) {
    if (!product) {
      togglePanel('productPanel', false);
      return;
    }
    $('infoProductName').textContent = product.productName || '-';
    $('infoUserCode').textContent = product.userCode || '-';
    $('infoAuditStatus').textContent = product.auditStatus || '-';
    togglePanel('productPanel', true);
  }

  function renderPhotos() {
    var host = $('photoList');
    if (!host) return;
    if (!currentPhotos.length) {
      host.innerHTML = '<span class="pda-photo-empty">未选择</span>';
      togglePanel('photoPanel', !!currentProduct);
      updateSubmitButton();
      return;
    }
    host.innerHTML = currentPhotos.map(function (p, idx) {
      return '<div class="pda-photo-item">' +
        '<img src="' + escapeHtml(p.url) + '" alt="产品图片' + (idx + 1) + '">' +
        '<button type="button" class="pda-photo-del" data-idx="' + idx + '">删</button></div>';
    }).join('');
    host.querySelectorAll('.pda-photo-del').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var i = parseInt(btn.getAttribute('data-idx'), 10);
        currentPhotos.splice(i, 1);
        renderPhotos();
      });
    });
    togglePanel('photoPanel', true);
    updateSubmitButton();
  }

  function renderQueue() {
    var host = $('queueList');
    var countEl = $('queueCount');
    if (!host) return;
    if (countEl) countEl.textContent = String(submitQueue.length);
    togglePanel('queuePanel', submitQueue.length > 0);
    if (!submitQueue.length) {
      host.innerHTML = '';
      updateSubmitButton();
      return;
    }
    host.innerHTML = submitQueue.map(function (item, idx) {
      return '<div class="pda-queue-item">' +
        '<div class="pda-queue-item-main">' +
        '<strong>' + escapeHtml(item.skuCode) + '</strong>' +
        '<span class="pda-queue-item-meta">' + escapeHtml(item.productName || '') + ' · ' + item.photos.length + ' 张</span>' +
        '</div>' +
        '<button type="button" class="pda-queue-del" data-idx="' + idx + '">移除</button>' +
        '</div>';
    }).join('');
    host.querySelectorAll('.pda-queue-del').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var i = parseInt(btn.getAttribute('data-idx'), 10);
        submitQueue.splice(i, 1);
        renderQueue();
      });
    });
    updateSubmitButton();
  }

  function getInboundOrderNo() {
    return ($('inboundInput').value || '').trim();
  }

  function resetCurrentSku(keepInput) {
    currentProduct = null;
    currentPhotos = [];
    if (!keepInput && $('skuInput')) $('skuInput').value = '';
    if ($('btnPickPhoto')) $('btnPickPhoto').disabled = true;
    renderProductPanel(null);
    renderPhotos();
  }

  function resetInbound(keepInput) {
    currentInbound = null;
    if (!keepInput && $('inboundInput')) $('inboundInput').value = '';
    renderInboundPanel(null);
  }

  function lookupInbound() {
    var orderNo = ($('inboundInput').value || '').trim();
    if (!orderNo) {
      setStatus('请扫描或输入入库单号', 'err');
      $('inboundInput').focus();
      return;
    }
    setStatus('入库单校验中...', '');
    fetch(INBOUND_LOOKUP_API + '?orderNo=' + encodeURIComponent(orderNo))
      .then(function (res) {
        return res.json().then(function (body) {
          if (!res.ok) throw new Error((body && body.error) || '入库单校验失败');
          return body;
        });
      })
      .then(function (body) {
        currentInbound = body.inboundOrder;
        renderInboundPanel(currentInbound);
        setStatus('入库单校验通过', 'ok');
      })
      .catch(function (err) {
        currentInbound = null;
        renderInboundPanel(null);
        setStatus((err && err.message) || '中台未找到该入库单', 'err');
      });
  }

  function lookupSku() {
    var sku = ($('skuInput').value || '').trim();
    if (!sku) {
      setStatus('请扫描或输入 SKU 编码', 'err');
      $('skuInput').focus();
      return;
    }
    setStatus('校验中...', '');
    fetch(LOOKUP_API + '?sku=' + encodeURIComponent(sku))
      .then(function (res) {
        return res.json().then(function (body) {
          if (!res.ok) throw new Error((body && body.error) || 'SKU 校验失败');
          return body;
        });
      })
      .then(function (body) {
        currentProduct = body.product;
        currentPhotos = [];
        renderProductPanel(currentProduct);
        renderPhotos();
        if ($('btnPickPhoto')) $('btnPickPhoto').disabled = false;
        setStatus('SKU 校验通过，可拍照/选择图片', 'ok');
      })
      .catch(function (err) {
        currentProduct = null;
        currentPhotos = [];
        if ($('btnPickPhoto')) $('btnPickPhoto').disabled = true;
        renderProductPanel(null);
        renderPhotos();
        setStatus((err && err.message) || '中台未找到该 SKU', 'err');
      });
  }

  function addPhotoFiles(files) {
    if (!currentProduct) {
      setStatus('请先扫描并校验 SKU', 'err');
      return;
    }
    if (!files || !files.length) return;
    var remain = files.length;
    for (var i = 0; i < files.length; i++) {
      (function (file) {
        if (!file.type || file.type.indexOf('image/') !== 0) {
          remain--;
          return;
        }
        var rd = new FileReader();
        rd.onload = function () {
          if (typeof rd.result === 'string') {
            currentPhotos.push({ url: rd.result, name: file.name || '产品图片' });
          }
          remain--;
          if (remain <= 0) renderPhotos();
        };
        rd.onerror = function () {
          remain--;
          if (remain <= 0) renderPhotos();
        };
        rd.readAsDataURL(file);
      })(files[i]);
    }
  }

  function addCurrentToQueue() {
    if (!currentProduct) {
      setStatus('请先扫描并校验 SKU', 'err');
      return;
    }
    if (!currentPhotos.length) {
      setStatus('请先拍照或选择图片', 'err');
      return;
    }
    submitQueue.push({
      skuCode: currentProduct.skuCode,
      productName: currentProduct.productName,
      photos: currentPhotos.map(function (p) { return { url: p.url, name: p.name }; })
    });
    renderQueue();
    setStatus('已加入待提交：' + currentProduct.skuCode + '（' + currentPhotos.length + ' 张）', 'ok');
    resetCurrentSku(false);
    $('skuInput').focus();
  }

  function doSubmit() {
    if (currentProduct && currentPhotos.length) {
      submitQueue.push({
        skuCode: currentProduct.skuCode,
        productName: currentProduct.productName,
        photos: currentPhotos.map(function (p) { return { url: p.url, name: p.name }; })
      });
      currentProduct = null;
      currentPhotos = [];
      if ($('btnPickPhoto')) $('btnPickPhoto').disabled = true;
      renderProductPanel(null);
      renderPhotos();
      renderQueue();
    }
    if (!submitQueue.length) {
      setStatus('待提交清单为空，请先校验 SKU 并选择图片', 'err');
      return;
    }
    var items = [];
    submitQueue.forEach(function (group) {
      group.photos.forEach(function (photo) {
        items.push({
          skuCode: group.skuCode,
          imageUrl: photo.url
        });
      });
    });
    var btn = $('btnSubmit');
    if (btn) btn.disabled = true;
    setStatus('提交中...', '');
    fetch(SUBMIT_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        warehouse: getWarehouseName(),
        inboundOrderNo: getInboundOrderNo(),
        items: items
      })
    })
      .then(function (res) {
        return res.json().then(function (body) {
          if (!res.ok) throw new Error((body && body.error) || '提交失败');
          return body;
        });
      })
      .then(function (body) {
        var wecomFailed = body.wecom && body.wecom.results
          ? body.wecom.results.filter(function (r) { return !r.ok && !r.skipped; }).length
          : 0;
        var msg = '提交成功，共 ' + body.count + ' 条图片记录';
        if (body.inboundSyncWarning) msg += '\n' + body.inboundSyncWarning;
        if (wecomFailed) msg += '；企微同步失败 ' + wecomFailed + ' 条';
        else if (body.wecom && body.wecom.results && body.wecom.results.some(function (r) { return r.skipped; })) {
          msg += '；企微未配置，仅保存本地';
        } else {
          msg += '，已同步企微在线表';
        }
        showPdaAlertModal(msg);
        submitQueue = [];
        renderQueue();
        resetCurrentSku(false);
        resetInbound(false);
        setStatus('', '');
      })
      .catch(function (err) {
        setStatus((err && err.message) || '提交失败', 'err');
      })
      .finally(function () {
        updateSubmitButton();
      });
  }

  function resetAll() {
    submitQueue = [];
    renderQueue();
    resetCurrentSku(false);
    resetInbound(false);
    setStatus('', '');
    $('skuInput').focus();
  }

  function bindEvents() {
    $('inboundInput').addEventListener('keydown', function (e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        lookupInbound();
      }
    });
    $('inboundInput').addEventListener('input', function () {
      if (currentInbound) {
        currentInbound = null;
        renderInboundPanel(null);
      }
    });
    $('skuInput').addEventListener('keydown', function (e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        lookupSku();
      }
    });
    $('skuInput').addEventListener('input', function () {
      if (currentProduct) resetCurrentSku(true);
    });
    $('btnPickPhoto').addEventListener('click', function () {
      $('photoFile').click();
    });
    $('photoFile').addEventListener('change', function () {
      addPhotoFiles(this.files);
      this.value = '';
    });
    $('btnAddToQueue').addEventListener('click', addCurrentToQueue);
    $('btnClearPhotos').addEventListener('click', function () {
      currentPhotos = [];
      renderPhotos();
      updateSubmitButton();
    });
    $('btnSubmit').addEventListener('click', doSubmit);
    $('btnReset').addEventListener('click', resetAll);
    $('pdaAlertModalOk').addEventListener('click', hidePdaAlertModal);
    $('pdaAlertModal').addEventListener('click', function (e) {
      if (e.target === $('pdaAlertModal')) hidePdaAlertModal();
    });
  }

  function init() {
    var tag = $('pdaWarehouseTag');
    if (tag) tag.textContent = getWarehouseName();
    bindEvents();
    renderQueue();
    $('skuInput').focus();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
