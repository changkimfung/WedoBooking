(function () {
  var OR = OfficialReservation;
  var C = DeliveryAppointmentCommon;
  var currentItem = null;

  var S = {
    WH_PENDING: '\u4ed3\u5e93\u5f85\u786e\u8ba4',
    PENDING_SUBMIT: '\u5f85\u63d0\u4ea4',
    PENDING_BOOK: '\u5f85\u9884\u7ea6',
    CUSTOMER_PENDING: '\u5ba2\u6237\u5f85\u786e\u8ba4',
    PENDING_DELIVERY: '\u5f85\u9001\u4ed3',
    DELIVERED: '\u5df2\u9001\u4ed3',
    TIMEOUT: '\u5df2\u8d85\u65f6',
    FAILED: '\u9884\u7ea6\u5931\u8d25'
  };

  function $(id) {
    return document.getElementById(id);
  }

  function statusCellClass(status) {
    if (status === S.WH_PENDING || OR.displayStatus(status) === '\u5f85\u4ed3\u5e93\u786e\u8ba4') {
      return 'status-pending-wh';
    }
    return '';
  }

  function renderAppointmentInfo(item, cargoRows) {
    var totalPallets = C.formatTotalPallets(item);
    var statusText = OR.displayStatus(item.status);
    $('appointmentInfoRow').innerHTML =
      '<td>' + escapeHtml(item.appointmentNo || '-') + '</td>' +
      '<td>' + escapeHtml(item.deliveryCode || '-') + '</td>' +
      '<td>' + escapeHtml(item.warehouse || '-') + '</td>' +
      '<td class="' + statusCellClass(item.status) + '">' + escapeHtml(statusText) + '</td>' +
      '<td>' + escapeHtml(item.deliveryType || '-') + '</td>' +
      '<td>' + escapeHtml(C.formatEstimatedCartons(item)) + '</td>' +
      '<td class="appt-info-fcl-only">' + escapeHtml(item.containerNo || '-') + '</td>' +
      '<td class="appt-info-fcl-only">' + escapeHtml(item.containerType || '-') + '</td>' +
      '<td>' + escapeHtml(C.formatPalletized(item)) + '</td>' +
      '<td>' + (totalPallets === '' || totalPallets == null ? '-' : totalPallets) + '</td>';
    toggleFclOnlyColumns(item.deliveryType === '\u6574\u67dc');
  }

  function toggleFclOnlyColumns(showFcl) {
    var els = document.querySelectorAll('.appt-info-fcl-only');
    for (var i = 0; i < els.length; i++) {
      els[i].style.display = showFcl ? '' : 'none';
    }
  }

  function renderCargoTable(cargoRows) {
    if (!cargoRows.length) {
      $('cargoBody').innerHTML =
        '<tr><td colspan="4" style="color:#bfbfbf;">\u6682\u65e0\u5173\u8054\u5165\u5e93\u5355</td></tr>';
      return;
    }
    $('cargoBody').innerHTML = cargoRows.map(function (row) {
      return '<tr>' +
        '<td>' + escapeHtml(row.orderNo) + '</td>' +
        '<td>' + escapeHtml(row.shippingMethod) + '</td>' +
        '<td>' + escapeHtml(row.createDate != null && row.createDate !== '' ? row.createDate : '-') + '</td>' +
        '<td>' + escapeHtml(row.deliveryCartons != null ? row.deliveryCartons : '-') + '</td>' +
        '</tr>';
    }).join('');
  }

  function renderPlaceholders(item) {
    var whTime = item.warehouseConfirmedInboundTime;
    var whAddr = item.warehouseConfirmedAddress;
    var actual = item.actualDeliveryTime;
    var phWh = '\u2014 \u5f85\u4ed3\u5e93\u786e\u8ba4\u540e\u5c55\u793a \u2014';
    var phDone = '\u2014 \u9001\u4ed3\u5b8c\u6210\u540e\u5c55\u793a \u2014';
    var phDownload = '\u2014 \u5f85\u9001\u4ed3\u540e\u53ef\u4e0b\u8f7d W.BOL \u2014';
    var wPodHref = OR.getWPodDocumentUrl(item);

    $('whConfirmedTime').textContent = whTime || phWh;
    $('whConfirmedTime').className = whTime ? 'official-value-confirmed' : 'official-placeholder';
    $('whConfirmedAddress').textContent = whAddr || phWh;
    $('whConfirmedAddress').className = whAddr ? 'official-value-confirmed' : 'official-placeholder';
    $('actualDeliveryTime').textContent = actual || phDone;
    $('actualDeliveryTime').className = actual ? '' : 'official-placeholder';

    var auditRemarkEl = $('whAuditRemark');
    if (auditRemarkEl) {
      var auditRemark = String(item.auditRemark || '').trim();
      if (whTime && auditRemark) {
        auditRemarkEl.style.display = '';
        auditRemarkEl.textContent = '\u4ed3\u5e93\u5907\u6ce8\uff1a' + auditRemark;
      } else {
        auditRemarkEl.style.display = 'none';
        auditRemarkEl.textContent = '';
      }
    }

    if (wPodHref) {
      $('wPodDownload').innerHTML =
        '<a href="' + escapeHtml(wPodHref) + '" target="_blank" rel="noopener">\u4e0b\u8f7d W.BOL</a>';
      $('wPodDownload').className = '';
    } else {
      $('wPodDownload').textContent = phDownload;
      $('wPodDownload').className = 'official-placeholder';
    }
  }

  function renderForm(item) {
    $('expectedDate').value = OR.parseExpectedDate(item.expectedInboundTime);
    $('remark').value = item.remark || '';
    renderEmailList(item);
    renderPlaceholders(item);
  }

  function renderHistoryLogs(item) {
    var logList = $('historyLogList');
    if (!logList) return;
    logList.innerHTML = C.buildOperationLogListHtml(item, {
      emptyClass: 'official-log-empty',
      timeClass: 'official-log-time',
      emptyText: '\u6682\u65e0\u534f\u5546\u8bb0\u5f55'
    });
  }

  function getPrimaryEmail(item) {
    var emails = (item && item.emails) || [];
    return (item && item.primaryEmail) || emails[0] || '';
  }

  function getBackupEmails(item) {
    var emails = (item && item.emails) || [];
    return emails.slice(1);
  }

  function renderEmailList(item) {
    var primaryEmail = getPrimaryEmail(item);
    var backupEmails = getBackupEmails(item);
    var container = $('emailList');
    container.innerHTML = '';
    container.appendChild(createEmailRow(primaryEmail, {
      primary: true,
      showAdd: true
    }));
    backupEmails.forEach(function (email) {
      container.appendChild(createEmailRow(email, {
        primary: false,
        showAdd: false
      }));
    });
  }

  function createEmailRow(value, options) {
    options = options || {};
    var row = document.createElement('div');
    row.className = 'email-row' + (options.primary ? ' email-row-primary' : '');
    var input = document.createElement('input');
    input.type = 'email';
    input.placeholder = 'name@example.com';
    input.value = value || '';
    input.setAttribute(options.primary ? 'data-primary-email' : 'data-backup-email', '1');
    if (options.primary) input.readOnly = true;
    row.appendChild(input);
    if (options.showAdd) {
      var addBtn = document.createElement('button');
      addBtn.type = 'button';
      addBtn.className = 'official-btn-add-email';
      addBtn.title = '\u6dfb\u52a0\u5907\u7528\u90ae\u7bb1';
      addBtn.textContent = '+';
      addBtn.addEventListener('click', function () {
        $('emailList').appendChild(createEmailRow('', {
          primary: false,
          showAdd: false
        }));
      });
      row.appendChild(addBtn);
    }
    if (!options.primary) {
      var removeBtn = document.createElement('button');
      removeBtn.type = 'button';
      removeBtn.className = 'official-btn-remove-email';
      removeBtn.title = '\u79fb\u9664\u5907\u7528\u90ae\u7bb1';
      removeBtn.textContent = '\u00d7';
      removeBtn.addEventListener('click', function () {
        row.parentNode.removeChild(row);
      });
      row.appendChild(removeBtn);
    }
    return row;
  }

  function collectEmails() {
    var primaryInput = document.querySelector('[data-primary-email]');
    var backupInputs = document.querySelectorAll('[data-backup-email]');
    var emails = [];
    var primaryEmail = primaryInput ? (primaryInput.value || '').trim() : '';
    if (primaryEmail) emails.push(primaryEmail);
    backupInputs.forEach(function (inp) {
      var v = (inp.value || '').trim();
      if (v && emails.indexOf(v) === -1) emails.push(v);
    });
    return emails;
  }

  function isWeekendDateStr(yyyyMmDd) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(yyyyMmDd || '')) return false;
    var parts = yyyyMmDd.split('-');
    var d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    var w = d.getDay();
    return w === 0 || w === 6;
  }

  function validateForm() {
    var date = $('expectedDate').value;
    if (!date) {
      window.alert('\u8bf7\u9009\u62e9\u671f\u671b\u9001\u4ed3\u65e5\u671f');
      $('expectedDate').focus();
      return false;
    }
    var today = new Date();
    var todayStr = today.getFullYear() + '-' +
      (today.getMonth() + 1 < 10 ? '0' : '') + (today.getMonth() + 1) + '-' +
      (today.getDate() < 10 ? '0' : '') + today.getDate();
    if (date < todayStr) {
      window.alert('\u671f\u671b\u9001\u4ed3\u65e5\u671f\u4e0d\u80fd\u65e9\u4e8e\u4eca\u5929');
      $('expectedDate').focus();
      return false;
    }
    if (isWeekendDateStr(date)) {
      window.alert('\u4ed3\u5e93\u5468\u672b\uff08\u5468\u516d\u3001\u5468\u65e5\uff09\u4e0d\u6536\u8d27\uff0c\u8bf7\u9009\u62e9\u5de5\u4f5c\u65e5');
      $('expectedDate').focus();
      return false;
    }
    var remark = ($('remark').value || '').trim();
    if (remark.length > 500) {
      window.alert('\u5907\u6ce8\u957f\u5ea6\u4e0d\u80fd\u8d85\u8fc7 500 \u5b57\u7b26');
      $('remark').focus();
      return false;
    }
    var emails = collectEmails();
    var primaryInput = document.querySelector('[data-primary-email]');
    var primaryEmail = primaryInput ? (primaryInput.value || '').trim() : '';
    if (!primaryEmail) {
      window.alert('\u4e3b\u90ae\u7bb1\u4e0d\u80fd\u4e3a\u7a7a');
      return false;
    }
    var emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    for (var i = 0; i < emails.length; i++) {
      if (!emailRe.test(emails[i])) {
        window.alert('\u90ae\u7bb1\u683c\u5f0f\u4e0d\u6b63\u786e\uff1a' + emails[i]);
        return false;
      }
    }
    return true;
  }

  function readFormIntoItem(item) {
    var copy = JSON.parse(JSON.stringify(item));
    copy.expectedInboundTime = OR.formatExpectedDate($('expectedDate').value);
    copy.remark = ($('remark').value || '').trim();
    copy.emails = collectEmails();
    copy.primaryEmail = copy.emails[0] || '';
    return copy;
  }

  function escapeHtml(str) {
    if (str == null) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function updateStepperForStatus(status) {
    var step3 = document.querySelector('.official-step[data-step="3"]');
    if (!step3) return;
    if (status === S.DELIVERED) {
      step3.classList.add('done');
      step3.classList.remove('active');
    } else {
      step3.classList.remove('done', 'active');
    }
  }

  function isFormEditable(status) {
    return status === S.PENDING_BOOK || status === S.PENDING_SUBMIT;
  }

  function setFormEditable(editable) {
    $('expectedDate').disabled = !editable;
    $('remark').disabled = !editable;
    document.querySelectorAll('[data-primary-email],[data-backup-email]').forEach(function (inp) {
      inp.disabled = !editable;
    });
    document.querySelectorAll('.official-btn-add-email').forEach(function (btn) {
      btn.style.display = editable ? '' : 'none';
    });
  }

  function showBtn(id, visible) {
    var el = $(id);
    if (el) el.style.display = visible ? '' : 'none';
  }

  function configureActionBar(status) {
    showBtn('btnSubmit', false);
    showBtn('btnAccept', false);
    showBtn('btnCancel', false);
    showBtn('btnCustomerRebook', false);
    showBtn('btnRebook', false);
    showBtn('btnBack', true);

    if (status === S.WH_PENDING) {
      showBtn('btnCancel', true);
    } else if (status === S.CUSTOMER_PENDING) {
      showBtn('btnAccept', true);
      showBtn('btnCustomerRebook', true);
      showBtn('btnCancel', true);
    } else if (status === S.PENDING_BOOK || status === S.PENDING_SUBMIT) {
      showBtn('btnSubmit', true);
    } else if (status === S.PENDING_DELIVERY) {
      showBtn('btnCancel', true);
    } else if (status === S.TIMEOUT || status === S.FAILED) {
      showBtn('btnRebook', true);
    }

    setFormEditable(isFormEditable(status));
  }

  function refreshView(message) {
    currentItem = C.getByDeliveryCode(currentItem.deliveryCode) || currentItem;
    var cargoRows = OR.buildCargoRows(currentItem);
    renderAppointmentInfo(currentItem, cargoRows);
    renderCargoTable(cargoRows);
    renderForm(currentItem);
    updateStepperForStatus(currentItem.status);
    configureActionBar(currentItem.status);
    if (message) window.alert(message);
  }

  function persistAndRefresh(updated, successText, done) {
    OR.persist(updated, function (err, record) {
      currentItem = record || updated;
      var msg = C.persistSuccessMessage(err, successText);
      refreshView(msg);
      if (done) done(err);
    });
  }

  function openModal(id) {
    var el = $(id);
    if (!el) return;
    el.style.display = 'flex';
    el.setAttribute('aria-hidden', 'false');
  }

  function closeModal(id) {
    var el = $(id);
    if (!el) return;
    el.style.display = 'none';
    el.setAttribute('aria-hidden', 'true');
  }

  function bindModals() {
    $('modalWithdrawNo').addEventListener('click', function () {
      closeModal('modalWithdraw');
    });
    $('modalAcceptNo').addEventListener('click', function () {
      closeModal('modalAccept');
    });
    $('modalCustomerRebookNo').addEventListener('click', function () {
      closeModal('modalCustomerRebook');
    });
    $('modalCustomerCancelNo').addEventListener('click', function () {
      closeModal('modalCustomerCancel');
    });
    $('modalHistoryClose').addEventListener('click', function () {
      closeModal('modalHistory');
    });

    $('modalWithdraw').addEventListener('click', function (e) {
      if (e.target === $('modalWithdraw')) closeModal('modalWithdraw');
    });
    $('modalAccept').addEventListener('click', function (e) {
      if (e.target === $('modalAccept')) closeModal('modalAccept');
    });
    $('modalCustomerRebook').addEventListener('click', function (e) {
      if (e.target === $('modalCustomerRebook')) closeModal('modalCustomerRebook');
    });
    $('modalCustomerCancel').addEventListener('click', function (e) {
      if (e.target === $('modalCustomerCancel')) closeModal('modalCustomerCancel');
    });
    $('modalHistory').addEventListener('click', function (e) {
      if (e.target === $('modalHistory')) closeModal('modalHistory');
    });
  }

  function openWithdrawModal(logAction) {
    $('modalWithdrawText').textContent =
      '\u662f\u5426\u9700\u8981\u64a4\u56de\u672c\u6b21\u9884\u7ea6\uff1f\u64a4\u56de\u540e\u9884\u7ea6\u5355\u5c06\u6062\u590d\u4e3a\u300c\u5f85\u9884\u7ea6\u300d\u72b6\u6001\u3002';
    openModal('modalWithdraw');
    $('modalWithdrawYes').onclick = function () {
      closeModal('modalWithdraw');
      $('modalWithdrawYes').onclick = null;
      var updated = C.officialWithdrawToPendingBook(currentItem, logAction);
      if (!updated) return;
      persistAndRefresh(updated, '\u5df2\u64a4\u56de\u4e3a\u5f85\u9884\u7ea6');
    };
  }

  function openAcceptModal() {
    var addr = currentItem.warehouseConfirmedAddress || '\u2014';
    var time = currentItem.warehouseConfirmedInboundTime || '\u2014';
    if (!String(currentItem.warehouseConfirmedAddress || '').trim() &&
        !String(currentItem.warehouseConfirmedInboundTime || '').trim()) {
      window.alert('\u6682\u65e0\u4ed3\u5e93\u786e\u8ba4\u4fe1\u606f\uff0c\u8bf7\u8054\u7cfb\u4ed3\u5e93\u6216\u7b49\u5f85\u5ba1\u6838\u3002');
      return;
    }
    $('acceptModalAddress').textContent = addr;
    $('acceptModalTime').textContent = time;
    openModal('modalAccept');
    $('modalAcceptYes').onclick = function () {
      closeModal('modalAccept');
      $('modalAcceptYes').onclick = null;
      var merged = readFormIntoItem(currentItem);
      var updated = C.officialAcceptCustomerConfirm(merged);
      if (!updated) {
        window.alert('\u786e\u8ba4\u5931\u8d25\uff0c\u8bf7\u68c0\u67e5\u9884\u7ea6\u5355\u72b6\u6001\u4e0e\u4ed3\u5e93\u786e\u8ba4\u4fe1\u606f\u3002');
        return;
      }
      persistAndRefresh(updated, '\u5df2\u786e\u8ba4\u63a5\u53d7\uff0c\u72b6\u6001\u5df2\u66f4\u65b0\u4e3a\u5f85\u9001\u4ed3');
    };
  }

  function openCustomerRebookModal() {
    openModal('modalCustomerRebook');
    $('modalCustomerRebookYes').onclick = function () {
      var updated = C.customerRebookFromCustomerPending(currentItem, '');
      if (!updated) {
        window.alert('\u5f53\u524d\u72b6\u6001\u4e0d\u53ef\u91cd\u65b0\u9884\u7ea6\uff0c\u8bf7\u5237\u65b0\u9875\u9762\u540e\u91cd\u8bd5');
        return;
      }
      closeModal('modalCustomerRebook');
      $('modalCustomerRebookYes').onclick = null;
      persistAndRefresh(updated, '\u5df2\u91cd\u65b0\u9884\u7ea6\uff0c\u72b6\u6001\u53d8\u66f4\u4e3a\u5f85\u9884\u7ea6\uff0c\u8bf7\u7b49\u5f85\u8d27\u4ee3\u91cd\u65b0\u63d0\u4ea4');
    };
  }

  function openHistoryModal() {
    if (!currentItem) return;
    renderHistoryLogs(currentItem);
    openModal('modalHistory');
  }

  function openCustomerCancelModal() {
    openModal('modalCustomerCancel');
    $('modalCustomerCancelYes').onclick = function () {
      var updated = C.customerCancelFromCustomerPending(currentItem, '');
      if (!updated) {
        window.alert('\u5f53\u524d\u72b6\u6001\u4e0d\u53ef\u53d6\u6d88\uff0c\u8bf7\u5237\u65b0\u540e\u91cd\u8bd5');
        return;
      }
      closeModal('modalCustomerCancel');
      $('modalCustomerCancelYes').onclick = null;
      persistAndRefresh(updated, '\u5df2\u53d6\u6d88\u9884\u7ea6\uff0c\u72b6\u6001\u53d8\u66f4\u4e3a\u5f85\u9884\u7ea6');
    };
  }

  function bindActions() {
    $('btnBack').addEventListener('click', function () {
      window.location.href = 'index.html?code=' + encodeURIComponent(currentItem.deliveryCode);
    });

    $('btnSubmit').addEventListener('click', function () {
      if (!validateForm()) return;
      var merged = readFormIntoItem(currentItem);
      var updated = C.officialSubmitToWarehousePending(merged);
      if (!updated) {
        window.alert('\u5f53\u524d\u72b6\u6001\u65e0\u6cd5\u63d0\u4ea4\u9884\u7ea6');
        return;
      }
      persistAndRefresh(updated, '\u63d0\u4ea4\u6210\u529f\uff0c\u72b6\u6001\u5df2\u66f4\u65b0\u4e3a\u4ed3\u5e93\u5f85\u786e\u8ba4');
    });

    $('btnCancel').addEventListener('click', function () {
      if (currentItem && currentItem.status === S.CUSTOMER_PENDING) {
        openCustomerCancelModal();
      } else {
        openWithdrawModal('\u5b98\u7f51\u53d6\u6d88\u9884\u7ea6\uff0c\u72b6\u6001\u53d8\u66f4\u4e3a\u5f85\u9884\u7ea6');
      }
    });

    $('btnCustomerRebook').addEventListener('click', function () {
      openCustomerRebookModal();
    });

    $('btnRebook').addEventListener('click', function () {
      openWithdrawModal('\u5b98\u7f51\u91cd\u65b0\u9884\u7ea6\uff0c\u72b6\u6001\u53d8\u66f4\u4e3a\u5f85\u9884\u7ea6');
    });

    $('btnAccept').addEventListener('click', function () {
      openAcceptModal();
    });

    $('btnOpenHistory').addEventListener('click', function () {
      openHistoryModal();
    });

    $('expectedDate').addEventListener('change', function () {
      var v = $('expectedDate').value;
      if (v && isWeekendDateStr(v)) {
        window.alert('\u4ed3\u5e93\u5468\u672b\uff08\u5468\u516d\u3001\u5468\u65e5\uff09\u4e0d\u6536\u8d27\uff0c\u8bf7\u9009\u62e9\u5de5\u4f5c\u65e5');
        $('expectedDate').value = '';
        $('expectedDate').focus();
      }
    });
  }

  function init() {
    var code = OR.getQueryCode();
    if (!code) {
      $('detailMain').style.display = 'none';
      $('emptyMain').style.display = 'block';
      return;
    }
    currentItem = OR.getAppointment(code);
    if (!currentItem) {
      $('detailMain').style.display = 'none';
      $('emptyMain').style.display = 'block';
      return;
    }

    var cargoRows = OR.buildCargoRows(currentItem);
    renderAppointmentInfo(currentItem, cargoRows);
    renderCargoTable(cargoRows);
    renderForm(currentItem);
    updateStepperForStatus(currentItem.status);
    configureActionBar(currentItem.status);
    bindModals();
    bindActions();
    C.bindAppointmentStorageSync(function () {
      if (!currentItem || !currentItem.deliveryCode) return;
      var latest = OR.getAppointment(currentItem.deliveryCode);
      if (!latest) return;
      currentItem = latest;
      refreshView();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
