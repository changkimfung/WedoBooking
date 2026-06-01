(function () {
  'use strict';

  var subTabs = document.querySelectorAll('.sub-tab');
  var sidebarGroups = document.querySelectorAll('.sidebar-group');
  var sidebarItems = document.querySelectorAll('.sidebar-item');
  var panels = document.querySelectorAll('.content-panel');
  var groupTitles = document.querySelectorAll('.sidebar-group-title');

  /* ---- 二级分类切换 ---- */
  subTabs.forEach(function (tab) {
    tab.addEventListener('click', function () {
      var cat = tab.dataset.category;

      subTabs.forEach(function (t) { t.classList.remove('active'); });
      tab.classList.add('active');

      sidebarGroups.forEach(function (g) {
        g.style.display = g.dataset.category === cat ? '' : 'none';
      });

      var firstGroup = document.querySelector('.sidebar-group[data-category="' + cat + '"]');
      if (firstGroup) {
        var firstItem = firstGroup.querySelector('.sidebar-item');
        if (firstItem) activatePanel(firstItem.dataset.panel);
      }
    });
  });

  /* ---- 侧边栏导航 ---- */
  sidebarItems.forEach(function (item) {
    item.addEventListener('click', function (e) {
      e.preventDefault();
      activatePanel(item.dataset.panel);
    });
  });

  function activatePanel(panelId) {
    sidebarItems.forEach(function (i) { i.classList.remove('active'); });
    panels.forEach(function (p) { p.classList.remove('active'); });

    var activeItem = document.querySelector('.sidebar-item[data-panel="' + panelId + '"]');
    var activePanel = document.getElementById('panel-' + panelId);

    if (activeItem) activeItem.classList.add('active');
    if (activePanel) {
      activePanel.classList.add('active');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  /* ---- 侧边栏折叠 ---- */
  groupTitles.forEach(function (title) {
    title.addEventListener('click', function () {
      title.parentElement.classList.toggle('collapsed');
    });
  });

  /* ---- 顶栏导航（占位） ---- */
  document.querySelectorAll('.header-nav a').forEach(function (link) {
    link.addEventListener('click', function (e) {
      e.preventDefault();
      document.querySelectorAll('.header-nav a').forEach(function (l) { l.classList.remove('active'); });
      link.classList.add('active');
    });
  });

  /* ---- FAB ---- */
  document.querySelector('.fab').addEventListener('click', function () {
    alert('请在此处替换为你的联系方式，如邮箱或微信二维码。');
  });
})();
