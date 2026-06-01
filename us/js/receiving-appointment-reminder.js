/**
 * 海外仓 · 入库预约列表 · 右下角站内提醒
 */
(function () {
  'use strict';

  var SESSION_COLLAPSED_KEY = 'us_recv_reminder_collapsed';
  var C = typeof DeliveryAppointmentCommon !== 'undefined' ? DeliveryAppointmentCommon : null;

  function escapeHtml(s) {
    if (s == null || s === '') return '';
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function getStats() {
    if (!C || !C.getReceivingReminderStats) {
      return { whPending: 0, timeout: 0, weekPendingDelivery: 0, weekRangeLabel: '' };
    }
    return C.getReceivingReminderStats(new Date());
  }

  function totalAlerts(stats) {
    return (stats.whPending || 0) + (stats.timeout || 0) + (stats.weekPendingDelivery || 0);
  }

  function renderRows(stats) {
    var rows = [
      {
        key: 'wh_pending',
        label: '待审核',
        count: stats.whPending,
        countClass: 'us-recv-reminder-count--danger'
      },
      {
        key: 'timeout',
        label: '已超时',
        count: stats.timeout,
        countClass: 'us-recv-reminder-count--warn'
      },
      {
        key: 'week_pending',
        label: '本周待送仓',
        count: stats.weekPendingDelivery,
        countClass: 'us-recv-reminder-count--info'
      }
    ];
    return rows.map(function (row) {
      return '<li data-reminder="' + escapeHtml(row.key) + '">' +
        '<span class="us-recv-reminder-label">' + escapeHtml(row.label) + '</span>' +
        '<span class="us-recv-reminder-count ' + row.countClass + '">' + row.count + '</span>' +
        '<a href="#" class="us-recv-reminder-link" data-reminder="' + escapeHtml(row.key) + '">查看</a>' +
        '</li>';
    }).join('');
  }

  function mountWidget() {
    if (document.getElementById('usRecvReminder')) return;

    var root = document.createElement('div');
    root.id = 'usRecvReminder';
    root.className = 'us-recv-reminder';
    root.innerHTML =
      '<div class="us-recv-reminder-panel" role="region" aria-label="预约提醒">' +
        '<div class="us-recv-reminder-head">' +
          '<strong>预约提醒</strong>' +
          '<button type="button" class="us-recv-reminder-close" id="usRecvReminderClose" aria-label="收起">&times;</button>' +
        '</div>' +
        '<p class="us-recv-reminder-sub" id="usRecvReminderSub"></p>' +
        '<ul class="us-recv-reminder-list" id="usRecvReminderList"></ul>' +
        '<div class="us-recv-reminder-foot">登录后自动展示，收起后可点击右下角图标再次打开</div>' +
      '</div>' +
      '<button type="button" class="us-recv-reminder-fab" id="usRecvReminderFab" aria-label="打开预约提醒">' +
        '<span aria-hidden="true">&#128276;</span>' +
        '<span class="us-recv-reminder-fab-badge" id="usRecvReminderFabBadge">0</span>' +
      '</button>';

    document.body.appendChild(root);
    bindEvents(root);
    refreshContent(root);
    applyInitialState(root);
  }

  function refreshContent(root) {
    root = root || document.getElementById('usRecvReminder');
    if (!root) return;
    var stats = getStats();
    var list = root.querySelector('#usRecvReminderList');
    var sub = root.querySelector('#usRecvReminderSub');
    var badge = root.querySelector('#usRecvReminderFabBadge');
    if (list) list.innerHTML = renderRows(stats);
    if (sub) {
      sub.textContent = stats.weekRangeLabel
        ? '本周待送仓统计区间：' + stats.weekRangeLabel + '（按确认/期望送仓日期）'
        : '';
    }
    if (badge) badge.textContent = String(totalAlerts(stats));
  }

  function setCollapsed(root, collapsed) {
    root.classList.toggle('is-collapsed', collapsed);
    root.classList.toggle('is-open', !collapsed);
    try {
      if (collapsed) {
        sessionStorage.setItem(SESSION_COLLAPSED_KEY, '1');
      } else {
        sessionStorage.removeItem(SESSION_COLLAPSED_KEY);
      }
    } catch (e) { /* ignore */ }
  }

  function applyInitialState(root) {
    var collapsed = false;
    try {
      collapsed = sessionStorage.getItem(SESSION_COLLAPSED_KEY) === '1';
    } catch (e) { /* ignore */ }
    setCollapsed(root, collapsed);
    if (!collapsed) {
      root.classList.add('us-recv-reminder-highlight');
    }
  }

  function navigateReminder(key) {
    if (window.UsRecvAppointmentList && window.UsRecvAppointmentList.applyReminderFilter) {
      window.UsRecvAppointmentList.applyReminderFilter(key);
      return;
    }
    var map = {
      wh_pending: '?reminder=wh_pending',
      timeout: '?reminder=timeout',
      week_pending: '?reminder=week_pending'
    };
    window.location.href = 'receiving-appointment.html' + (map[key] || '');
  }

  function bindEvents(root) {
    root.querySelector('#usRecvReminderClose').addEventListener('click', function () {
      setCollapsed(root, true);
    });
    root.querySelector('#usRecvReminderFab').addEventListener('click', function () {
      refreshContent(root);
      setCollapsed(root, false);
    });
    root.addEventListener('click', function (e) {
      var link = e.target.closest('.us-recv-reminder-link');
      if (!link) return;
      e.preventDefault();
      navigateReminder(link.getAttribute('data-reminder'));
      setCollapsed(root, true);
    });
  }

  function init() {
    if (!C) return;
    mountWidget();
    var root = document.getElementById('usRecvReminder');
    C.bindAppointmentStorageSync(function () {
      refreshContent(root);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.UsRecvAppointmentReminder = {
    refresh: function () {
      refreshContent(document.getElementById('usRecvReminder'));
    }
  };
})();
