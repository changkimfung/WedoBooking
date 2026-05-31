/**
 * 海外仓 PDA 公共：顶栏菜单
 */
(function () {
  function bindMenu() {
    var btn = document.getElementById('pda-menu-btn');
    var list = document.getElementById('pda-menu-list');
    if (!btn || !list) return;

    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      if (list.hasAttribute('hidden')) list.removeAttribute('hidden');
      else list.setAttribute('hidden', '');
    });

    document.addEventListener('click', function () {
      list.setAttribute('hidden', '');
    });

    list.addEventListener('click', function (e) {
      e.stopPropagation();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bindMenu);
  } else {
    bindMenu();
  }
})();
