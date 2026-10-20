import { test, expect } from "@playwright/test";

test("构建状态仅在可见时轮询，恢复页面立即读取", async ({ page }) => {
  test.skip(process.env.E2E_AUTH_MODE === "production", "使用开发服务与模拟平台验证轮询");
  await page.clock.install();
  let calls = 0;
  await page.route("**/api/infrastructure/netlify/demo-site**", route => {
    if (new URL(route.request().url()).pathname.endsWith("/deploys")) {
      calls++;
      return route.fulfill({ json: { deploys: [{ id: "building", state: "building", title: "测试构建" }], page: 1, hasMore: false } });
    }
    return route.fulfill({ json: { id: "demo-site", name: "测试项目", admin_url: "https://example.invalid", settings: {} } });
  });
  await page.goto("/anutrium/infrastructure/netlify?site=demo-site");
  await expect(page.locator(".infra-deploy")).toContainText("测试构建");
  const initial = calls;
  await page.clock.fastForward(15000);
  await expect.poll(() => calls).toBe(initial + 1);
  await expect(page.locator(".infra-deploy")).toBeVisible();
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", { configurable: true, value: true });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await page.clock.fastForward(60000);
  expect(calls).toBe(initial + 1);
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", { configurable: true, value: false });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect.poll(() => calls).toBe(initial + 2);
  await expect(page.locator(".infra-deploy")).toBeVisible();
});
