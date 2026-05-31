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

  function renderInfoGrid(item) {
    var fields = [
      ['预约仓库', item.warehouse],
      ['预约单号', C.formatCell(item.appointmentNo)],
      ['送仓码', C.formatCell(item.deliveryCode)],
      ['状态', item.status],
      ['送仓类型', item.deliveryType],
      ['送仓总箱数', C.formatEstimatedCartons(item)],
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
      ['货代公司', C.formatCell(item.forwarder)],
      ['联系邮箱', (item.emails || []).join('、') || '-'],
      ['期望送仓日期', C.formatCell(item.expectedInboundTime)],
      ['货代备注', C.formatCell(String(item.remark || '').trim())],
      ['仓库确认时段', C.formatCell(item.warehouseConfirmedInboundTime)],
      ['仓库审核备注', C.formatCell(String(item.auditRemark || '').trim())],
      ['实际送仓时间', C.formatCell(item.actualDeliveryTime)],
      ['提交时间', C.formatCell(item.submitTime)],
      ['预约链接', C.buildBookingLinkHtml(item), true]
    );
    document.getElementById('detailInfo').innerHTML = fields.map(function (f) {
      var isDeliveryCode = f[0] === '送仓码';
      var isHtml = f[2] === true;
      var cls = 'detail-item' + (isDeliveryCode ? ' detail-item--delivery-code' : '');
      var valueHtml = isHtml ? f[1] : String(f[1]);
      return '<div class="' + cls + '"><label>' + f[0] + '</label><span>' + valueHtml + '</span></div>';
    }).join('');
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

  function renderLogs(item) {
    document.getElementById('logList').innerHTML = C.buildOperationLogListHtml(item, {
      emptyClass: 'detail-log-empty',
      timeClass: 'detail-log-time'
    });
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
          var updated = C.applyStatusAction(item, action);
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

  function bindTabs() {
    var nav = document.getElementById('detailTabs');
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
        if (tab === 'logs') {
          document.getElementById('paneLogs').classList.add('active');
        } else {
          document.getElementById('paneInbound').classList.add('active');
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
    bindTabs();
    C.bindAppointmentStorageSync(loadDetail);
    loadDetail();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
