import { test, expect } from "@playwright/test";
import { openNavigation } from "./helpers/navigation";

const report = (id: string, metrics: Record<string, number> = {}, dimensions: string[] = []) => ({
  id, status: "ready", rows: [{ dimensions, metrics }], rowCount: 1, thresholded: false, sampled: false, dataLoss: false,
});
const generatedAt = "2026-10-17T01:00:00Z";
const fixture = (days = 7) => ({ days, generatedAt, timeZone: "Asia/Shanghai", reports: [
  report("overview", { activeUsers: days, screenPageViews: 200, sessions: 40, eventCount: 300 }),
  report("engagement", { engagementRate: .5, averageSessionDuration: 65 }),
  { ...report("trend", { screenPageViews: 20, activeUsers: 3, sessions: 4 }, ["20261016"]), rows: [
    { dimensions: ["20261016"], metrics: { screenPageViews: 20, activeUsers: 3, sessions: 4 } },
    { dimensions: ["20261017"], metrics: { screenPageViews: 30, activeUsers: 5, sessions: 7 } },
  ] },
  { ...report("pages", { screenPageViews: 20, activeUsers: 3 }, ["/journey/" + "long-path-".repeat(20)]), thresholded: true, sampled: true, dataLoss: true, rowCount: 26 },
  { ...report("landing"), status: "unavailable", rows: [] },
  report("devices", { activeUsers: 5 }, ["mobile"]),
] });

// 确定性界面测试使用显式夹具；生产环境认证由 console.spec.ts 覆盖。
test.beforeEach(async ({ page }) => {
  test.skip(process.env.E2E_AUTH_MODE === "production", "需要开发环境，生产认证由独立回归覆盖");
  await page.route("**/api/analytics/realtime", route => route.fulfill({ json: { generatedAt, activeUsers: 0, reports: [
    { ...report("realtimeCountries"), rows: [] }, { ...report("realtimeEvents"), rows: [] },
  ] } }));
});

test("默认七天、移除工具栏、趋势、分类与手机布局", async ({ page }, testInfo) => {
  await page.route("**/api/analytics/summary?*", route => route.fulfill({ json: fixture(Number(new URL(route.request().url()).searchParams.get("days"))) }));
  await page.goto("/anutrium/monitor/ga4");
  await expect(page.getByRole("heading", { name: "GA4浏览量", exact: true })).toBeVisible();
  const overview = page.getByRole("region", { name: "概览", exact: true });
  await expect(overview.locator(".monitor-metric").first().locator("strong")).toHaveText("7");
  await expect(page.getByRole("group", { name: /页面浏览量每日趋势/ })).toBeVisible();
  const point = page.locator(".monitor-chart-hit").first();
  await point.hover();
  await expect(page.locator(".monitor-chart-tooltip")).toContainText("页面浏览量：20");
  await point.focus();
  await point.press("Escape");
  await expect(page.locator(".monitor-chart-tooltip")).toHaveCount(0);
  await page.getByText("查看每日数据", { exact: true }).click();
  await expect(page.getByRole("region", { name: "每日趋势表格" })).toContainText("2026-10-17");
  await expect(page.getByRole("region", { name: "页面浏览", exact: true })).toContainText("前 1 项 / 共 26 项");
  await expect(page.getByRole("region", { name: "页面浏览", exact: true })).toContainText("受隐私阈值限制 · 包含抽样数据 · 存在高基数汇总");
  await expect(page.getByRole("region", { name: "入口页面", exact: true })).toContainText("报表暂不可用");
  await expect(page.locator(".monitor-toolbar")).toHaveCount(0);
  const ranges = page.getByRole("group", { name: "统计时间范围" });
  await expect(ranges.getByRole("button")).toHaveCount(3);
  await expect(ranges.getByRole("button", { name: "近 7 天", exact: true })).toHaveAttribute("aria-pressed", "true");
  for (const days of [30, 90, 7]) {
    await ranges.getByRole("button", { name: `近 ${days} 天`, exact: true }).click();
    await expect(overview.locator(".monitor-metric").first().locator("strong")).toHaveText(String(days));
    await expect(ranges.getByRole("button", { name: `近 ${days} 天`, exact: true })).toHaveAttribute("aria-pressed", "true");
  }
  await expect(page.getByRole("button", { name: "刷新", exact: true })).toHaveCount(0);
  await expect(page.locator(".monitor-meta")).not.toContainText(/近 \d+ 天 ·|报表时区|北京时间/);
  await page.getByRole("group", { name: "报表分类" }).getByRole("button", { name: "设备", exact: true }).click();
  await expect(page.getByRole("region", { name: "设备类型", exact: true })).toContainText("手机");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath("monitor.png"), fullPage: true });
});

