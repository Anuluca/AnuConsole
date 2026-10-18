// 此脚本只发送 GET 请求；输出状态、数量和项目标识，不输出令牌、DNS 内容或环境变量值。
try { process.loadEnvFile(".env.local"); } catch (error) { if (error.code !== "ENOENT") throw error; }

let failed = false;
async function check(label, url, token, summarize) {
  if (!token || !url) { console.log(`${label}：尚未配置。`); failed = true; return; }
  try {
    const response = await fetch(url, { headers: { Authorization: `Bearer ${token}`, Accept: "application/json" }, redirect: "error", signal: AbortSignal.timeout(15000) });
    if (!response.ok) { console.log(`${label}：连接失败（HTTP ${response.status}），请检查令牌、权限或平台状态。`); failed = true; return; }
    const data = await response.json();
    summarize(data);
  } catch { console.log(`${label}：连接失败，请检查网络及配置。`); failed = true; }
}

const zoneId = process.env.CLOUDFLARE_ZONE_ID?.trim();
await check("Cloudflare", zoneId && /^[a-f0-9]{32}$/i.test(zoneId) ? `https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records?per_page=1` : "", process.env.CLOUDFLARE_API_TOKEN, data => {
  if (data.success !== true || !Array.isArray(data.result) || data.result.some(record => record.name !== "anuluca.com" && !record.name.endsWith(".anuluca.com"))) {
    console.log("Cloudflare：返回区域或记录信息不符合 anuluca.com 配置。"); failed = true; return;
  }
  console.log(`Cloudflare：连接成功，DNS 记录总数 ${data.result_info?.total_count ?? "未知"}。`);
});
await check("Netlify", "https://api.netlify.com/api/v1/sites?per_page=100", process.env.NETLIFY_API_TOKEN, data => {
  if (!Array.isArray(data)) { console.log("Netlify：平台响应格式无效。"); failed = true; return; }
  const allowed = process.env.NETLIFY_SITE_IDS?.split(",").map(value => value.trim()).filter(Boolean);
  const sites = data.filter(site => !allowed?.length || allowed.includes(site.id));
  console.log(`Netlify：连接成功，首批可管理项目 ${sites.length} 个。`);
  if (process.argv.includes("--list-sites")) for (const site of sites) console.log(`  ${site.name}：${site.id}`);
});
process.exitCode = failed ? 1 : 0;
