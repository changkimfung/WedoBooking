/**
 * 海外仓 · 入库预约详情
 */
(function ($) {
  'use strict';

  var C = DeliveryAppointmentCommon;
  var currentItem = null;
  var STATUS_WH_PENDING = '\u4ed3\u5e93\u5f85\u786e\u8ba4';
  var STATUS_FAILED = '\u9884\u7ea6\u5931\u8d25';

  function getQueryId() {
    var m = window.location.search.match(/[?&]id=([^&]+)/);
    return m ? decodeURIComponent(m[1]) : '';
  }

  function escapeHtml(s) {
    if (s == null || s === '') return '';
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function gridItem(label, valueHtml, fullWidth) {
    var cls = 'recv-detail-item' + (fullWidth ? ' recv-detail-item-full' : '');
    return '<div class="' + cls + '"><label>' + escapeHtml(label) + '</label><span>' +
      valueHtml + '</span></div>';
  }

  function statusClass(status) {
    if (status === STATUS_WH_PENDING) return 'wh-pending';
    if (status === '\u5ba2\u6237\u5f85\u786e\u8ba4') return 'customer-pending';
    if (status === '\u5df2\u9001\u4ed3') return 'delivered';
    if (status === STATUS_FAILED) return 'failed';
    return '';
  }

  function pickDatePart(str) {
    if (!str) return '';
    var m = String(str).trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
    return m ? (m[1] + '-' + m[2] + '-' + m[3]) : '';
  }

  function renderHeader(item) {
    $('#hdrAppointmentNo').text('#' + (item.appointmentNo || '-'));
    var $st = $('#hdrStatus');
    $st.text(item.status || '-').attr('class', 'recv-detail-status ' + statusClass(item.status));
    $('#btnAudit').toggle(item.status === STATUS_WH_PENDING);
  }

  function renderApplyGrid(item) {
    var wh = item.warehouse || '';
    var link = C.defaultBookingLink(item);
    var linkHtml = link
      ? '<a href="' + escapeHtml(link) + '" target="_blank" rel="noopener">' + escapeHtml(link) + '</a>'
      : '-';
    var remarkText = String(item.remark || '').trim();
    var fields = [
      ['预约单号', escapeHtml(item.appointmentNo || '-')],
      ['预约码', escapeHtml(item.deliveryCode || '-')],
      ['预约状态', escapeHtml(item.status || '-')],
      ['预约仓库', escapeHtml(item.warehouse || '-')],
      ['送仓类型', escapeHtml(item.deliveryType || '-')],
      ['送仓总箱数', escapeHtml(C.formatEstimatedCartons(item))],
      ['是否打托', escapeHtml(C.formatPalletized(item))],
      ['送仓总托数', escapeHtml(C.formatTotalPallets(item))],
      ['集装箱号', escapeHtml(item.containerNo || '-')],
      ['柜型', escapeHtml(item.containerType || '-')],
      ['创建人', escapeHtml(C.getBookerParty(item))],
      ['期望送仓日期', escapeHtml(C.formatUsWarehouseTime(item.expectedInboundTime, wh))],
      ['货代备注', remarkText ? escapeHtml(remarkText) : '-'],
      ['货代公司', escapeHtml(item.forwarder || '-')],
      ['联系邮箱', escapeHtml((item.emails || []).join('\u3001') || '-')],
      ['预约链接', linkHtml]
    ];
    $('#applyGrid').html(fields.map(function (f) {
      return gridItem(f[0], f[1]);
    }).join(''));
  }

  function formatWarehousePhone(item) {
    var phone = item.warehousePhone || item.warehouseConfirmedPhone;
    return phone && String(phone).trim() ? String(phone).trim() : '(848) 667-1949';
  }

  function renderWhConfirmGrid(item) {
    var wh = item.warehouse || item.confirmedWarehouse || '';
    var wPod = C.getWPodDocumentUrl(item, '../fg/') || item.wPodUrl;
    var wPodHtml = wPod
      ? '<a href="' + escapeHtml(wPod) + '" target="_blank" rel="noopener">\u4e0b\u8f7d W.BOL</a>'
      : '-';
    var fields = [
      ['仓库确认地址', escapeHtml(item.warehouseConfirmedAddress || '\u5f85\u786e\u8ba4')],
      ['联系电话', escapeHtml(formatWarehousePhone(item))],
      ['仓库确认时段', escapeHtml(C.formatUsWarehouseTime(item.warehouseConfirmedInboundTime, wh) || '\u5f85\u786e\u8ba4')],
      ['W.BOL \u4e0b\u8f7d', wPodHtml]
    ];
    $('#whConfirmGrid').html(fields.map(function (f) {
      return gridItem(f[0], f[1]);
    }).join(''));
  }

  function renderArrivalUnloadGrid(item) {
    var wh = item.warehouse || item.confirmedWarehouse || '';
    var fields = [
      ['实际到仓时间', escapeHtml(C.formatUsWarehouseTime(item.actualDeliveryTime, wh) || '-')],
      ['收货总箱数', escapeHtml(C.formatCell(item.receivedCartons))],
      ['收货总托数', escapeHtml(C.formatCell(item.receivedPallets))],
      ['到仓拍照', C.buildArrivalPhotosHtml(item, {
        listClass: 'recv-detail-photo-list',
        thumbClass: 'recv-detail-photo-thumb'
      }), true]
    ];
    $('#arrivalUnloadGrid').html(fields.map(function (f) {
      return gridItem(f[0], f[1], f[2]);
    }).join(''));
  }

  function renderInbound(item) {
    var rows = C.buildInboundDetailRows(item);
    var $body = $('#inboundBody');
    if (!rows.length) {
      $body.html('<tr><td colspan="9" class="recv-detail-empty">\u6682\u65e0\u5173\u8054\u5165\u5e93\u5355</td></tr>');
      return;
    }
    $body.html(rows.map(function (row) {
      return '<tr>' +
        '<td>' + escapeHtml(row.orderNo) + '</td>' +
        '<td>' + escapeHtml(row.shippingMethod) + '</td>' +
        '<td>' + escapeHtml(row.status) + '</td>' +
        '<td>' + escapeHtml(row.warehouse) + '</td>' +
        '<td>' + escapeHtml(row.cartons != null ? row.cartons : '-') + '</td>' +
        '<td>' + escapeHtml(row.deliveryCartons != null ? row.deliveryCartons : '-') + '</td>' +
        '<td>' + escapeHtml(row.receivedCartons != null ? row.receivedCartons : '-') + '</td>' +
        '<td>' + escapeHtml(row.createDate) + '</td>' +
        '<td>' + escapeHtml(row.handleMethod) + '</td>' +
        '</tr>';
    }).join(''));
  }

  function renderLogs(item) {
    $('#logList').html(C.buildOperationLogListHtml(item, {
      emptyClass: 'recv-detail-empty',
      timeClass: 'recv-detail-log-time'
    }));
  }

  function renderAll(item) {
    currentItem = item;
    renderHeader(item);
    renderApplyGrid(item);
    renderWhConfirmGrid(item);
    renderArrivalUnloadGrid(item);
    renderInbound(item);
    renderLogs(item);
  }

  function bindTabs() {
    $('#detailTabs a').on('click', function (e) {
      e.preventDefault();
      var tab = $(this).attr('data-tab');
      $('#detailTabs li').removeClass('active');
      $(this).parent().addClass('active');
      $('.recv-detail-tab-pane').removeClass('active');
      if (tab === 'logs') {
        $('#paneLogs').addClass('active');
      } else {
        $('#paneInbound').addClass('active');
      }
    });
  }

  function updateWhAddress() {
    var wh = C.findUsWarehouseById($('#auditWarehouse').val());
    $('#auditWhAddress').text(wh ? wh.address : '');
  }

  function getAuditDecision() {
    return $('input[name="auditDecision"]:checked').val() || 'confirm';
  }

  function syncAuditPanels() {
    var decision = getAuditDecision();
    if (decision === 'reject') {
      $('#auditPanelWh').hide();
      $('#auditPanelReject').show();
    } else {
      $('#auditPanelWh').show();
      $('#auditPanelReject').hide();
    }
    $('#auditFormError').hide().text('');
  }

  function initAuditWarehouseSelect() {
    var $sel = $('#auditWarehouse').empty();
    C.getUsWarehouseOptions().forEach(function (wh) {
      $sel.append($('<option></option>').val(wh.id).text(wh.name));
    });
    $sel.val('us-west-4');
    updateWhAddress();
  }

  function resetAuditForm(item) {
    $('input[name="auditDecision"][value="confirm"]').prop('checked', true);
    $('#auditRemarkOptional,#auditRemarkReject').val('');
    $('#auditSlotStart,#auditSlotEnd,#auditSlotDate').val('');
    initAuditWarehouseSelect();
    var wh = item.warehouse || '';
    var expected = C.formatUsWarehouseTime(item.expectedInboundTime, wh);
    $('#auditExpectedTime').text(expected || '-');
    $('#auditCustomerRemark').text(String(item.remark || '').trim() || '-');
    var expectedDate = pickDatePart(item.expectedInboundTime);
    if (expectedDate) {
      $('#auditSlotDate').val(expectedDate);
    }
    $('#auditSlotStart').val('09:00');
    $('#auditSlotEnd').val('12:00');
    syncAuditPanels();
  }

  function openAuditModal() {
    if (!currentItem || currentItem.status !== STATUS_WH_PENDING) return;
    resetAuditForm(currentItem);
    $('#auditModalBackdrop').show();
  }

  function closeAuditModal() {
    $('#auditModalBackdrop').hide();
    $('#auditFormError').hide().text('');
  }

  function showAuditError(msg) {
    $('#auditFormError').text(msg).show();
  }

  function validateAndBuildPayload() {
    var decision = getAuditDecision();
    if (decision === 'reject') {
      var rejectRemark = $('#auditRemarkReject').val().trim();
      if (rejectRemark.length < 5) {
        showAuditError('\u62d2\u6536\u539f\u56e0\u9700\u81f3\u5c11 5 \u5b57\u7b26');
        return null;
      }
      return { decision: 'reject', remark: rejectRemark };
    }
    var warehouseId = $('#auditWarehouse').val();
    if (!warehouseId) {
      showAuditError('\u8bf7\u9009\u62e9\u4ed3\u5e93');
      return null;
    }
    var slotDate = $('#auditSlotDate').val();
    var slotStart = $('#auditSlotStart').val();
    var slotEnd = $('#auditSlotEnd').val();
    if (!slotDate) {
      showAuditError('\u8bf7\u9009\u62e9\u4ed3\u5e93\u786e\u8ba4\u65e5\u671f');
      return null;
    }
    if (!slotStart || !slotEnd) {
      showAuditError('\u8bf7\u9009\u62e9\u4ed3\u5e93\u786e\u8ba4\u65f6\u6bb5\u7684\u8d77\u59cb\u4e0e\u7ed3\u675f\u65f6\u95f4');
      return null;
    }
    if (slotStart >= slotEnd) {
      showAuditError('\u7ed3\u675f\u65f6\u95f4\u987b\u665a\u4e8e\u5f00\u59cb\u65f6\u95f4');
      return null;
    }
    var remark = $('#auditRemarkOptional').val().trim();
    return {
      decision: 'confirm',
      warehouseId: warehouseId,
      slotDate: slotDate,
      slotStartHHMM: slotStart,
      slotEndHHMM: slotEnd,
      remark: remark
    };
  }

  function statusMessage(decision) {
    if (decision === 'reject') return '\u5df2\u62d2\u6536\uff0c\u72b6\u6001\u5df2\u53d8\u66f4\u4e3a\u9884\u7ea6\u5931\u8d25\u3002';
    return '\u786e\u8ba4\u65f6\u6bb5\u5df2\u63d0\u4ea4\uff0c\u72b6\u6001\u5df2\u53d8\u66f4\u4e3a\u5ba2\u6237\u5f85\u786e\u8ba4\uff0c\u7b49\u5f85\u5ba2\u6237\u62cd\u677f\u3002';
  }

  function submitAudit() {
    var payload = validateAndBuildPayload();
    if (!payload) return;
    var $btn = $('#auditModalSubmit').prop('disabled', true);
    C.submitReceivingAudit(currentItem, payload, function (err, updated) {
      $btn.prop('disabled', false);
      if (!updated) {
        showAuditError('\u63d0\u4ea4\u5931\u8d25\uff0c\u8bf7\u68c0\u67e5\u5fc5\u586b\u9879\u540e\u91cd\u8bd5\u3002');
        return;
      }
      closeAuditModal();
      renderAll(updated);
      var msg = C.persistSuccessMessage(err, statusMessage(payload.decision));
      window.alert(msg);
    });
  }

  function bindAudit() {
    $('#btnAudit').on('click', openAuditModal);
    $('#auditModalClose,#auditModalCancel').on('click', closeAuditModal);
    $('#auditModalBackdrop').on('click', function (e) {
      if (e.target === this) closeAuditModal();
    });
    $('input[name="auditDecision"]').on('change', syncAuditPanels);
    $('#auditWarehouse').on('change', updateWhAddress);
    $('#auditModalSubmit').on('click', submitAudit);
  }

  function loadAndRender() {
    var id = getQueryId();
    var item = C.getReceivingById(id);
    if (!item) {
      $('#detailMain').hide();
      $('#detailEmpty').show();
      currentItem = null;
      return;
    }
    currentItem = item;
    $('#detailMain').show();
    $('#detailEmpty').hide();
    renderAll(item);
  }

  function init() {
    if (typeof DeliveryAppointmentCommon === 'undefined') {
      window.alert('\u672a\u52a0\u8f7d\u9884\u7ea6\u9001\u4ed3\u6a21\u62df\u6570\u636e\u3002');
      return;
    }
    bindTabs();
    bindAudit();
    C.bindAppointmentStorageSync(loadAndRender);
    loadAndRender();
  }

  $(init);
})(jQuery);
