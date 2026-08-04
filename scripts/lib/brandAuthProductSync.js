/**
 * 品牌授权变更后，同步已绑定产品的授权有效期（不含查验图片）
 */
var productMockFile = require('./productInfoMockFile');

function formatDateTime(d) {
  var dt = d || new Date();
  var pad = function (n) { return String(n).padStart(2, '0'); };
  return dt.getFullYear() + '-' + pad(dt.getMonth() + 1) + '-' + pad(dt.getDate()) +
    ' ' + pad(dt.getHours()) + ':' + pad(dt.getMinutes()) + ':' + pad(dt.getSeconds());
}

function genLogId() {
  return 'product-log-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
}

function formatAuthLabel(auth) {
  if (!auth) return '空';
  var name = auth.brandName ? String(auth.brandName).trim() : '';
  var code = auth.brandCode ? String(auth.brandCode).trim() : '';
  if (name && code) return name + '（' + code + '）';
  return name || code || '空';
}

function appendSyncLog(product, auth, beforeExpire, afterExpire) {
  if (!Array.isArray(product.operationLogs)) product.operationLogs = [];
  product.operationLogs.unshift({
    id: genLogId(),
    time: formatDateTime(),
    operator: '系统',
    action: '品牌授权同步',
    relationDesc: '品牌授权「' + formatAuthLabel(auth) + '」有效期变更，自动同步至本产品',
    changes: [{
      field: '授权有效期',
      before: beforeExpire || '空',
      after: afterExpire || '空',
      relation: '品牌授权联动'
    }]
  });
}

function syncProductsFromBrandAuth(brandAuthList) {
  var authById = {};
  (brandAuthList || []).forEach(function (auth) {
    if (auth && auth.id) authById[auth.id] = auth;
  });

  var productList = productMockFile.loadProductInfoList();
  var changed = false;
  var syncedCount = 0;

  var nextList = productList.map(function (product) {
    var authId = product && product.brandAuthId ? String(product.brandAuthId).trim() : '';
    if (!authId) return product;

    var auth = authById[authId];
    if (!auth) return product;

    var beforeExpire = product.fileExpireDate || '';
    var nextExpire = auth.expireDate || '';
    if (beforeExpire === nextExpire) {
      return product;
    }

    changed = true;
    syncedCount += 1;
    var updated = JSON.parse(JSON.stringify(product));
    updated.fileExpireDate = nextExpire;
    appendSyncLog(updated, auth, beforeExpire, nextExpire);
    return updated;
  });

  if (changed) {
    productMockFile.writeProductInfoList(nextList);
  }

  return {
    changed: changed,
    syncedCount: syncedCount,
    list: changed ? nextList : productList
  };
}

module.exports = {
  syncProductsFromBrandAuth: syncProductsFromBrandAuth
};
