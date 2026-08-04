/**

 * 海外仓 · 入库预约审核弹窗（列表/详情共用）

 * - initial：仓库待审核 → 客户待确认

 * - update：客户待确认下更新审核数据并重发确认邮件

 */

(function ($) {

  'use strict';



  var C = DeliveryAppointmentCommon;

  var STATUS_WH_PENDING = '\u4ed3\u5e93\u5f85\u5ba1\u6838';

  var STATUS_CUSTOMER_PENDING = '\u5ba2\u6237\u5f85\u786e\u8ba4';

  var auditItem = null;

  var auditMode = 'initial';

  var onSuccessCb = null;



  function pickDatePart(str) {

    if (!str) return '';

    var m = String(str).trim().match(/^(\d{4})-(\d{2})-(\d{2})/);

    return m ? (m[1] + '-' + m[2] + '-' + m[3]) : '';

  }



  function updateWhAddress() {

    var wh = C.findUsWarehouseById($('#auditWarehouse').val());

    $('#auditWhAddress').text(wh ? wh.address : '');

  }



  function getAuditDecision() {

    return $('input[name="auditDecision"]:checked').val() || 'confirm';

  }



  function syncAuditPanels() {

    if (auditMode === 'update') {

      $('#auditPanelWh').show();

      $('#auditPanelReject').hide();

      $('#auditFormError').hide().text('');

      return;

    }

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



  function syncAuditModalChrome() {

    if (auditMode === 'update') {

      $('#auditModalTitle').text('\u66f4\u65b0\u5ba1\u6838\u6570\u636e');

      $('#auditModalTip').text(

        '\u5ba2\u6237\u5c1a\u672a\u786e\u8ba4\u65f6\u6bb5\u3002\u53ef\u4fee\u6539\u4ed3\u5e93\u786e\u8ba4\u65f6\u6bb5\u4e0e\u5907\u6ce8\uff0c\u63d0\u4ea4\u540e\u5c06\u91cd\u53d1\u8d27\u4ee3\u786e\u8ba4\u90ae\u4ef6\uff0c\u72b6\u6001\u4ecd\u4e3a\u300c\u5ba2\u6237\u5f85\u786e\u8ba4\u300d\u3002'

      );

      $('#auditPanelDecision').hide();

      $('#auditModalSubmit').text('\u66f4\u65b0\u5e76\u91cd\u53d1\u786e\u8ba4\u90ae\u4ef6');

    } else {

      $('#auditModalTitle').text('\u9884\u7ea6\u786e\u8ba4');

      $('#auditModalTip').text(

        '\u65e0\u8bba\u786e\u8ba4\u65f6\u6bb5\u662f\u5426\u4e0e\u5ba2\u6237\u671f\u671b\u65e5\u671f\u4e00\u81f4\uff0c\u63d0\u4ea4\u540e\u9884\u7ea6\u5355\u90fd\u4f1a\u56de\u5230\u300c\u5ba2\u6237\u5f85\u786e\u8ba4\u300d\u7531\u5ba2\u6237\u6700\u7ec8\u62cd\u677f\u3002'

      );

      $('#auditPanelDecision').show();

      $('#auditModalSubmit').text('\u63d0\u4ea4');

    }

  }



  function initAuditWarehouseSelect(item) {

    var $sel = $('#auditWarehouse').empty();

    C.getUsWarehouseOptions().forEach(function (wh) {

      $sel.append($('<option></option>').val(wh.id).text(wh.name));

    });

    var whId = 'us-west-ca91761';

    if (item && C.findUsWarehouseByName) {

      var matched = C.findUsWarehouseByName(item.confirmedWarehouse || item.warehouse);

      if (matched) whId = matched.id;

    }

    $sel.val(whId);

    updateWhAddress();

  }



  function resetAuditForm(item, mode) {

    auditMode = mode || 'initial';

    $('input[name="auditDecision"][value="confirm"]').prop('checked', true);

    $('#auditRemarkOptional,#auditRemarkReject').val('');

    initAuditWarehouseSelect(item);

    var wh = item.warehouse || '';

    var expected = C.formatExpectedInboundDatesDisplay(item, wh);

    $('#auditExpectedTime').text(expected || '-');

    $('#auditCustomerRemark').text(String(item.remark || '').trim() || '-');



    if (auditMode === 'update') {

      var slot = C.parseWarehouseSlot(item.warehouseConfirmedInboundTime);

      if (slot.date) $('#auditSlotDate').val(slot.date);

      if (slot.startHHMM) $('#auditSlotStart').val(slot.startHHMM);

      if (slot.endHHMM) $('#auditSlotEnd').val(slot.endHHMM);

      $('#auditRemarkOptional').val(String(item.auditRemark || '').trim());

    } else {

      $('#auditSlotStart,#auditSlotEnd,#auditSlotDate').val('');

      var expectedDates = C.getExpectedInboundDates ? C.getExpectedInboundDates(item) : [];

      var expectedDate = expectedDates.length ? expectedDates[0] : pickDatePart(item.expectedInboundTime);

      if (expectedDate) $('#auditSlotDate').val(expectedDate);

      $('#auditSlotStart').val('09:00');

      $('#auditSlotEnd').val('12:00');

    }



    syncAuditModalChrome();

    syncAuditPanels();

  }



  function closeAuditModal() {

    $('#auditModalBackdrop').hide();

    $('#auditFormError').hide().text('');

    auditItem = null;

    auditMode = 'initial';

  }



  function showAuditError(msg) {

    $('#auditFormError').text(msg).show();

  }



  function validateAndBuildPayload() {

    if (auditMode === 'update' || getAuditDecision() === 'confirm') {

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

      return {

        decision: 'confirm',

        warehouseId: warehouseId,

        slotDate: slotDate,

        slotStartHHMM: slotStart,

        slotEndHHMM: slotEnd,

        remark: $('#auditRemarkOptional').val().trim()

      };

    }

    var rejectRemark = $('#auditRemarkReject').val().trim();

    if (rejectRemark.length < 5) {

      showAuditError('\u62d2\u6536\u539f\u56e0\u9700\u81f3\u5c11 5 \u5b57\u7b26');

      return null;

    }

    return { decision: 'reject', remark: rejectRemark };

  }



  function statusMessage(payload) {

    if (auditMode === 'update') {

      return '\u5ba1\u6838\u6570\u636e\u5df2\u66f4\u65b0\uff0c\u5df2\u5411\u8d27\u4ee3\u91cd\u53d1\u786e\u8ba4\u90ae\u4ef6\uff0c\u72b6\u6001\u4ecd\u4e3a\u5ba2\u6237\u5f85\u786e\u8ba4\u3002';

    }

    if (payload.decision === 'reject') return '\u5df2\u62d2\u6536\uff0c\u72b6\u6001\u5df2\u53d8\u66f4\u4e3a\u9884\u7ea6\u5931\u8d25\u3002';

    return '\u786e\u8ba4\u65f6\u6bb5\u5df2\u63d0\u4ea4\uff0c\u72b6\u6001\u5df2\u53d8\u66f4\u4e3a\u5ba2\u6237\u5f85\u786e\u8ba4\uff0c\u7b49\u5f85\u5ba2\u6237\u62cd\u677f\u3002';

  }



  function submitAudit() {

    if (!auditItem) return;

    var payload = validateAndBuildPayload();

    if (!payload) return;

    var item = auditItem;

    var $btn = $('#auditModalSubmit').prop('disabled', true);

    var submitFn = auditMode === 'update' ? C.submitReceivingAuditUpdate : C.submitReceivingAudit;

    submitFn(item, payload, function (err, updated) {

      $btn.prop('disabled', false);

      if (!updated) {

        showAuditError('\u63d0\u4ea4\u5931\u8d25\uff0c\u8bf7\u68c0\u67e5\u5fc5\u586b\u9879\u540e\u91cd\u8bd5\u3002');

        return;

      }

      closeAuditModal();

      var msg = C.persistSuccessMessage(err, statusMessage(payload));

      window.alert(msg);

      if (typeof onSuccessCb === 'function') {

        onSuccessCb(updated, payload);

      }

    });

  }



  function openForItem(item, mode) {

    mode = mode || 'initial';

    if (!item) return;

    if (mode === 'update' && item.status !== STATUS_CUSTOMER_PENDING) return;

    if (mode === 'initial' && item.status !== STATUS_WH_PENDING) return;

    auditItem = item;

    resetAuditForm(item, mode);

    $('#auditModalBackdrop').show();

  }



  function openUpdateForItem(item) {

    openForItem(item, 'update');

  }



  function bindAuditUi(options) {

    options = options || {};

    onSuccessCb = options.onSuccess || null;



    if (options.detailBtn) {

      $(options.detailBtn).on('click', function () {

        if (options.getCurrentItem) openForItem(options.getCurrentItem(), 'initial');

      });

    }

    if (options.detailUpdateBtn) {

      $(options.detailUpdateBtn).on('click', function () {

        if (options.getCurrentItem) openUpdateForItem(options.getCurrentItem());

      });

    }



    $('#auditModalClose,#auditModalCancel').on('click', closeAuditModal);

    $('#auditModalBackdrop').on('click', function (e) {

      if (e.target === this) closeAuditModal();

    });

    $('input[name="auditDecision"]').on('change', syncAuditPanels);

    $('#auditWarehouse').on('change', updateWhAddress);

    $('#auditModalSubmit').on('click', submitAudit);

  }



  window.UsRecvAppointmentAudit = {

    STATUS_WH_PENDING: STATUS_WH_PENDING,

    STATUS_CUSTOMER_PENDING: STATUS_CUSTOMER_PENDING,

    init: bindAuditUi,

    openForItem: openForItem,

    openUpdateForItem: openUpdateForItem,

    close: closeAuditModal

  };

})(jQuery);

