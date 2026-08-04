/**
 * 测试企业微信智能表格 Webhook 写入
 * 用法：node scripts/test-wecom-smartsheet.js
 */
var path = require('path');

try {
  require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
} catch (e) { /* ignore */ }

var wecom = require('./lib/wecomSmartsheet');

var mockProduct = {
  yundeNo: 'YD' + Date.now(),
  skuCode: 'TEST-SKU-' + Date.now(),
  productCode: 'TEST-SKU-' + Date.now(),
  userCode: 'CN0000438',
  productName: 'Webhook 测试产品名称',
  description: 'Webhook 连通性测试',
  nameCn: '测试中文申报名',
  nameEn: 'Test Declare Name EN',
  auditStatus: '待审核',
  createTime: new Date().toISOString().replace('T', ' ').slice(0, 19)
};

var webhook = wecom.getWebhookUrl();
console.log('Webhook:', webhook ? '已配置' : '未配置');
console.log('写入字段:', JSON.stringify(wecom.buildSkuValues(mockProduct), null, 2));

wecom.syncProductToSmartsheet(mockProduct)
  .then(function (result) {
    console.log('\n同步结果:', JSON.stringify(result, null, 2));
    if (result.ok) {
      console.log('\n成功：请到企业微信智能表格核对新行。');
      process.exit(0);
    }
    if (result.skipped) {
      console.error('\n跳过：请在 .env 配置 WECOM_SMARTSHEET_WEBHOOK');
      process.exit(1);
    }
    console.error('\n失败，请检查 Webhook 与 WECOM_FIELD_KEY_MAP 字段 ID。');
    process.exit(1);
  })
  .catch(function (err) {
    console.error('异常:', err.message || err);
    process.exit(1);
  });
