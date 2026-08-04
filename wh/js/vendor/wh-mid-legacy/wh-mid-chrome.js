/**
 * 仓储中台原型公用壳：一级顶栏 + 二级菜单
 */
(function (global) {
  'use strict';

  var TOP_MODULES = [
    { id: 'products', slug: 'products', label: '产品管理', href: '../wh/productInfo.html' },
    { id: 'documents', slug: 'documents', label: '单据管理', href: '../wh/inOrder.html' },
    { id: 'pricing', slug: 'pricing', label: '定价管理', href: '#' },
    { id: 'userCenter', slug: 'userCenter', label: '用户中心', href: '#' },
    { id: 'warehouse', slug: 'warehouse', label: '库存管理', href: '#' },
    { id: 'billing', slug: 'billing', label: '资金管理', href: '#' },
    { id: 'system', slug: 'system', label: '系统设置', href: '#' },
    { id: 'dashboard', slug: 'dashboard', label: '数据统计', href: '#' }
  ];

  var DOCUMENTS_SECOND_MENU = [
    { id: 'inboundMgmt', slug: 'inboundMgmt', label: '入库单管理', href: '../wh/inOrder.html' },
    { id: 'containerLoading', slug: 'containerLoading', label: '装柜清单管理', href: '../erp/containerLoading.html' },
    { id: 'deliveryAppointment', slug: 'deliveryAppointment', label: '预约送仓管理', href: '../wh/deliveryAppointment.html' },
    { id: 'outboundMgmt', slug: 'outboundMgmt', label: '出库单管理', href: '#' },
    { id: 'logisticsPlan', slug: 'logisticsPlan', label: '物流计划管理', href: '#' },
    { id: 'valueAddedService', slug: 'valueAddedService', label: '增值服务单管理', href: '#' },
    { id: 'returnOrderList', slug: 'returnOrderList', label: '退货单管理', href: '#' },
    { id: 'asnList', slug: 'asnList', label: '入库预报', href: '#' }
  ];

  var PRODUCTS_SECOND_MENU = [
    { id: 'productInfo', slug: 'productInfo', label: '产品信息', href: '../wh/productInfo.html' },
    { id: 'brandAuthorization', slug: 'brandAuthorization', label: '品牌授权文件管理', href: '../wh/brandAuthorization.html' },
    { id: 'logisticsMgmt', slug: 'logisticsMgmt', label: '物流管理', href: '#' },
    { id: 'minDeclarePrice', slug: 'minDeclarePrice', label: '最低申报价设置', href: '#' },
    { id: 'productTaxRate', slug: 'productTaxRate', label: '产品税率调整', href: '#' },
    { id: 'fnskuMapping', slug: 'fnskuMapping', label: 'FNSKU映射', href: '#' },
    { id: 'shelfMgmt', slug: 'shelfMgmt', label: '货架管理', href: '#' },
    { id: 'productMeasureAudit', slug: 'productMeasureAudit', label: '产品测量审核', href: '#' }
  ];

  var SECOND_MENU = DOCUMENTS_SECOND_MENU;

  function escapeHtml(s) {
    if (s == null || s === '') return '';
    var div = document.createElement('div');
    div.textContent = s;
    return div.innerHTML;
  }

  function buildTopNav(opts) {
    var activeTop = opts.activeTopModule || 'documents';
    var userName = escapeHtml(opts.userName || '演示用户');
    var brandTitle = escapeHtml(opts.brandTitle != null ? opts.brandTitle : '仓储中台');

    var modLis = TOP_MODULES.map(function (m) {
      var isActive = m.slug === activeTop;
      var cls = isActive ? ' class="wh-mid-nav-active"' : '';
      return '<li><a href="' + escapeHtml(m.href) + '"' + cls + '>' + escapeHtml(m.label) + '</a></li>';
    }).join('');

    return (
      '<div class="wh-mid-header">' +
        '<div class="wh-mid-header-inner">' +
          '<div class="wh-mid-brand">' + brandTitle + '</div>' +
          '<ul class="wh-mid-onevar">' + modLis + '</ul>' +
          '<div class="wh-mid-user wh-mid-user-legacy">' +
            '<a href="#" onclick="return false;" class="wh-mid-user-link">消息</a>' +
            '<span class="wh-mid-user-name">' + userName + '</span>' +
            '<a href="#" onclick="return false;" class="wh-mid-user-link">退出</a>' +
          '</div>' +
        '</div>' +
      '</div>'
    );
  }

  function getSecondMenuForModule(topModule) {
    if (topModule === 'products') return PRODUCTS_SECOND_MENU;
    return DOCUMENTS_SECOND_MENU;
  }

  function buildSecondNav(opts) {
    var activeTop = opts.activeTopModule || 'documents';
    var menuItems = getSecondMenuForModule(activeTop);
    var active = opts.activeSecondMenu || (activeTop === 'products' ? 'productInfo' : 'inboundMgmt');
    var lis = menuItems.map(function (item) {
      var isActive = item.slug === active;
      var cls = isActive ? ' class="wh-mid-sub-active"' : '';
      return '<li><a href="' + escapeHtml(item.href) + '"' + cls + '>' + escapeHtml(item.label) + '</a></li>';
    }).join('');

    return (
      '<div class="wh-mid-twovar">' +
        '<ul>' + lis + '</ul>' +
      '</div>'
    );
  }

  function resolveContainer(elOrSelector) {
    if (!elOrSelector) return document.getElementById('wedo-wh-mid-chrome-header');
    if (typeof elOrSelector === 'string') return document.querySelector(elOrSelector);
    return elOrSelector;
  }

  global.WedoWhMidChrome = {
    mountHeader: function (elOrSelector, options) {
      var container = resolveContainer(elOrSelector);
      if (!container) return;
      var opts = options || {};
      container.innerHTML =
        '<div class="wh-mid-chrome-wrap">' +
          buildTopNav(opts) +
          buildSecondNav(opts) +
        '</div>';
    },
    TOP_MODULES: TOP_MODULES,
    SECOND_MENU: SECOND_MENU,
    DOCUMENTS_SECOND_MENU: DOCUMENTS_SECOND_MENU,
    PRODUCTS_SECOND_MENU: PRODUCTS_SECOND_MENU
  };
})(typeof window !== 'undefined' ? window : this);
