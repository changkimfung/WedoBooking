/**

 * 海外仓 · Web 签收处理（列表批量 / 详情单条，共用多行弹窗）

 */

(function ($) {

  'use strict';



  var C = DeliveryAppointmentCommon;

  var batchRows = [];

  var onSuccessCb = null;

  var getSelectedItemsFn = null;



  function escapeHtml(s) {

    if (s == null || s === '') return '';

    return String(s)

      .replace(/&/g, '&amp;')

      .replace(/</g, '&lt;')

      .replace(/>/g, '&gt;')

      .replace(/"/g, '&quot;');

  }



  function showError(msg) {

    var $el = $('#signOffFormError');

    if (!msg) {

      $el.hide().text('');

      return;

    }

    $el.text(msg).show();

  }



  function renderRowPhotos(row) {

    var $host = $('#signOffPhotos-' + row.id);

    if (!$host.length) return;

    if (!row.photos.length) {

      $host.html('<span class="recv-signoff-photo-empty">未上传</span>');

      return;

    }

    $host.html(row.photos.map(function (p, idx) {

      return '<div class="recv-signoff-photo-item">' +

        '<img src="' + escapeHtml(p.url) + '" alt="\u7b7e\u6536\u6587\u4ef6' + (idx + 1) + '">' +

        '<button type="button" class="recv-signoff-photo-del" data-row="' + escapeHtml(row.id) +

        '" data-idx="' + idx + '">\u5220</button></div>';

    }).join(''));

  }



  function findRow(rowId) {

    for (var i = 0; i < batchRows.length; i++) {

      if (batchRows[i].id === rowId) return batchRows[i];

    }

    return null;

  }



  function addPhotoFiles(row, files) {

    if (!row || !files || !files.length) return;

    var remain = files.length;

    for (var i = 0; i < files.length; i++) {

      (function (file) {

        if (!file.type || file.type.indexOf('image/') !== 0) {

          remain--;

          if (remain <= 0) renderRowPhotos(row);

          return;

        }

        var rd = new FileReader();

        rd.onload = function () {

          if (typeof rd.result === 'string') {

            row.photos.push({ url: rd.result, name: file.name || '\u7b7e\u6536\u6587\u4ef6' });

          }

          remain--;

          if (remain <= 0) renderRowPhotos(row);

        };

        rd.onerror = function () {

          remain--;

          if (remain <= 0) renderRowPhotos(row);

        };

        rd.readAsDataURL(file);

      })(files[i]);

    }

  }



  function buildRowState(item) {

    return {

      id: item.id,

      item: item,

      photos: []

    };

  }



  function renderBatchTable(items) {

    batchRows = items.map(buildRowState);

    var defaultTime = C.toDatetimeLocalInputValue(C.formatNow());

    var html = batchRows.map(function (row) {

      var it = row.item;

      var cartons = it.receivedCartons != null && it.receivedCartons !== '' ? it.receivedCartons : '';

      var pallets = it.receivedPallets != null && it.receivedPallets !== '' ? it.receivedPallets : '';

      var actualTime = (C.isUsSignOffContentUpdate && C.isUsSignOffContentUpdate(it) && it.actualDeliveryTime)
        ? C.toDatetimeLocalInputValue(it.actualDeliveryTime)
        : defaultTime;

      return '<tr data-row-id="' + escapeHtml(row.id) + '">' +

        '<td class="recv-signoff-batch-readonly">' + escapeHtml(it.appointmentNo || '-') + '</td>' +

        '<td class="recv-signoff-batch-readonly">' + escapeHtml(it.deliveryCode || '-') + '</td>' +

        '<td class="recv-signoff-batch-readonly">' + escapeHtml(it.status || '-') + '</td>' +

        '<td><input type="number" class="signoff-cartons" min="1" step="1" value="' + escapeHtml(cartons) +

          '" placeholder="\u9009\u586b" /></td>' +

        '<td><input type="number" class="signoff-pallets" min="1" step="1" value="' + escapeHtml(pallets) +

          '" placeholder="\u9009\u586b" /></td>' +

        '<td><input type="datetime-local" class="signoff-actual-time" step="60" value="' + escapeHtml(actualTime) + '" /></td>' +

        '<td>' +

          '<input type="file" class="signoff-photo-input" accept="image/*" multiple />' +

          '<div class="recv-signoff-photo-list" id="signOffPhotos-' + escapeHtml(row.id) + '">' +

            '<span class="recv-signoff-photo-empty">\u672a\u4e0a\u4f20</span></div>' +

        '</td>' +

        '</tr>';

    }).join('');

    $('#signOffBatchBody').html(html);

    batchRows.forEach(renderRowPhotos);

  }



  function readRowPayload($tr, row) {

    return {

      actualDeliveryTime: $tr.find('.signoff-actual-time').val(),

      receivedCartons: ($tr.find('.signoff-cartons').val() || '').trim(),

      receivedPallets: ($tr.find('.signoff-pallets').val() || '').trim(),

      photoPayloads: row.photos.slice(),

      remark: ''

    };

  }



  function closeModal() {

    $('#signOffModalBackdrop').hide();

    batchRows = [];

    $('#signOffBatchBody').empty();

    showError('');

  }



  function openBatch(items) {

    var list = (items || []).filter(C.isEligibleForUsSignOff);

    if (!list.length) {

      window.alert('\u8bf7\u5148\u52fe\u9009\u72b6\u6001\u4e3a\u300c\u5f85\u9001\u4ed3\u300d\u6216\u300c\u5df2\u9001\u4ed3\u300d\u7684\u9884\u7ea6\u5355');

      return;

    }

    var skipped = (items || []).length - list.length;

    if (skipped) {

      window.alert('\u5df2\u8df3\u8fc7 ' + skipped + ' \u6761\u4e0d\u53ef\u7b7e\u6536/\u66f4\u65b0\u7684\u9009\u4e2d\u9879');

    }

    showError('');

    renderBatchTable(list);

    var allUpdate = list.every(C.isUsSignOffContentUpdate);
    $('#signOffModalSubmit').text(
      list.length > 1
        ? (allUpdate ? '\u6279\u91cf\u4fdd\u5b58\u7b7e\u6536\u66f4\u65b0' : '\u6279\u91cf\u63d0\u4ea4\u7b7e\u6536')
        : (allUpdate ? '\u4fdd\u5b58\u7b7e\u6536\u66f4\u65b0' : '\u63d0\u4ea4\u7b7e\u6536')
    );

    $('#signOffModalBackdrop').css('display', 'flex');

  }



  function openForItem(item) {

    if (!item) return;

    if (!C.isEligibleForUsSignOff(item)) {

      var check = C.validateUsReceivingSignOff(item, { actualDeliveryTime: C.formatNow() });

      window.alert(check.ok ? '\u4e0d\u53ef\u7b7e\u6536' : check.msg);

      return;

    }

    openBatch([item]);

  }



  function submitSignOff() {

    if (!batchRows.length) return;

    var entries = [];

    var errors = [];

    batchRows.forEach(function (row) {

      var $tr = $('#signOffBatchBody tr[data-row-id="' + row.id + '"]');

      if (!$tr.length) return;

      var payload = readRowPayload($tr, row);

      var validation = C.validateUsReceivingSignOff(row.item, payload);

      if (!validation.ok) {

        errors.push((row.item.appointmentNo || row.id) + '\uff1a' + validation.msg);

        return;

      }

      entries.push({ item: row.item, opts: payload });

    });

    if (errors.length) {

      showError(errors.join('\n'));

      return;

    }

    if (!entries.length) {

      showError('\u65e0\u53ef\u63d0\u4ea4\u7684\u9884\u7ea6\u5355');

      return;

    }

    var updateCount = entries.filter(function (e) {
      return C.isUsSignOffContentUpdate(e.item);
    }).length;
    var $btn = $('#signOffModalSubmit').prop('disabled', true);

    C.submitUsReceivingSignOffBatch(entries, function (err, updated) {

      $btn.prop('disabled', false);

      if (!updated || !updated.length) {

        showError((err && err.message) || '\u63d0\u4ea4\u5931\u8d25');

        return;

      }

      closeModal();

      var hint;
      if (updateCount === entries.length) {
        hint = '\u5df2\u4fdd\u5b58 ' + updated.length + ' \u6761\u7b7e\u6536\u66f4\u65b0';
      } else if (!updateCount) {
        hint = '\u5df2\u5b8c\u6210 ' + updated.length + ' \u6761\u7b7e\u6536\uff0c\u72b6\u6001\u5df2\u53d8\u66f4\u4e3a\u5df2\u9001\u4ed3';
      } else {
        hint = '\u5df2\u5b8c\u6210 ' + updated.length + ' \u6761\u7b7e\u6536\u5904\u7406';
      }
      var msg = C.persistSuccessMessage(err, hint);

      window.alert(msg);

      if (typeof onSuccessCb === 'function') onSuccessCb(updated);

    });

  }



  function bindModal() {

    $('#signOffModalClose,#signOffModalCancel').on('click', closeModal);

    $('#signOffModalBackdrop').on('click', function (e) {

      if (e.target === this) closeModal();

    });

    $('#signOffModalSubmit').on('click', submitSignOff);

    $('#signOffBatchBody')

      .on('change', '.signoff-photo-input', function () {

        var rowId = $(this).closest('tr').attr('data-row-id');

        var row = findRow(rowId);

        if (row) addPhotoFiles(row, this.files);

        this.value = '';

      })

      .on('click', '.recv-signoff-photo-del', function () {

        var rowId = $(this).attr('data-row');

        var idx = parseInt($(this).attr('data-idx'), 10);

        var row = findRow(rowId);

        if (row && !isNaN(idx)) {

          row.photos.splice(idx, 1);

          renderRowPhotos(row);

        }

      });

  }



  function init(options) {

    options = options || {};

    onSuccessCb = options.onSuccess || null;

    getSelectedItemsFn = options.getSelectedItems || null;



    if (options.batchBtn) {

      $(options.batchBtn).on('click', function () {

        var items = typeof getSelectedItemsFn === 'function'

          ? getSelectedItemsFn()

          : [];

        openBatch(items);

      });

    }

    if (options.detailBtn) {

      $(options.detailBtn).on('click', function () {

        var item = typeof options.getCurrentItem === 'function' ? options.getCurrentItem() : null;

        if (!item) return;

        openForItem(item);

      });

    }

    bindModal();

  }



  window.UsRecvAppointmentSignOff = {

    init: init,

    openForItem: openForItem,

    openBatch: openBatch,

    STATUS_PENDING_DELIVERY: '\u5f85\u9001\u4ed3'

  };

})(jQuery);

