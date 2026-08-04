/**
 * 对外访问根地址：将相对路径补全为绝对 URL
 * - 本地开发：不设 PUBLIC_BASE_URL 时默认 http://localhost:3847
 * - 测试/生产：在 .env 设置 PUBLIC_BASE_URL 为当前环境地址
 * 已是 http(s) 的链接（含 localhost）原样保留，不做跨环境替换
 */
function trimTrailingSlash(url) {
  return String(url || '').replace(/\/+$/, '');
}

function getPublicBaseUrl() {
  var fromEnv = trimTrailingSlash(process.env.PUBLIC_BASE_URL);
  if (fromEnv) return fromEnv;
  var port = Number(process.env.PORT) || 3847;
  return 'http://localhost:' + port;
}

function resolvePublicUrl(url) {
  if (url == null || url === '') return '';
  var link = String(url).trim();
  if (!link) return '';
  if (/^https?:\/\//i.test(link)) return link;
  var base = getPublicBaseUrl();
  return base + (link.charAt(0) === '/' ? link : '/' + link);
}

module.exports = {
  getPublicBaseUrl: getPublicBaseUrl,
  resolvePublicUrl: resolvePublicUrl
};
