/**
 * 海外仓 us · 时区切换工具（演示原型）
 * 约定：所有存储/录入的时间字符串（"YYYY-MM-DD HH:mm:ss"）均为中国时间（UTC+8），
 *       展示与搜索时按所选时区转换。
 *  - 中国时间：Asia/Shanghai（UTC+8）
 *  - 美国时间：America/Los_Angeles（美西，夏令时 UTC-7 / 冬令时 UTC-8，Intl 自动处理）
 */
var WedoTime = (function () {
  'use strict';

  var KEY = 'pm_demo_time_zone';

  /** 把中国时间字符串解析为绝对毫秒数（与时区设置无关） */
  function toMs(str) {
    var m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/.exec(String(str || '').trim());
    if (!m) return 0;
    // 按 UTC+8 解释该字符串
    return Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]) - 8 * 3600 * 1000;
  }

  function tzName(tz) {
    return tz === 'us' ? 'America/Los_Angeles' : 'Asia/Shanghai';
  }

  function parts(ms, tz) {
    var fmt = new Intl.DateTimeFormat('zh-CN', {
      timeZone: tzName(tz), hourCycle: 'h23',
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit'
    });
    var out = {};
    fmt.formatToParts(new Date(ms)).forEach(function (p) { out[p.type] = p.value; });
    return out;
  }

  return {
    /** 当前所选时区：'cn' | 'us' */
    get: function () {
      try { return localStorage.getItem(KEY) === 'us' ? 'us' : 'cn'; } catch (e) { return 'cn'; }
    },

    set: function (tz) {
      try { localStorage.setItem(KEY, tz === 'us' ? 'us' : 'cn'); } catch (e) { /* 原型环境忽略 */ }
    },

    /** 中国时间字符串 → 当前所选时区的 "YYYY-MM-DD HH:mm:ss" */
    fmt: function (str) {
      var ms = toMs(str);
      if (!ms) return str || '-';
      var p = parts(ms, this.get());
      return p.year + '-' + p.month + '-' + p.day + ' ' + p.hour + ':' + p.minute + ':' + p.second;
    },

    /** 中国时间字符串 → 当前所选时区的日期 "YYYY-MM-DD"（用于时间段搜索） */
    day: function (str) {
      var ms = toMs(str);
      if (!ms) return '';
      var p = parts(ms, this.get());
      return p.year + '-' + p.month + '-' + p.day;
    },

    /** 当前时刻在所选时区下的日期 "YYYY-MM-DD"（用于当日看板统计日期） */
    today: function () {
      var p = parts(Date.now(), this.get());
      return p.year + '-' + p.month + '-' + p.day;
    }
  };
})();
