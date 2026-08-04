(function () {
  var C = DeliveryAppointmentCommon;

  function getQueryId() {
    var m = window.location.search.match(/[?&]id=([^&]+)/);
    return m ? decodeURIComponent(m[1]) : '';
  }

  function formatContainerTypeDisplay(item) {
    return C.formatCell(item.containerType || item.containerSeq);
  }

  function isFclDelivery(item) {
    return String(item && item.deliveryType || '').trim() === '\u6574\u67dc';
  }

  function formatActualArrivalTime(item) {
    var wh = item.warehouse || '';
    return C.formatUsWarehouseTime(item.actualDeliveryTime, wh) !== '-'
      ? C.formatUsWarehouseTime(item.actualDeliveryTime, wh)
      : C.formatCell(item.actualDeliveryTime);
  }

  function renderInfoGrid(item) {
    var wh = item.warehouse || '';
    var fields = [
      ['预约仓库', item.warehouse],
      ['预约单号', C.formatCell(item.appointmentNo)],
      ['送仓码', C.formatDeliveryCodeCell(item)],
      ['状态', item.status],
      ['送仓类型', item.deliveryType],
      ['送仓总箱数', C.formatEstimatedCartons(item)],
      ['总体积（m³）', C.formatTotalVolume(item)],
      ['总重量（kg）', C.formatTotalWeight(item)],
      ['是否打托', C.formatPalletized(item)],
      ['送仓总托数', C.formatTotalPallets(item)]
    ];
    if (isFclDelivery(item)) {
      fields.push(
        ['集装箱号', C.formatCell(item.containerNo)],
        ['柜型', formatContainerTypeDisplay(item)]
      );
    }
    fields.push(
      ['货代联系邮箱', C.formatContactEmailsDisplay(item)],
      ['联系电话', C.formatFgContactPhone(item)],
      [C.localTimeFieldLabel('期望送仓日期', wh),
        C.formatExpectedInboundDatesDisplay(item, wh)],
      ['货代备注', C.formatCell(String(item.remark || '').trim())]
    );
    if (item.status === '\u9884\u7ea6\u5931\u8d25') {
      fields.push(['驳回原因', C.formatCell(String(item.rejectRemark || '').trim()), false, true]);
    }
    fields.push(
      [C.localTimeFieldLabel('实际到仓时间', wh), formatActualArrivalTime(item)],
      ['提交时间', C.formatCell(item.submitTime)],
      ['预约链接', C.isDeliveryCodePublished(item) ? C.buildBookingLinkHtml(item) : '-', true]
    );
    document.getElementById('detailInfo').innerHTML = fields.map(function (f) {
      var isDeliveryCode = f[0] === '送仓码';
      var isRejectReason = f[3] === true;
      var isHtml = f[2] === true;
      var cls = 'detail-item';
      if (isDeliveryCode) cls += ' detail-item--delivery-code';
      if (isRejectReason) cls += ' detail-item--reject-reason';
      var valueHtml = isHtml ? f[1] : String(f[1]);
      return '<div class="' + cls + '"><label>' + f[0] + '</label><span>' + valueHtml + '</span></div>';
    }).join('');
  }

  function bindDetailTabs() {
    var nav = document.getElementById('detailTabNav');
    if (!nav) return;
    nav.querySelectorAll('a[data-tab]').forEach(function (link) {
      link.addEventListener('click', function (e) {
        e.preventDefault();
        var tab = link.getAttribute('data-tab');
        nav.querySelectorAll('li').forEach(function (li) { li.classList.remove('active'); });
        link.parentElement.classList.add('active');
        document.querySelectorAll('.detail-tab-pane').forEach(function (pane) {
          pane.classList.remove('active');
        });
        if (tab === 'logs') document.getElementById('paneLogs').classList.add('active');
        else document.getElementById('paneInbound').classList.add('active');
      });
    });
  }

  function renderLogs(item) {
    var el = document.getElementById('detailLogList');
    if (!el) return;
    el.innerHTML = C.buildOperationLogListHtml(item, {
      portal: 'customer',
      sort: 'asc',
      emptyClass: 'detail-log-empty',
      timeClass: 'detail-log-time',
      roleClass: 'detail-log-role'
    });
  }

  function renderInbound(item) {
    var tbody = document.getElementById('detailInOrders');
    var orders = C.buildInboundDetailRows(item);
    if (!orders.length) {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:#9aacbf;">无关联入库单</td></tr>';
      return;
    }
    tbody.innerHTML = orders.map(function (row) {
      return '<tr><td>' + row.orderNo + '</td><td>' + row.status + '</td><td>' +
        row.warehouse + '</td><td>' + row.shippingMethod + '</td><td>' +
        (row.cartons != null ? row.cartons : '-') + '</td><td>' +
        (row.deliveryCartons != null ? row.deliveryCartons : '-') + '</td><td>' +
        row.createDate + '</td></tr>';
    }).join('');
  }

  function bindActions(item) {
    var actions = document.getElementById('detailActions');
    var ops = C.getOperationsByStatus(item.status).filter(function (a) { return a !== 'detail'; });
    actions.innerHTML = ops.map(function (action) {
      return '<button type="button" class="btn btn-primary" data-action="' + action + '">' +
        C.getOpLabel(action) + '</button>';
    }).join('');
    actions.querySelectorAll('[data-action]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var action = btn.getAttribute('data-action');
        if (action === 'edit') {
          window.location.href = 'deliveryAppointmentCreate.html?id=' + encodeURIComponent(item.id);
          return;
        }
        if (actionConfirm(action)) {
          var updated = C.applyStatusAction(item, action, { customerPortal: true });
          if (!updated) return;
          if (action === 'submit' && updated.status === '待预约') {
            C.submitAppointmentRecord(updated, function (err) {
              window.alert(C.submitSuccessMessage(err));
              loadDetail();
            });
            return;
          }
          C.updateAppointment(updated, false);
          window.alert('操作成功（原型）');
          loadDetail();
        }
      });
    });
  }

  function renderDetail(item) {
    renderInfoGrid(item);
    renderInbound(item);
    renderLogs(item);
    bindActions(item);
  }

  function actionConfirm(action) {
    if (action === 'submit') return window.confirm('确认提交该预约单？');
    if (action === 'discard') return window.confirm('确认废弃该预约单？');
    if (action === 'cancel') return window.confirm('确认取消预约？');
    return true;
  }

  function initMenu() {
    if (typeof ProductCommon !== 'undefined') {
      ProductCommon.initSidebarMenus();
      return;
    }
    document.getElementById('docManageBtn').addEventListener('click', function () {
      document.getElementById('docManageSubmenu').classList.toggle('show');
    });
  }

  function loadDetail() {
    var id = getQueryId();
    var item = C.getById(id, false);
    if (!item) {
      document.getElementById('detailPanel').style.display = 'none';
      document.getElementById('emptyPanel').style.display = 'block';
      return;
    }
    document.getElementById('detailPanel').style.display = '';
    document.getElementById('emptyPanel').style.display = 'none';
    renderDetail(item);
  }

  function init() {
    initMenu();
    bindDetailTabs();
    C.bindAppointmentStorageSync(loadDetail);
    loadDetail();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
