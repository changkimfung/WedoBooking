/**
 * 海外仓 PDA · 收货确认（扫描识别 → 下一步 → 总数登记）
 */
(function () {
  var C = typeof DeliveryAppointmentCommon !== 'undefined' ? DeliveryAppointmentCommon : null;
  var currentItem = null;
  var photos = [];
  var OPERATOR = 'PDA\u64cd\u4f5c\u5458';

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

  function setScanStatus(msg, type) {
    var el = $('scanStatus');
    if (!el) return;
    el.textContent = msg || '';
    el.className = 'pda-ris-mstatus' + (type ? ' ' + type : '');
  }

  function setConfirmStatus(msg, type) {
    var el = $('confirmStatus');
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

  function hasUploadedPhotos() {
    return photos && photos.length > 0;
  }

  function isPositiveIntText(value) {
    return value === '' || /^[1-9]\d*$/.test(value);
  }

  function showPage(page) {
    var scan = $('pageScan');
    var confirm = $('pageConfirm');
    if (page === 'confirm') {
      if (scan) scan.classList.add('pda-hidden');
      if (confirm) confirm.classList.remove('pda-hidden');
    } else {
      if (confirm) confirm.classList.add('pda-hidden');
      if (scan) scan.classList.remove('pda-hidden');
    }
  }

  function formatPdaPalletRef(item) {
    if (C.formatPalletized(item) === '\u5426') return '0';
    var pallets = C.formatTotalPallets(item);
    if (pallets === '-' || pallets === '' || pallets == null) return '0';
    return pallets;
  }

  function fillDeliveryRefs(item) {
    var cartons = C.formatEstimatedCartons(item);
    var pallets = formatPdaPalletRef(item);
    var elCartons = $('refDeliveryCartons');
    var elPallets = $('refDeliveryPallets');
    if (elCartons) elCartons.textContent = cartons;
    if (elPallets) elPallets.textContent = pallets;
  }

  function hideScanResult() {
    var panel = $('scanResultPanel');
    if (panel) panel.classList.add('pda-hidden');
  }

  function renderScanResult(item) {
    $('scanAppointmentNo').textContent = item.appointmentNo || '-';
    $('scanDeliveryCode').textContent = item.deliveryCode || '-';
    $('scanBookerParty').textContent = C.getBookerParty(item);
    var panel = $('scanResultPanel');
    if (panel) panel.classList.remove('pda-hidden');
    setScanStatus('识别成功，请核对信息后点击下一步', 'ok');
  }

  function renderInboundPreview(item) {
    var host = $('inboundDetailPreview');
    if (!host) return;
    var rows = C.buildInboundDetailRows(item);
    if (!rows.length) {
      host.innerHTML = '<p class="pda-inbound-preview-empty">无货物明细</p>';
      return;
    }
    host.innerHTML =
      '<div class="pda-inbound-preview-title">货物明细</div>' +
      '<table class="pda-inbound-preview-table">' +
      '<thead><tr><th>单据号</th><th>送仓箱数</th></tr></thead><tbody>' +
      rows.map(function (row) {
        return '<tr><td>' + escapeHtml(row.orderNo) + '</td>' +
          '<td class="pda-inbound-preview-cartons">' + escapeHtml(row.deliveryCartons != null ? row.deliveryCartons : '-') + '</td></tr>';
      }).join('') +
      '</tbody></table>';
  }

  function renderConfirmPage(item) {
    var title = $('confirmPageTitle');
    if (title) {
      title.textContent = '\u9884\u7ea6\u5355\u53f7\uff1a' + (item.appointmentNo || '-');
    }
    fillDeliveryRefs(item);
    renderInboundPreview(item);
    $('receivedCartons').value = item.receivedCartons != null && item.receivedCartons !== '' ? item.receivedCartons : '';
    $('receivedPallets').value = item.receivedPallets != null && item.receivedPallets !== '' ? item.receivedPallets : '';
    photos = [];
    renderPhotos();
    setConfirmStatus('请上传送仓文件后提交', 'ok');
  }

  function getReceivingRegisterPayload() {
    var pallets = ($('receivedPallets').value || '').trim();
    var cartons = ($('receivedCartons').value || '').trim();
    return {
      receivedPallets: pallets ? Number(pallets) : '',
      receivedCartons: cartons ? Number(cartons) : ''
    };
  }

  function validateReceivingRegister() {
    var pallets = ($('receivedPallets').value || '').trim();
    var cartons = ($('receivedCartons').value || '').trim();

    if (!hasUploadedPhotos()) {
      return {
        ok: false,
        msg: '请上传送仓文件',
        useModal: true
      };
    }
    if (cartons !== '' && !isPositiveIntText(cartons)) {
      return { ok: false, msg: '收货总箱数需为正整数', focusId: 'receivedCartons' };
    }
    if (!isPositiveIntText(pallets)) {
      return { ok: false, msg: '收货总托数需为正整数', focusId: 'receivedPallets' };
    }
    if (!pallets) {
      return {
        ok: true,
        needConfirm: true,
        msg: '收货总托数为空，请现场确认是否继续提交？'
      };
    }
    return { ok: true, needConfirm: false };
  }

  function renderPhotos() {
    var host = $('photoList');
    if (!host) return;
    if (!photos.length) {
      host.innerHTML = '<span class="pda-photo-empty">未上传</span>';
      return;
    }
    host.innerHTML = photos.map(function (p, idx) {
      return '<div class="pda-photo-item">' +
        '<img src="' + escapeHtml(p.url) + '" alt="\u5230\u4ed3\u7167\u7247' + (idx + 1) + '">' +
        '<button type="button" class="pda-photo-del" data-idx="' + idx + '">\u5220</button></div>';
    }).join('');
    host.querySelectorAll('.pda-photo-del').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var i = parseInt(btn.getAttribute('data-idx'), 10);
        photos.splice(i, 1);
        renderPhotos();
      });
    });
  }

  function addPhotoFiles(files) {
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
            photos.push({ url: rd.result, name: file.name || '到仓照片' });
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

  function doLookup() {
    if (!C) {
      setScanStatus('未加载预约数据模块', 'err');
      return;
    }
    var code = ($('scanInput').value || '').trim();
    if (!code) {
      setScanStatus('请输入或扫描预约码 / 入库单号', 'err');
      $('scanInput').focus();
      return;
    }
    var item = C.findReceivingByScanCode(code);
    if (!item) {
      currentItem = null;
      hideScanResult();
      setScanStatus('未找到对应预约单，请核对单号', 'err');
      return;
    }
    var lookup = C.validatePdaReceivingLookup(item);
    if (!lookup.ok) {
      currentItem = null;
      hideScanResult();
      setScanStatus(lookup.msg, 'err');
      return;
    }
    currentItem = item;
    renderScanResult(item);
  }

  function goToRegister() {
    if (!currentItem) {
      setScanStatus('请先扫描并识别预约单', 'err');
      return;
    }
    renderConfirmPage(currentItem);
    showPage('confirm');
  }

  function goBack() {
    photos = [];
    $('receivedCartons').value = '';
    $('receivedPallets').value = '';
    renderPhotos();
    setConfirmStatus('', '');
    showPage('scan');
    if (currentItem) {
      renderScanResult(currentItem);
    }
  }

  function resetAll() {
    currentItem = null;
    photos = [];
    $('scanInput').value = '';
    $('receivedCartons').value = '';
    $('receivedPallets').value = '';
    hideScanResult();
    renderPhotos();
    setScanStatus('', '');
    setConfirmStatus('', '');
    showPage('scan');
    $('scanInput').focus();
  }

  function doSubmit() {
    if (!C || !currentItem) {
      setConfirmStatus('预约单已失效，请返回重新扫描', 'err');
      return;
    }
    var registerPayload = getReceivingRegisterPayload();
    var registerValidation = validateReceivingRegister();
    if (!registerValidation.ok) {
      if (registerValidation.useModal) {
        showPdaAlertModal(registerValidation.msg);
      } else {
        setConfirmStatus(registerValidation.msg, 'err');
        if (registerValidation.focusId && $(registerValidation.focusId)) {
          $(registerValidation.focusId).focus();
        }
      }
      return;
    }
    var validation = C.validatePdaReceivingSubmit(currentItem, photos, registerPayload);
    if (!validation.ok) {
      if (validation.msg.indexOf('\u9001\u4ed3\u6587\u4ef6') >= 0) {
        showPdaAlertModal(validation.msg);
      } else {
        setConfirmStatus(validation.msg, 'err');
      }
      return;
    }
    if (registerValidation.needConfirm && !window.confirm(registerValidation.msg)) {
      setConfirmStatus('已取消提交', 'err');
      return;
    }
    var btn = $('btnSubmit');
    if (btn) btn.disabled = true;
    C.submitPdaReceivingScan(currentItem, photos, OPERATOR, registerPayload, function (err, updated) {
      if (btn) btn.disabled = false;
      if (!updated) {
        setConfirmStatus((err && err.message) || '提交失败', 'err');
        return;
      }
      window.alert(C.persistSuccessMessage(err, '收货确认成功，预约单已变更为已送仓'));
      resetAll();
    });
  }

  function bindEvents() {
    $('scanInput').addEventListener('keydown', function (e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        doLookup();
      }
    });
    $('scanInput').addEventListener('input', function () {
      if (currentItem) {
        currentItem = null;
        hideScanResult();
        setScanStatus('', '');
      }
    });
    $('btnNext').addEventListener('click', goToRegister);
    $('btnUploadPhoto').addEventListener('click', function () {
      $('photoFile').click();
    });
    $('photoFile').addEventListener('change', function () {
      addPhotoFiles(this.files);
      this.value = '';
    });
    $('btnSubmit').addEventListener('click', doSubmit);
    $('btnBack').addEventListener('click', goBack);
    $('pdaAlertModalOk').addEventListener('click', hidePdaAlertModal);
    $('pdaAlertModal').addEventListener('click', function (e) {
      if (e.target === $('pdaAlertModal')) hidePdaAlertModal();
    });
  }

  function init() {
    if (!C) {
      setScanStatus('未加载预约送仓模拟数据', 'err');
      return;
    }
    bindEvents();
    C.bindAppointmentStorageSync(function () {
      if (!currentItem || !currentItem.id) return;
      var latest = C.getReceivingById(currentItem.id);
      if (latest) {
        currentItem = latest;
        if ($('pageConfirm') && !$('pageConfirm').classList.contains('pda-hidden')) {
          renderConfirmPage(latest);
        } else if ($('scanResultPanel') && !$('scanResultPanel').classList.contains('pda-hidden')) {
          renderScanResult(latest);
        }
      }
    });
    $('scanInput').focus();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
