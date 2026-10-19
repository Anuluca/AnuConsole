import { test, expect } from "@playwright/test";

const report = (id: string, metrics: Record<string, number>, dimensions: string[] = []) => ({
  id, status: "ready", rows: [{ dimensions, metrics }], rowCount: 1,
  thresholded: false, sampled: false, dataLoss: false,
});

test("Anutrium 首页展示今天概览、实时人数，并复用头疼模式开关", async ({ page }) => {
  test.skip(process.env.E2E_AUTH_MODE === "production", "复用开发服务，权限由授权测试覆盖");
  let enabled = false;
  let count = 5;
  await page.route("**/api/analytics/summary?*", route => {
    const days = Number(new URL(route.request().url()).searchParams.get("days"));
    return route.fulfill({ json: { days, generatedAt: new Date().toISOString(), timeZone: "Asia/Shanghai", reports: [
      report("overview", { activeUsers: days, screenPageViews: 200, sessions: 40 }),
      report("engagement", { userEngagementDuration: 125 }),
      report("trend", { screenPageViews: 200, activeUsers: days, sessions: 40 }, ["20261019"]),
    ] } });
  });
  await page.route("**/api/analytics/realtime", route => route.fulfill({ json: {
    generatedAt: new Date().toISOString(), activeUsers: 0, reports: [],
  } }));
  // 仅写测试夹具，不调用真实 Worker。
  await page.route("**/api/features/home", route => {
    if (route.request().method() === "PUT") {
      const next = route.request().postDataJSON().lucarioHeadache;
      if (!enabled && next) count++;
      enabled = next;
    }
    return route.fulfill({ json: { lucarioHeadache: enabled, headacheCount: count, updatedAt: null } });
  });
  await page.goto("/anutrium");
  const overview = page.getByRole("region", { name: "概览", exact: true });
  await expect(page.getByRole("group", { name: "统计时间范围" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "更多指标" })).toHaveCount(0);
  await expect(page.locator(".monitor-meta")).toHaveCount(0);
  await expect(overview.locator(".monitor-metric > strong")).toHaveText(["1", "200", "40", "2分5秒"]);
  await expect(page.locator(".monitor-live-content > strong")).toHaveText("0");
  await expect(page.getByRole("region", { name: "每日趋势", exact: true })).toBeVisible();
  await expect(page.locator(".monitor-chart")).toBeVisible();
  await expect(page.getByRole("region", { name: "分类报表", exact: true })).toHaveCount(0);
  const toggle = page.getByRole("switch", { name: "路卡雕像的头疼模式" });
  await expect(toggle).toBeEnabled();
  await toggle.click();
  await expect(toggle).toBeChecked();
  await expect(page.getByText("累计头疼 6 次")).toBeVisible();
  await page.reload();
  await expect(toggle).toBeChecked();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("首页概览失败不伪造零值，实时人数仍可显示并支持重试", async ({ page }) => {
  test.skip(process.env.E2E_AUTH_MODE === "production", "复用开发服务，权限由授权测试覆盖");
  let failed = true;
  await page.route("**/api/analytics/summary?*", route => route.fulfill(failed
    ? { status: 502, json: { error: "analytics_unavailable" } }
    : { json: { days: 1, generatedAt: new Date().toISOString(), timeZone: "Asia/Shanghai", reports: [report("overview", { activeUsers: 3 })] } }));
  await page.route("**/api/analytics/realtime", route => route.fulfill({ json: {
    generatedAt: new Date().toISOString(), activeUsers: 0, reports: [],
  } }));
  await page.route("**/api/features/home", route => route.fulfill({ json: { lucarioHeadache: false, headacheCount: 0, updatedAt: null } }));
  await page.goto("/anutrium");
  const analytics = page.getByRole("region", { name: "浏览量概览", exact: true });
  await expect(analytics.getByRole("alert")).toContainText("读取失败");
  await expect(analytics.locator(".monitor-metric > strong")).toHaveText(["—", "—", "—", "—"]);
  await expect(analytics.locator(".monitor-live-content > strong")).toHaveText("0");
  failed = false;
  await analytics.getByRole("button", { name: "重试", exact: true }).click();
  await expect(analytics.locator(".monitor-metric > strong").first()).toHaveText("3");
  await expect(analytics.getByRole("alert")).toHaveCount(0);
});
