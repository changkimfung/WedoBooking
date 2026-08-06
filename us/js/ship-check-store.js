/**
 * 海外仓 us · 发货复核档案存储层（localStorage）
 * 一个出库单可创建多个复核档案（多轮复核历史）；
 * 档案状态：复核中 | 复核完成 | 复核异常 | 部分复核
 *  - 复核完成：主动提交，且所有料号最终录入数量与订单 PCS 数对等、录入总数与总 PCS 对等
 *  - 复核异常：主动提交，且最终录入数量与订单 PCS 数不对等（少货/多货/错扫）
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
   * 订单当前有效状态：取最新一条档案的状态（含复核中）；无档案统一为未复核
   */
  function getEffectiveStatus(orderNo, fallbackStatus) {
    var list = listByOrder(orderNo);
    if (list.length) return list[0].status;
    return '未复核';
  }

  /**
   * 订单复核状态（订单级五态）：
   *  - 已达标：仅完成 1 次复核，且该次档案为「复核完成」
   *  - 已合规：复核次数大于 1 后完成，或存在「人工完结」档案
   *  - 复核异常：存在主动提交的「复核异常」档案，且无复核完成
   *  - 部分复核：有档案但未满足以上状态
   *  - 未复核：未产生过任何复核档案
   */
  function getOrderCheckStatus(orderNo, fallbackStatus) {
    var list = listByOrder(orderNo);
    // 复核次数为 0 时，不读取模拟数据预设状态，统一归为未复核
    if (!list.length) return '未复核';
    var hasAbnormalSubmit = false;
    var hasCompleted = false;
    var hasManualComplete = false;
    for (var i = 0; i < list.length; i++) {
      var r = list[i];
      if (r.status === '复核完成') {
        hasCompleted = true;
        if (r.finishType === '人工完结') hasManualComplete = true;
      }
      if (r.status === '复核异常' && r.finishType === '主动提交') hasAbnormalSubmit = true;
    }
    if (hasCompleted) return hasManualComplete || list.length > 1 ? '已合规' : '已达标';
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

  function detailValueQty(detail) {
    return detail && detail.valueQty != null ? detail.valueQty : ((detail && detail.scanCount) || 0);
  }

  function recValueTotal(rec) {
    var total = 0;
    for (var i = 0; i < (rec.scanDetail || []).length; i++) {
      total += detailValueQty(rec.scanDetail[i]);
    }
    return total;
  }

  function findRecord(id) {
    var list = loadAll();
    for (var i = 0; i < list.length; i++) {
      if (list[i].id === id) return { list: list, rec: list[i] };
    }
    return null;
  }

  /** 首次进入录值页建档，SKU 明细保存本轮最终录入数量 */
  function createRecord(order, operator, site) {
    var list = loadAll();
    var totalQty = 0;
    var scanDetail = (order.items || []).map(function (it) {
      totalQty += it.qty || 0;
      return { itemNo: it.itemNo, valueQty: 0, orderQty: it.qty || 0 };
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
      totalValueQty: 0,
      totalOrderQty: totalQty,
      finishType: '',
      status: '复核中'
    };
    list.push(rec);
    saveAll(list);
    return rec;
  }

  /** 记录不属于当前订单的 SKU 扫描，保留错扫审计信息但不写入数量明细。 */
  function appendWrongScan(id, itemNo, operator) {
    var found = findRecord(id);
    if (!found || found.rec.status !== '复核中') return null;
    found.rec.scanLogs.push({
      itemNo: String(itemNo).trim(),
      time: nowStr(),
      operator: operator || '-',
      inputQty: null,
      submitNo: 0,
      scanType: '错扫'
    });
    saveAll(found.list);
    return found.rec;
  }

  /**
   * 为订单内 SKU 写入本轮最终录入数量；重复录入会覆盖明细，并追加独立录值日志。
   * @returns {{record:Object, previousQty:number, submitNo:number, scanType:string}|null}
   */
  function submitSkuValue(id, itemNo, inputQty, operator) {
    var found = findRecord(id);
    if (!found || found.rec.status !== '复核中') return null;
    var qty = Number(inputQty);
    if (!isFinite(qty) || qty <= 0 || Math.floor(qty) !== qty) return null;
    var detail = null;
    var normalized = String(itemNo).trim().toUpperCase();
    for (var i = 0; i < found.rec.scanDetail.length; i++) {
      if (String(found.rec.scanDetail[i].itemNo).toUpperCase() === normalized) {
        detail = found.rec.scanDetail[i];
        break;
      }
    }
    if (!detail || detail.orderQty <= 0) return null;
    var previousQty = detailValueQty(detail);
    var submitNo = 0;
    for (var j = 0; j < found.rec.scanLogs.length; j++) {
      if (String(found.rec.scanLogs[j].itemNo).toUpperCase() === normalized && found.rec.scanLogs[j].inputQty != null) submitNo++;
    }
    detail.valueQty = qty;
    found.rec.totalValueQty = recValueTotal(found.rec);
    var scanType = qty < detail.orderQty ? '少货' : (qty > detail.orderQty ? '多货' : '正常');
    found.rec.scanLogs.push({
      itemNo: detail.itemNo,
      time: nowStr(),
      operator: operator || '-',
      inputQty: qty,
      submitNo: submitNo + 1,
      scanType: scanType
    });
    saveAll(found.list);
    return { record: found.rec, previousQty: previousQty, submitNo: submitNo + 1, scanType: scanType };
  }

  /** 主动提交：按每个 SKU 的最终录入数量及错扫日志判定结果。 */
  function submitRecord(id) {
    var found = findRecord(id);
    if (!found || found.rec.status !== '复核中') return null;
    var rec = found.rec;
    var missing = [], over = [];
    for (var j = 0; j < rec.scanDetail.length; j++) {
      var d = rec.scanDetail[j];
      var valueQty = detailValueQty(d);
      if (valueQty < d.orderQty) missing.push({ itemNo: d.itemNo, valueQty: valueQty, orderQty: d.orderQty });
      else if (valueQty > d.orderQty) over.push({ itemNo: d.itemNo, valueQty: valueQty, orderQty: d.orderQty });
    }
    var hasWrong = false;
    for (var k = 0; k < rec.scanLogs.length; k++) {
      if (rec.scanLogs[k].scanType === '错扫') { hasWrong = true; break; }
    }
    rec.totalValueQty = recValueTotal(rec);
    var ok = !missing.length && !over.length && !hasWrong && rec.totalValueQty === rec.totalOrderQty;
    finish(rec, ok ? '复核完成' : '复核异常');
    rec.finishType = '主动提交';
    saveAll(found.list);
    return { status: rec.status, missing: missing, over: over, hasWrong: hasWrong };
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
   * PC 端人工完结：为订单生成一条「复核完成 / 人工完结」档案，订单级状态即变为已合规
   * SKU 最终录值按订单清单补齐，保证档案明细展示自洽
   */
  function completeOrder(order, operator) {
    var list = loadAll();
    var totalQty = 0;
    var scanDetail = (order.items || []).map(function (it) {
      totalQty += it.qty || 0;
      return { itemNo: it.itemNo, valueQty: it.qty || 0, orderQty: it.qty || 0 };
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
      totalValueQty: totalQty,
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
    appendWrongScan: appendWrongScan,
    submitSkuValue: submitSkuValue,
    submitRecord: submitRecord,
    closeAsPartial: closeAsPartial,
    completeOrder: completeOrder,
    updateRecord: updateRecord
  };
})();
