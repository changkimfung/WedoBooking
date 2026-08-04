/**
 * 海外仓 us · 发货复核档案存储层（localStorage）
 * 一个出库单可创建多个复核档案（多轮复核历史）；
 * 档案状态：复核中 | 复核完成 | 复核异常 | 部分复核
 *  - 复核完成：主动提交，且所有料号扫描次数与PCS数对等、扫描总数与总PCS对等
 *  - 复核异常：主动提交，且扫描次数与料号总PCS数不对等（少扫/超扫/种类不对等）
 *  - 部分复核：非主动提交而中断结束（重置本轮/切换订单/关闭页面）
 */
var ShipCheckStore = (function () {
  'use strict';

  var KEY = 'pm_demo_ship_check_records';

  /* ========== 工具 ========== */

  function pad(n) { return n < 10 ? '0' + n : '' + n; }

  function fmt(d) {
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) +
      ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds());
  }

  function nowStr() { return fmt(new Date()); }

  function toTs(s) {
    if (!s) return 0;
    var d = new Date(String(s).replace(/-/g, '/'));
    return isNaN(d.getTime()) ? 0 : d.getTime();
  }

  function loadAll() {
    try {
      var raw = localStorage.getItem(KEY);
      var list = raw ? JSON.parse(raw) : [];
      return Array.isArray(list) ? list : [];
    } catch (e) { return []; }
  }

  function saveAll(list) {
    try { localStorage.setItem(KEY, JSON.stringify(list)); } catch (e) { /* 原型环境忽略 */ }
  }

  function genId(list) {
    var d = new Date();
    var prefix = 'SC' + d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate()) + '-';
    var seq = 0;
    for (var i = 0; i < list.length; i++) {
      if (list[i].id && String(list[i].id).indexOf(prefix) === 0) seq++;
    }
    return prefix + ('0000' + (seq + 1)).slice(-4);
  }

  function sortDesc(list) {
    return list.slice().sort(function (a, b) {
      return toTs(b.startTime) - toTs(a.startTime);
    });
  }

  function calcDuration(rec) {
    var start = toTs(rec.startTime), end = toTs(rec.endTime);
    if (!start || !end || end < start) return 0;
    return Math.round((end - start) / 1000);
  }

  function finish(rec, status) {
    rec.status = status;
    rec.endTime = nowStr();
    rec.duration = calcDuration(rec);
  }

  /* ========== API ========== */

  /** 查询档案列表，支持 { orderNo, status } 过滤 */
  function listRecords(filters) {
    var list = loadAll();
    if (filters && filters.orderNo) {
      list = list.filter(function (r) { return r.orderNo === filters.orderNo; });
    }
    if (filters && filters.status) {
      list = list.filter(function (r) { return r.status === filters.status; });
    }
    return sortDesc(list);
  }

  /** 某出库单全部档案（按开始时间倒序） */
  function listByOrder(orderNo) {
    return listRecords({ orderNo: orderNo });
  }

  /** 某出库单当前「复核中」的档案（同一时刻至多一条） */
  function getActiveRecord(orderNo) {
    var list = listByOrder(orderNo);
    for (var i = 0; i < list.length; i++) {
      if (list[i].status === '复核中') return list[i];
    }
    return null;
  }

  function getRecord(id) {
    var list = loadAll();
    for (var i = 0; i < list.length; i++) {
      if (list[i].id === id) return list[i];
    }
    return null;
  }

  /**
   * 订单当前有效状态：
   * 取最新一条档案的状态（含复核中）；无档案时回退 mock 初始 checkStatus
   */
  function getEffectiveStatus(orderNo, fallbackStatus) {
    var list = listByOrder(orderNo);
    if (list.length) return list[0].status;
    return fallbackStatus || '未复核';
  }

  /**
   * 订单复核状态（订单级四态）：
   *  - 已达标：存在一条「复核完成」的档案
   *  - 复核异常：存在主动提交的「复核异常」档案，且无复核完成
   *  - 部分复核：所有复核档案都是「部分复核」（含进行中的未终结档案）
   *  - 未复核：未产生过任何复核档案（回退 mock 初始 checkStatus，初始复核完成视为已达标）
   */
  function getOrderCheckStatus(orderNo, fallbackStatus) {
    var list = listByOrder(orderNo);
    if (!list.length) {
      if (fallbackStatus === '复核完成') return '已达标';
      if (fallbackStatus === '复核异常') return '复核异常';
      if (fallbackStatus === '部分复核') return '部分复核';
      return '未复核';
    }
    var hasAbnormalSubmit = false;
    for (var i = 0; i < list.length; i++) {
      var r = list[i];
      if (r.status === '复核完成') return '已达标';
      if (r.status === '复核异常' && r.finishType === '主动提交') hasAbnormalSubmit = true;
    }
    if (hasAbnormalSubmit) return '复核异常';
    return '部分复核';
  }

  /** 某出库单的复核档案数量（复核次数） */
  function countByOrder(orderNo) {
    return listByOrder(orderNo).length;
  }

  /** 最新一条「复核完成」档案的提交时间，无则返回空 */
  function getCompletionTime(orderNo) {
    var list = listByOrder(orderNo);
    for (var i = 0; i < list.length; i++) {
      if (list[i].status === '复核完成') return list[i].endTime;
    }
    return '';
  }

  /** 首次扫描成功时建档（记录开始时间、操作人、SKU清单快照） */
  function createRecord(order, operator, site) {
    var list = loadAll();
    var totalQty = 0;
    var scanDetail = (order.items || []).map(function (it) {
      totalQty += it.qty || 0;
      return { itemNo: it.itemNo, scanCount: 0, orderQty: it.qty || 0 };
    });
    var rec = {
      id: genId(list),
      orderNo: order.orderNo,
      trackingNo: order.trackingNo,
      operator: operator || '-',
      site: site || '',
      startTime: nowStr(),
      endTime: '',
      duration: 0,
      scanLogs: [],
      scanDetail: scanDetail,
      totalScanCount: 0,
      totalOrderQty: totalQty,
      finishType: '',                       // 完结类型：主动提交 | 中断完结（复核中为空）
      status: '复核中'
    };
    list.push(rec);
    saveAll(list);
    return rec;
  }

  /**
   * 追加一条 SKU 扫描记录（时间+操作人+异常类型），对应料号计数+1
   * 非当前订单清单内的料号也会记录：自动新增一行，订单数量为 0
   * 异常类型 scanType：错扫（料号不属于本单）| 多扫（超出该料号订单数量）| 正常
   */
  function appendScan(id, itemNo, operator) {
    var list = loadAll();
    var rec = null;
    for (var i = 0; i < list.length; i++) {
      if (list[i].id === id) { rec = list[i]; break; }
    }
    if (!rec || rec.status !== '复核中') return null;
    var trimmed = String(itemNo).trim();
    var normalized = trimmed.toUpperCase();
    var detail = null;
    for (var j = 0; j < rec.scanDetail.length; j++) {
      if (String(rec.scanDetail[j].itemNo).toUpperCase() === normalized) {
        detail = rec.scanDetail[j];
        break;
      }
    }
    var scanType = '正常';
    if (!detail) {
      // 非当前订单料号：错扫，同样计入复核记录，订单数量为 0（提交时判为复核异常）
      detail = { itemNo: trimmed, scanCount: 0, orderQty: 0 };
      rec.scanDetail.push(detail);
      scanType = '错扫';
    } else if (detail.scanCount >= detail.orderQty) {
      // 本次扫描将超出该料号订单数量：多扫
      scanType = '多扫';
    }
    detail.scanCount++;
    rec.totalScanCount++;
    rec.scanLogs.push({ itemNo: detail.itemNo, time: nowStr(), operator: operator || '-', scanType: scanType });
    saveAll(list);
    return rec;
  }

  /**
   * 主动提交：内部判定复核完成/复核异常，写入结束时间与时长
   * @returns {{status:string, missing:Array, over:Array}}
   */
  function submitRecord(id) {
    var list = loadAll();
    var rec = null;
    for (var i = 0; i < list.length; i++) {
      if (list[i].id === id) { rec = list[i]; break; }
    }
    if (!rec || rec.status !== '复核中') return null;

    var missing = [], over = [];
    for (var j = 0; j < rec.scanDetail.length; j++) {
      var d = rec.scanDetail[j];
      if (d.scanCount < d.orderQty) {
        missing.push({ itemNo: d.itemNo, scanCount: d.scanCount, orderQty: d.orderQty });
      } else if (d.scanCount > d.orderQty) {
        over.push({ itemNo: d.itemNo, scanCount: d.scanCount, orderQty: d.orderQty });
      }
    }
    var ok = !missing.length && !over.length && rec.totalScanCount === rec.totalOrderQty;
    finish(rec, ok ? '复核完成' : '复核异常');
    rec.finishType = '主动提交';
    saveAll(list);
    return { status: rec.status, missing: missing, over: over };
  }

  /** 非主动提交中断：档案落「部分复核」（记录结束时间与时长） */
  function closeAsPartial(id) {
    var list = loadAll();
    var rec = null;
    for (var i = 0; i < list.length; i++) {
      if (list[i].id === id) { rec = list[i]; break; }
    }
    if (!rec || rec.status !== '复核中') return null;
    finish(rec, '部分复核');
    rec.finishType = '中断完结';
    saveAll(list);
    return rec;
  }

  /**
   * PC 端人工完结：为订单生成一条「复核完成 / 人工完结」档案，订单级状态即变为已达标
   * 扫描明细按订单清单补齐（已扫=订单数量），保证档案明细展示自洽
   */
  function completeOrder(order, operator) {
    var list = loadAll();
    var totalQty = 0;
    var scanDetail = (order.items || []).map(function (it) {
      totalQty += it.qty || 0;
      return { itemNo: it.itemNo, scanCount: it.qty || 0, orderQty: it.qty || 0 };
    });
    var now = nowStr();
    var rec = {
      id: genId(list),
      orderNo: order.orderNo,
      trackingNo: order.trackingNo,
      operator: operator || '-',
      site: '',
      startTime: now,
      endTime: now,
      duration: 0,
      scanLogs: [],
      scanDetail: scanDetail,
      totalScanCount: totalQty,
      totalOrderQty: totalQty,
      finishType: '人工完结',
      status: '复核完成'
    };
    list.push(rec);
    saveAll(list);
    return rec;
  }

  /**
   * PC 端修改已终结档案：支持修改复核状态与完结类型
   * @param {string} id 档案编号
   * @param {{status?:string, finishType?:string}} changes
   */
  function updateRecord(id, changes) {
    changes = changes || {};
    var list = loadAll();
    var rec = null;
    for (var i = 0; i < list.length; i++) {
      if (list[i].id === id) { rec = list[i]; break; }
    }
    if (!rec) return null;
    var allowedStatus = ['复核完成', '复核异常', '部分复核'];
    if (changes.status && allowedStatus.indexOf(changes.status) > -1) {
      rec.status = changes.status;
    }
    if (changes.finishType === '主动提交' || changes.finishType === '中断完结' || changes.finishType === '人工完结') {
      rec.finishType = changes.finishType;
    }
    saveAll(list);
    return rec;
  }

  return {
    listRecords: listRecords,
    listByOrder: listByOrder,
    getActiveRecord: getActiveRecord,
    getRecord: getRecord,
    getEffectiveStatus: getEffectiveStatus,
    getOrderCheckStatus: getOrderCheckStatus,
    countByOrder: countByOrder,
    getCompletionTime: getCompletionTime,
    createRecord: createRecord,
    appendScan: appendScan,
    submitRecord: submitRecord,
    closeAsPartial: closeAsPartial,
    completeOrder: completeOrder,
    updateRecord: updateRecord
  };
})();
