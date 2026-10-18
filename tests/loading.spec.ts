import { test, expect } from "@playwright/test";

test.beforeEach(() => { test.skip(process.env.E2E_AUTH_MODE === "production", "读取状态界面复用开发服务，所有接口均使用模拟数据"); });

test("运维读取使用居中图标，支持减少动态效果，成功后恢复列表", async ({ page }) => {
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  await page.route("**/api/infrastructure/dns**", async route => {
    await gate;
    await route.fulfill({ json: { records: [], page: 1, pages: 1, total: 0, zone: "anuluca.com" } });
  });
  await page.goto("/anutrium/infrastructure/dns");
  const indicator = page.getByRole("status", { name: "正在读取数据", exact: true });
  await expect(indicator).toBeVisible();
  await expect(indicator).toHaveText("");
  const icon = indicator.locator("svg");
  const area = await indicator.boundingBox();
  const bounds = await icon.boundingBox();
  expect(Math.abs(bounds!.x + bounds!.width / 2 - area!.x - area!.width / 2)).toBeLessThan(1);
  expect(Math.abs(bounds!.y + bounds!.height / 2 - area!.y - area!.height / 2)).toBeLessThan(1);
  await expect(icon).toHaveCSS("animation-name", "loading-indicator-spin");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(icon).toHaveCSS("animation-name", "none");
  release();
  await expect(indicator).toHaveCount(0);
  await expect(page.getByText("没有符合条件的 DNS 记录。", { exact: true })).toBeVisible();
});

test("功能开关初次读取显示居中图标，成功后显示真实状态", async ({ page }) => {
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  await page.route("**/api/features/home", async route => {
    await gate;
    await route.fulfill({ json: { lucarioHeadache: false, headacheCount: 0, updatedAt: null } });
  });
  await page.goto("/anutrium/features");
  const indicator = page.getByRole("status", { name: "正在读取功能状态", exact: true });
  await expect(indicator).toBeVisible();
  await expect(page.getByRole("switch")).toHaveCount(0);
  release();
  await expect(indicator).toHaveCount(0);
  await expect(page.getByRole("switch", { name: "路卡雕像的头疼模式" })).toBeEnabled();
  await expect(page.getByText("已关闭", { exact: true })).toBeVisible();
});

test("GA4 统计、趋势和报表读取均使用图标，失败后恢复重试提示", async ({ page }) => {
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  await page.route("**/api/analytics/**", async route => {
    await gate;
    await route.fulfill({ status: 502, json: { error: "analytics_unavailable" } });
  });
  await page.goto("/anutrium/monitor/ga4");
  await expect(page.getByRole("status", { name: "正在读取统计", exact: true })).toBeVisible();
  await expect(page.getByRole("status", { name: "正在读取趋势", exact: true })).toBeVisible();
  await expect(page.getByRole("status", { name: "正在读取页面浏览", exact: true })).toBeVisible();
  await expect(page.getByRole("region", { name: "监视器内容区" }).getByText(/正在读取/)).toHaveCount(0);
  release();
  await expect(page.locator(".loading-indicator")).toHaveCount(0);
  await expect(page.locator(".monitor-summary-error")).toBeVisible();
  await expect(page.getByRole("region", { name: "每日趋势", exact: true })).toContainText("趋势暂不可用");
});
