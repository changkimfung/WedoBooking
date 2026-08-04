/**
 * 海外仓 us · 工作日历抽屉（FullCalendar 3.x）
 * 依赖：$fcJquery (jQuery 3.x noConflict)、moment.js、FullCalendar 3.x、DeliveryAppointmentCommon
 */
(function ($) {
  'use strict';

  var TODO_STORAGE_KEY = 'pm_demo_calendar_todos';
  var C = window.DeliveryAppointmentCommon;
  var calendarInited = false;

  /* ========== 工具函数 ========== */

  function pad(n) { return n < 10 ? '0' + n : '' + n; }

  function todayStr() {
    var d = new Date();
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }

  function escHtml(s) {
    if (!s) return '';
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  /** 解析 warehouseConfirmedInboundTime: '2026-06-26 09:00--12:00' */
  function parseConfirmedTime(raw) {
    if (!raw) return { date: '', timeRange: '' };
    var parts = String(raw).split(' ');
    var date = parts[0] || '';
    var timeRange = (parts[1] || '').replace('--', '-');
    return { date: date, timeRange: timeRange };
  }

  /** 超时紧急程度颜色 */
  function getUrgencyColor(dateStr) {
    if (!dateStr) return '#2196F3';
    var today = new Date(); today.setHours(0, 0, 0, 0);
    var evDate = new Date(dateStr.replace(/-/g, '/'));
    if (isNaN(evDate.getTime())) return '#2196F3';
    var diffDays = Math.floor((today - evDate) / 86400000);
    if (diffDays <= 0) return '#2196F3';   // 未超时 → 蓝
    if (diffDays <= 3) return '#faad14';   // 1-3天 → 黄
    if (diffDays <= 7) return '#fa8c16';   // 4-7天 → 橙
    return '#f5222d';                       // >7天 → 红
  }

  /* ========== 手动待办 CRUD ========== */

  function loadTodos() {
    try { return JSON.parse(localStorage.getItem(TODO_STORAGE_KEY)) || []; }
    catch (e) { return []; }
  }

  function saveTodos(list) {
    localStorage.setItem(TODO_STORAGE_KEY, JSON.stringify(list));
  }

  function addTodo(data) {
    var list = loadTodos();
    var now = new Date();
    list.push({
      id: 'todo-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
      title: data.title || '',
      date: data.date || '',
      customerCode: data.customerCode || '',
      ticketNo: data.ticketNo || '',
      remark: data.remark || '',
      done: false,
      createdAt: now.getFullYear() + '-' + pad(now.getMonth() + 1) + '-' + pad(now.getDate()) +
        ' ' + pad(now.getHours()) + ':' + pad(now.getMinutes()) + ':' + pad(now.getSeconds())
    });
    saveTodos(list);
  }

  function deleteTodo(id) {
    saveTodos(loadTodos().filter(function (t) { return t.id !== id; }));
  }

  function toggleTodo(id) {
    var list = loadTodos();
    list.forEach(function (t) { if (t.id === id) t.done = !t.done; });
    saveTodos(list);
  }

  /* ========== 日历事件构建 ========== */

  function buildEvents() {
    var events = [];

    // 自动事件：待送仓 + 已超时
    if (C) {
      C.getReceivingAppointmentList().forEach(function (item) {
        if (item.status !== '待送仓' && item.status !== '已超时') return;
        var parsed = parseConfirmedTime(item.warehouseConfirmedInboundTime);
        var dateStr = parsed.date || (item.expectedInboundTime || '');
        if (!dateStr) return;
        events.push({
          id: 'appt-' + item.id,
          title: (item.appointmentNo || '-') + ' / ' + (item.deliveryCode || '-'),
          start: dateStr,
          color: getUrgencyColor(dateStr),
          _isAppointment: true,
          _timeRange: parsed.timeRange,
          _warehouse: item.warehouse || '',
          _url: 'receiving-appointment-detail.html?id=' + encodeURIComponent(item.id)
        });
      });
    }

    // 手动待办
    loadTodos().forEach(function (t) {
      if (t.done || !t.date) return;
      var label = t.title;
      var meta = [];
      if (t.customerCode) meta.push(t.customerCode);
      if (t.ticketNo) meta.push(t.ticketNo);
      if (meta.length) label += ' (' + meta.join(' / ') + ')';
      events.push({
        id: t.id,
        title: label,
        start: t.date,
        color: getUrgencyColor(t.date),
        _isAppointment: false
      });
    });

    return events;
  }

  /* ========== FullCalendar 初始化 ========== */

  function initCalendar() {
    $('#recvCalendar').fullCalendar({
      locale: 'zh-cn',
      defaultView: 'month',
      height: 'auto',
      header: {
        left: 'prev,next today',
        center: 'title',
        right: 'month,agendaWeek'
      },
      events: function (start, end, timezone, callback) {
        callback(buildEvents());
      },
      eventRender: function (event, element) {
        var dot = '<span class="cal-dot" style="background:' + (event.color || '#2196F3') + '"></span>';
        var time = event._timeRange ? '<span class="cal-event-time">' + escHtml(event._timeRange) + '</span>' : '';
        var title = '<span class="cal-event-title">' + escHtml(event.title) + '</span>';
        element.html(dot + time + title);
        if (event._isAppointment) {
          element.attr('title', (event._warehouse || '') + ' - 点击查看详情');
        }
      },
      dayClick: function (date) {
        renderDayList(date.format('YYYY-MM-DD'));
      },
      eventClick: function (calEvent, jsEvent) {
        if (calEvent._isAppointment && calEvent._url) {
          window.location.href = calEvent._url;
          return;
        }
        jsEvent.preventDefault();
        renderDayList(calEvent.start.format('YYYY-MM-DD'));
      }
    });
    calendarInited = true;
  }

  function refreshEvents() {
    if (calendarInited) $('#recvCalendar').fullCalendar('refetchEvents');
  }

  /* ========== 抽屉控制 ========== */

  function openDrawer() {
    $('#recvCalendarBackdrop').addClass('open');
    $('#recvCalendarDrawer').addClass('open');
    if (!calendarInited) {
      initCalendar();
    } else {
      refreshEvents();
      // 重新渲染以适应可能的宽度变化
      setTimeout(function () { $('#recvCalendar').fullCalendar('render'); }, 320);
    }
    renderDayList(todayStr());
  }

  function closeDrawer() {
    $('#recvCalendarBackdrop').removeClass('open');
    $('#recvCalendarDrawer').removeClass('open');
  }

  /* ========== 拖拽调整宽度 ========== */

  function bindResize() {
    var handle = document.getElementById('recvCalResizeHandle');
    var drawer = document.getElementById('recvCalendarDrawer');
    if (!handle || !drawer) return;
    var startX = 0, startW = 0;

    handle.addEventListener('mousedown', function (e) {
      e.preventDefault();
      startX = e.clientX;
      startW = drawer.offsetWidth;
      handle.classList.add('dragging');
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    });

    function onMove(e) {
      var newW = startW + (startX - e.clientX);
      newW = Math.max(380, Math.min(newW, window.innerWidth * 0.9));
      drawer.style.width = newW + 'px';
    }

    function onUp() {
      handle.classList.remove('dragging');
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      // 宽度变化后重新渲染日历
      if (calendarInited) $('#recvCalendar').fullCalendar('render');
    }
  }

  /* ========== 当日待办清单 ========== */

  function renderDayList(dateStr) {
    var $list = $('#recvCalDayList');
    if (!$list.length) return;

    var appts = [];
    if (C) {
      C.getReceivingAppointmentList().forEach(function (item) {
        if (item.status !== '待送仓' && item.status !== '已超时') return;
        var parsed = parseConfirmedTime(item.warehouseConfirmedInboundTime);
        var d = parsed.date || (item.expectedInboundTime || '');
        if (d === dateStr) appts.push({ item: item, timeRange: parsed.timeRange });
      });
    }

    var todos = loadTodos().filter(function (t) { return t.date === dateStr; });
    var html = '<div class="recv-cal-day-title">' + escHtml(dateStr) + ' 待办清单</div>';

    if (!appts.length && !todos.length) {
      html += '<p class="recv-cal-empty">当日无待办事项</p>';
      $list.html(html);
      return;
    }

    if (appts.length) {
      html += '<div class="recv-cal-group-label">待送仓预约 (' + appts.length + ')</div><ul class="recv-cal-items">';
      appts.forEach(function (a) {
        var item = a.item;
        var color = getUrgencyColor(a.timeRange ? parseConfirmedTime(item.warehouseConfirmedInboundTime).date : (item.expectedInboundTime || ''));
        html += '<li class="recv-cal-item">' +
          '<span class="cal-dot" style="background:' + color + '"></span>' +
          (a.timeRange ? '<span class="cal-event-time">' + escHtml(a.timeRange) + '</span>' : '') +
          '<a href="receiving-appointment-detail.html?id=' + encodeURIComponent(item.id) + '" class="recv-cal-item-link">' +
          escHtml((item.appointmentNo || '-') + ' / ' + (item.deliveryCode || '-') + ' / ' + (item.warehouse || '')) +
          '</a><span class="recv-cal-badge recv-cal-badge-appt">预约</span></li>';
      });
      html += '</ul>';
    }

    if (todos.length) {
      html += '<div class="recv-cal-group-label">手动待办 (' + todos.length + ')</div><ul class="recv-cal-items">';
      todos.forEach(function (t) {
        var doneCls = t.done ? ' recv-cal-item-done' : '';
        var meta = [];
        if (t.customerCode) meta.push('客户: ' + t.customerCode);
        if (t.ticketNo) meta.push('票号: ' + t.ticketNo);
        html += '<li class="recv-cal-item' + doneCls + '">' +
          '<label class="recv-cal-check"><input type="checkbox" data-todo-id="' + t.id + '"' + (t.done ? ' checked' : '') + '> ' + escHtml(t.title) + '</label>' +
          (meta.length ? '<span class="recv-cal-item-meta">' + escHtml(meta.join(' | ')) + '</span>' : '') +
          (t.remark ? '<span class="recv-cal-item-meta">' + escHtml(t.remark) + '</span>' : '') +
          '<button type="button" class="recv-cal-del" data-todo-id="' + t.id + '" title="删除">&times;</button></li>';
      });
      html += '</ul>';
    }

    $list.html(html);
  }

  /* ========== 新增待办表单 ========== */

  function openTodoForm(defaultDate) {
    $('#recvCalTodoTitle').val('');
    $('#recvCalTodoDate').val(defaultDate || todayStr());
    $('#recvCalTodoCustomer').val('');
    $('#recvCalTodoTicket').val('');
    $('#recvCalTodoRemark').val('');
    $('#recvCalTodoError').hide();
    $('#recvCalTodoForm').slideDown(150);
  }

  function closeTodoForm() {
    $('#recvCalTodoForm').slideUp(100);
  }

  function submitTodoForm() {
    var title = $.trim($('#recvCalTodoTitle').val());
    var date = $('#recvCalTodoDate').val();
    if (!title) { $('#recvCalTodoError').text('请输入标题').show(); return; }
    if (!date) { $('#recvCalTodoError').text('请选择日期').show(); return; }
    addTodo({
      title: title,
      date: date,
      customerCode: $.trim($('#recvCalTodoCustomer').val()),
      ticketNo: $.trim($('#recvCalTodoTicket').val()),
      remark: $.trim($('#recvCalTodoRemark').val())
    });
    closeTodoForm();
    refreshEvents();
    renderDayList(date);
  }

  /* ========== 事件绑定 ========== */

  function bind() {
    $('#btn_work_calendar').on('click', openDrawer);
    $('#recvCalendarBackdrop').on('click', closeDrawer);
    $('#recvCalClose').on('click', closeDrawer);
    $('#recvCalAddTodo').on('click', function () { openTodoForm(todayStr()); });
    $('#recvCalTodoSubmit').on('click', submitTodoForm);
    $('#recvCalTodoCancel').on('click', closeTodoForm);

    // 待办勾选 / 删除
    $('#recvCalDayList').on('change', '.recv-cal-check input', function () {
      toggleTodo($(this).attr('data-todo-id'));
      refreshEvents();
      var d = $('.recv-cal-day-title').first().text().replace(' 待办清单', '');
      renderDayList(d);
    });
    $('#recvCalDayList').on('click', '.recv-cal-del', function () {
      if (!confirm('确认删除该待办？')) return;
      deleteTodo($(this).attr('data-todo-id'));
      refreshEvents();
      var d = $('.recv-cal-day-title').first().text().replace(' 待办清单', '');
      renderDayList(d);
    });

    bindResize();
  }

  /* ========== 初始化 ========== */

  $(function () {
    if (typeof $.fn.fullCalendar === 'undefined') return;
    bind();
  });

})(window.$fcJquery || jQuery);
