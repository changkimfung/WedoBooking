/**
 * 截取预约送仓各端页面，供桌面操作手册使用
 * 用法：先 npm run dev，再 node scripts/capture-manual-screenshots.js
 */
var path = require('path');
var fs = require('fs');

var BASE = 'http://127.0.0.1:3847';
var OUT = path.join('C:', 'Users', 'admin', 'Desktop', '预约送仓', 'images');

var PAGES = [
  { file: 'customer-list.png', url: '/customer/deliveryAppointment.html', w: 1440, h: 900 },
  { file: 'customer-create.png', url: '/customer/deliveryAppointmentCreate.html', w: 1440, h: 900, fullPage: true },
  { file: 'customer-detail.png', url: '/customer/deliveryAppointmentDetail.html?id=appt-009', w: 1440, h: 900, fullPage: true },
  { file: 'fg-index.png', url: '/fg/index.html', w: 1440, h: 900 },
  { file: 'fg-detail.png', url: '/fg/reservationDetail.html?code=SC1R9W', w: 1440, h: 900, fullPage: true },
  { file: 'fg-detail-mobile.png', url: '/fg/m/reservationDetail.html?code=SC1R9W', w: 390, h: 844, fullPage: true },
  { file: 'us-list.png', url: '/us/receiving-appointment.html', w: 1440, h: 900 },
  { file: 'us-detail.png', url: '/us/receiving-appointment-detail.html?id=appt-1780652364602-588', w: 1440, h: 900, fullPage: true },
  { file: 'us-pda.png', url: '/us/pda-receiving-scan.html', w: 390, h: 844, fullPage: true },
  { file: 'wh-list.png', url: '/wh/deliveryAppointment.html', w: 1440, h: 900 }
];

async function main() {
  var playwright;
  try {
    playwright = require('playwright');
  } catch (e) {
    console.error('请先安装 playwright: npm install --no-save playwright');
    process.exit(1);
  }

  fs.mkdirSync(OUT, { recursive: true });
  var browser = await playwright.chromium.launch();
  console.log('Output:', OUT);

  for (var i = 0; i < PAGES.length; i++) {
    var item = PAGES[i];
    var page = await browser.newPage({
      viewport: { width: item.w, height: item.h }
    });
    var url = BASE + item.url;
    process.stdout.write('Capturing ' + item.file + ' ... ');
    try {
      await page.goto(url, { waitUntil: 'networkidle', timeout: 45000 });
      await page.waitForTimeout(2000);
      await page.screenshot({
        path: path.join(OUT, item.file),
        fullPage: !!item.fullPage
      });
      console.log('ok');
    } catch (err) {
      console.log('fail - ' + (err.message || err));
    }
    await page.close();
  }

  await browser.close();
  console.log('Done.');
}

main().catch(function (err) {
  console.error(err);
  process.exit(1);
});