test("卡片标题、概览指标说明和趋势实时比例", async ({ page }, testInfo) => {
  await page.route("**/api/analytics/summary?*", route => route.fulfill({ json: fixture() }));
  await page.goto("/anutrium/monitor/ga4");
  await expect(page.getByRole("region", { name: "概览", exact: true })).toHaveAttribute("aria-busy", "false");
  const cards = page.locator(".monitor-card");
  for (const card of await cards.all()) await expect(card.getByRole("heading")).toHaveCount(1);
  const overview = page.getByRole("region", { name: "概览", exact: true });
  await overview.getByText("更多指标", { exact: true }).click();
  const metrics = overview.locator(".monitor-metric");
  await expect(metrics).toHaveCount(11);
  for (const label of ["事件数", "互动会话", "互动率"]) await expect(overview.getByText(label, { exact: true })).toHaveCount(0);
  for (const metric of await metrics.all()) {
    await page.mouse.move(0, 0);
    await metric.hover();
    await expect(metric.getByRole("tooltip")).toBeVisible();
    expect((await metric.getByRole("tooltip").innerText()).length).toBeGreaterThan(10);
  }
  await metrics.first().focus();
  await expect(metrics.first().getByRole("tooltip")).toContainText("同一个人只算一次");
  await overview.getByText("更多指标", { exact: true }).click();
  const trend = await page.locator(".monitor-trend").boundingBox();
  const live = await page.locator(".monitor-live").boundingBox();
  if (testInfo.project.name === "desktop") {
    expect(live!.x).toBeLessThan(trend!.x);
    expect(Math.abs(trend!.y - live!.y)).toBeLessThanOrEqual(1);
    expect(trend!.width).toBeGreaterThan(live!.width);
    expect(Math.abs(trend!.height - live!.height)).toBeLessThanOrEqual(1);
  } else {
    expect(trend!.y).toBeGreaterThanOrEqual(live!.y + live!.height);
    expect(Math.abs(trend!.width - live!.width)).toBeLessThanOrEqual(1);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("读取失败不伪造零值，实时不受影响，刷新后恢复", async ({ page }) => {
  let failed = true;
  await page.route("**/api/analytics/summary?*", route => route.fulfill(failed ? { status: 502, json: { error: "analytics_unavailable" } } : { json: fixture() }));
  await page.goto("/anutrium/monitor/ga4");
  await expect(page.locator(".monitor-dashboard").getByRole("alert")).toContainText("统计暂时无法读取");
  await expect(page.locator(".monitor-metrics").first().locator("strong")).toHaveText(["—", "—", "—", "—"]);
  await expect(page.locator(".monitor-live-content > strong")).toHaveText("0");
  failed = false;
  await page.getByRole("button", { name: "重新读取", exact: true }).click();
  await expect(page.locator(".monitor-metrics").first().locator("strong").first()).toHaveText("7");
  await expect(page.locator(".monitor-dashboard").getByRole("alert")).toHaveCount(0);
  failed = true;
  await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
  await expect(page.locator(".monitor-dashboard").getByRole("alert")).toContainText("当前保留上次结果");
  await expect(page.locator(".monitor-metrics").first().locator("strong").first()).toHaveText("7");
});

test("空数据有独立状态，相对更新时间随时钟自动变化", async ({ page }) => {
  await page.clock.install({ time: new Date("2026-10-17T01:05:00Z") });
  await page.route("**/api/analytics/summary?*", route => {
    const json = fixture();
    return route.fulfill({ json: { ...json, reports: json.reports.map(report => ({ ...report, rows: [], rowCount: 0 })) } });
  });
  await page.goto("/anutrium/monitor/ga4");
  await expect(page.getByRole("status")).toHaveText("已链接GA4");
  await expect(page.locator(".route-header .monitor-connection")).toHaveCSS("background-color", "rgb(25, 135, 84)");
  await expect(page.locator(".monitor-dashboard .monitor-connection")).toHaveCount(0);
  const headingBox = await page.locator(".page-heading h1").boundingBox();
  const badgeBox = await page.locator(".monitor-connection").boundingBox();
  expect(Math.abs(headingBox!.y + headingBox!.height / 2 - badgeBox!.y - badgeBox!.height / 2)).toBeLessThanOrEqual(1);
  await expect(page.locator(".monitor-dashboard")).not.toContainText("已连接统计服务，当前时间范围暂无访问数据");
  await expect(page.getByRole("region", { name: "页面浏览", exact: true })).toContainText("暂无数据");
  await expect(page.locator(".monitor-meta time")).toHaveText("5 分钟前");
  await expect(page.locator(".monitor-live time")).toHaveText("5 分钟前");
  await expect(page.locator(".monitor-meta time")).toHaveAttribute("datetime", generatedAt);
  await expect(page.locator(".monitor-meta time")).toHaveAttribute("title", /2026.*北京时间/);
  await page.clock.fastForward(120000);
  await expect(page.locator(".monitor-meta time")).toHaveText("7 分钟前");
});

test("服务端拒绝任意报表与时间范围", async ({ request }) => {
  for (const path of ["/api/analytics/private", "/api/analytics/summary?days=1", "/api/analytics/summary?days=NaN"]) {
    const response = await request.get(path);
    expect(response.status()).toBe(path.endsWith("private") ? 404 : 400);
    expect(response.headers()["cache-control"]).toBe("private, no-store");
  }
});

test("后台暂停轮询，恢复可见刷新，离开路由取消轮询", async ({ page }) => {
  let summaryCalls = 0;
  let realtimeCalls = 0;
  await page.clock.install();
  await page.route("**/api/analytics/summary?*", route => { summaryCalls++; return route.fulfill({ json: fixture() }); });
  await page.route("**/api/analytics/realtime", route => { realtimeCalls++; return route.fulfill({ json: { generatedAt, activeUsers: 0, reports: [] } }); });
  await page.goto("/anutrium/monitor/ga4");
  await expect(page.getByRole("region", { name: "概览", exact: true })).toHaveAttribute("aria-busy", "false");
  await expect(page.getByRole("region", { name: "实时统计", exact: true })).toHaveAttribute("aria-busy", "false");
  const initialSummary = summaryCalls;
  const initialRealtime = realtimeCalls;
  await page.clock.fastForward(60000);
  await expect.poll(() => realtimeCalls).toBe(initialRealtime + 1);
  await expect(page.getByRole("region", { name: "概览", exact: true })).toHaveAttribute("aria-busy", "false");
  await expect(page.getByRole("region", { name: "实时统计", exact: true })).toHaveAttribute("aria-busy", "false");
  expect(summaryCalls).toBe(initialSummary);
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", { configurable: true, value: true });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await page.clock.fastForward(600000);
  expect(summaryCalls).toBe(initialSummary);
  expect(realtimeCalls).toBe(initialRealtime + 1);
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", { configurable: true, value: false });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect.poll(() => summaryCalls).toBe(initialSummary + 1);
  await expect.poll(() => realtimeCalls).toBe(initialRealtime + 2);
  await (await openNavigation(page)).getByRole("link", { name: "功能调整", exact: true }).click();
  await expect(page).toHaveURL("/anutrium/features");
  await page.clock.fastForward(600000);
  expect(summaryCalls).toBe(initialSummary + 1);
  expect(realtimeCalls).toBe(initialRealtime + 2);
});


test("监视器分组、子路由、面包屑与分组跳转", async ({ page }) => {
  await page.route("**/api/analytics/summary?*", route => route.fulfill({ json: fixture() }));
  await page.goto("/anutrium/monitor");
  await expect(page).toHaveURL("/anutrium/monitor/ga4");
  const nav = await openNavigation(page);
  const group = nav.getByRole("button", { name: "监视器", exact: true });
  const child = nav.getByRole("link", { name: "GA4浏览量", exact: true });
  await expect(group).toHaveAttribute("aria-expanded", "true");
  await expect(child).toHaveAttribute("aria-current", "page");
  const dimensions = await nav.locator(".nav-item").evaluateAll(items => items.map(item => ({
    height: item.getBoundingClientRect().height,
    font: getComputedStyle(item.querySelector(".nav-label")!).fontSize,
    icon: item.querySelector(".menu-icon")!.getBoundingClientRect().width,
  })));
  for (const item of dimensions) expect(item).toEqual(dimensions[0]);
  await expect(page.getByRole("navigation", { name: "面包屑" })).toHaveText("Anutrium/监视器/GA4浏览量");
  await expect(page).toHaveTitle("GA4浏览量 · AnuConsole");
  await group.click();
  await expect(group).toHaveAttribute("aria-expanded", "false");
  await expect(child).toHaveCount(0);
  await group.focus();
  await page.keyboard.press("Enter");
  await expect(child).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight && document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
