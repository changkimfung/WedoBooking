/**
 * 海外仓老站（Bootstrap2）公用顶栏：一级导航 + 订单模块二级 menu_two
 * 页面在引用 jQuery、Bootstrap JS 之后加载本文件，再调用 mountHeader 或 autoMount。
 *
 * 用法一（推荐）：
 *   <div id="wedo-overseas-chrome-header"></div>
 *   <script>
 *     WedoOverseasChrome.mountHeader(document.getElementById('wedo-overseas-chrome-header'), {
 *       activeSecondMenu: 'orderReturnRecord',
 *       assetsRoot: '../../'
 *     });
 *   </script>
 *
 * 用法二（data 属性自动挂载，需在脚本末尾调用一次）：
 *   <div id="wedo-overseas-chrome-header"
 *        data-active-second="orderReturnRecord"
 *        data-assets-root="../../"
 *        data-user-name="演示用户"></div>
 *   <script>WedoOverseasChrome.autoMount();</script>
 */
(function (global) {
  'use strict';

  var DEMO_HTML = '/_demo/Html/OverseasWarehouse/';

  var SECOND_MENU = [
    { id: 'orderIndex', slug: 'orderIndex', label: '订单列表', href: '#' },
    { id: 'orderMoveLog', slug: 'orderMoveLog', label: '订单移动日志', href: '#' },
    { id: 'orderReturn', slug: 'orderReturn', label: '订单退货', href: '#' },
    { id: 'orderReturnRecord', slug: 'orderReturnRecord', label: '退货记录列表', href: DEMO_HTML + 'order-return-record-prototype.html' },
    { id: 'unclaimedOwnerlessList', slug: 'unclaimedOwnerlessList', label: '无主待认领列表', href: DEMO_HTML + 'unclaimed-ownerless-list.html' },
    { id: 'receivingAppointmentMgmt', slug: 'receivingAppointmentMgmt', label: '入库预约管理', href: '/us/receiving-appointment.html' },
    { id: 'pdaReceivingScan', slug: 'pdaReceivingScan', label: 'PDA收货扫描', href: '/us/pda-receiving-scan.html' },
    { id: 'outOrderList', slug: 'outOrderList', label: '发货复核', href: '/us/outOrder.html' },
    { id: 'pdaShipCheck', slug: 'pdaShipCheck', label: 'PDA发货复核', href: '/us/pda-ship-check.html' },
    { id: 'accountManage', slug: 'accountManage', label: '账号邮箱管理', href: '#' },
    { id: 'invoiceManage', slug: 'invoiceManage', label: '发票邮件管理', href: '#' },
    { id: 'skuShipCostExport', slug: 'skuShipCostExport', label: '运费报表导出', href: '#' },
    { id: 'platformManage', slug: 'platformManage', label: '平台管理', href: '#' },
    { id: 'refundRecord', slug: 'refundRecord', label: '退款记录', href: '#' },
    { id: 'transitTrack', slug: 'transitTrack', label: '中转查询', href: '#' }
  ];

  var TOP_WAREHOUSES = [
    { label: '美西仓', href: '#' },
    { label: '美中仓', href: '#' },
    { label: '美东仓', href: '#' }
  ];

  var TOP_MODULES = [
    { label: '订单管理', href: '#' },
    { label: '库存管理', href: '#' },
    { label: '收货管理', href: '#' },
    { label: '出库管理', href: '#' },
    { label: '仓库设置', href: '#' },
    { label: '系统管理', href: '#' }
  ];

  function escapeHtml(s) {
    if (s == null || s === '') return '';
    var div = document.createElement('div');
    div.textContent = s;
    return div.innerHTML;
  }

  function normalizeAssetsRoot(root) {
    if (root == null || root === '') return 'css/vendor/';
    var r = String(root);
    return r.slice(-1) === '/' ? r : r + '/';
  }

  function buildTopNav(opts) {
    var assetsRoot = normalizeAssetsRoot(opts.assetsRoot);
    var logoSrc = assetsRoot + 'img/logo.png';
    var userName = escapeHtml(opts.userName || '演示用户');
    var whIdx = typeof opts.activeWarehouseIndex === 'number' ? opts.activeWarehouseIndex : 0;

    var whLis = TOP_WAREHOUSES.map(function (w, i) {
      var style = i === whIdx ? ' style="color: white;"' : '';
      return '<li><a href="' + escapeHtml(w.href) + '"' + style + '>' + escapeHtml(w.label) + '</a></li>';
    }).join('');

    var modLis = TOP_MODULES.map(function (m) {
      return '<li><a href="' + escapeHtml(m.href) + '">' + escapeHtml(m.label) + '</a></li>';
    }).join('');

    return (
      '<div class="navbar navbar-fixed-top navbar-inverse">' +
        '<div class="navbar-inner">' +
          '<div class="container-fluid">' +
            '<a class="brand" href="#">' +
              '<span>' +
                '<img class="AngularJS-small" src="' + escapeHtml(logoSrc) + '" style="height:20px;" alt="">' +
                '海外仓系统' +
              '</span>' +
            '</a>' +
            '<ul class="nav" id="nav">' + whLis + modLis + '</ul>' +
            '<div class="pull-right">' +
              '<ul class="nav pull-right">' +
                '<li class="dropdown">' +
                  '<a href="#" class="dropdown-toggle" data-toggle="dropdown">' +
                    '<i class="icon-user icon-white"></i> ' + userName + '<b class="caret"></b>' +
                  '</a>' +
                  '<ul class="dropdown-menu">' +
                    '<li><a href="#"><i class="icon-cog"></i> 设置</a></li>' +
                    '<li class="divider"></li>' +
                    '<li><a href="#"><i class="icon-off"></i> 注销</a></li>' +
                  '</ul>' +
                '</li>' +
              '</ul>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</div>'
    );
  }

  function buildSecondNav(opts) {
    var active = opts.activeSecondMenu || 'orderReturnRecord';
    var lis = SECOND_MENU.map(function (item) {
      var isActive = item.slug === active;
      var cls = isActive ? ' class="active_menu2"' : '';
      return '<li id="menu2-' + escapeHtml(item.id) + '"' + cls + '><a href="' + escapeHtml(item.href) + '">' + escapeHtml(item.label) + '</a></li>';
    }).join('');

    return (
      '<div class="container-fluid conter_menu">' +
        '<div class="subnav mywell">' +
          '<ul class="nav nav-pills menu_two" id="second_menu">' + lis + '</ul>' +
        '</div>' +
      '</div>'
    );
  }

  /**
   * 将一级顶栏 + 二级订单菜单渲染到容器（清空容器后写入）。
   * @param {HTMLElement|null} container
   * @param {Object} [options]
   * @param {string} [options.activeSecondMenu] SECOND_MENU 某项 slug，默认 orderReturnRecord
   * @param {number} [options.activeWarehouseIndex] 高亮仓库项下标（白字），默认 0
   * @param {string} [options.userName] 右上角用户名
   * @param {string} [options.assetsRoot] 静态资源根，默认 ../../ （相对 Html/OverseasWarehouse 一页 deep）
   */
  function mountHeader(container, options) {
    var opts = options || {};
    if (!container) return;
    container.innerHTML = buildTopNav(opts) + buildSecondNav(opts);
  }

  function resolveContainer(elOrSelector) {
    if (!elOrSelector) return document.getElementById('wedo-overseas-chrome-header');
    if (typeof elOrSelector === 'string') return document.querySelector(elOrSelector);
    return elOrSelector;
  }

  /**
   * 从 #wedo-overseas-chrome-header 或带 data-wedo-chrome 的元素读取 data-* 并挂载。
   */
  function autoMount() {
    var el = document.getElementById('wedo-overseas-chrome-header') ||
      document.querySelector('[data-wedo-chrome-header]');
    if (!el) return;
    var userAttr = el.getAttribute('data-user-name');
    mountHeader(el, {
      activeSecondMenu: el.getAttribute('data-active-second') || 'orderReturnRecord',
      activeWarehouseIndex: parseInt(el.getAttribute('data-warehouse-index') || '0', 10),
      userName: userAttr != null && userAttr !== '' ? userAttr : undefined,
      assetsRoot: el.getAttribute('data-assets-root') || '../../'
    });
  }

  var api = {
    mountHeader: function (elOrSelector, options) {
      mountHeader(resolveContainer(elOrSelector), options || {});
    },
    autoMount: autoMount,
    SECOND_MENU: SECOND_MENU,
    TOP_WAREHOUSES: TOP_WAREHOUSES,
    TOP_MODULES: TOP_MODULES
  };

  global.WedoOverseasChrome = api;
})(typeof window !== 'undefined' ? window : this);
