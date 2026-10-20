import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  // 开关测试不依赖真实平台连接，双连接标识由 layout-audit.spec.ts 单独覆盖。
  await page.route("**/api/infrastructure/connections", route => route.fulfill({ json: { cloudflare: false, netlify: false } }));
});

test("首页开关读取真实状态、保存成功后更新，失败后重新读取", async ({ page }) => {
  test.skip(process.env.E2E_AUTH_MODE === "production", "生产身份验证由认证回归覆盖");
  let enabled = true;
  let fail = false;
  let count = 10;
  let holdSave: (() => void) | undefined;
  await page.route("**/api/features/home", async route => {
    if (route.request().method() === "PUT") {
      await new Promise<void>(resolve => { holdSave = resolve; });
      if (fail) return route.fulfill({ status: 502, json: { error: "home_features_unavailable" } });
      const next = route.request().postDataJSON().lucarioHeadache;
      if (!enabled && next) count++;
      enabled = next;
    }
    return route.fulfill({ json: { lucarioHeadache: enabled, headacheCount: count, updatedAt: null } });
  });
  await page.goto("/anutrium/features");
  const toggle = page.getByRole("switch", { name: "路卡雕像的头疼模式" });
  await expect(page.getByRole("heading", { level: 2, name: "首页" })).toBeVisible();
  await expect(toggle).toBeChecked();
  await expect(page.getByText("累计头疼 10 次")).toBeVisible();
  await toggle.focus();
  await page.keyboard.press("Space");
  await expect(toggle).toBeDisabled();
  await expect(toggle).toBeChecked();
  await expect.poll(() => !!holdSave).toBe(true);
  holdSave!();
  await expect(toggle).not.toBeChecked();
  await expect(toggle).toBeEnabled();
  fail = true;
  holdSave = undefined;
  await toggle.click();
  await expect.poll(() => !!holdSave).toBe(true);
  holdSave!();
  await expect(page.locator(".features-workspace").getByRole("alert")).toContainText("保存结果未确认");
  await expect(toggle).toHaveCount(0);
  await page.getByRole("button", { name: "重试" }).click();
  await expect(toggle).toBeEnabled();
  await expect(toggle).not.toBeChecked();
  await expect(page.getByText("累计头疼 10 次")).toBeVisible();
  fail = false;
  holdSave = undefined;
  await toggle.click();
  await expect.poll(() => !!holdSave).toBe(true);
  holdSave!();
  await expect(toggle).toBeChecked();
  await expect(page.getByText("累计头疼 11 次")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("读取失败不冒充关闭状态，重试后可操作", async ({ page }) => {
  test.skip(process.env.E2E_AUTH_MODE === "production", "生产身份验证由认证回归覆盖");
  let failed = true;
  await page.route("**/api/features/home", route => route.fulfill(failed
    ? { status: 503, json: { error: "home_features_not_configured" } }
    : { json: { lucarioHeadache: false, headacheCount: 10, updatedAt: null } }));
  await page.goto("/anutrium/features");
  await expect(page.locator(".features-workspace").getByRole("alert")).toContainText("尚未配置");
  await expect(page.getByRole("switch")).toHaveCount(0);
  await expect(page.locator(".feature-control")).toHaveCount(0);
  failed = false;
  await page.getByRole("button", { name: "重试" }).click();
  await expect(page.getByRole("switch")).toBeEnabled();
  await expect(page.locator(".feature-control").getByRole("status")).toHaveText("已关闭");
});

test("写入接口拒绝跨站请求和无效参数", async ({ request }) => {
  test.skip(process.env.E2E_AUTH_MODE === "production", "生产身份验证由认证回归覆盖");
  const url = "/api/features/home";
  const denied = await request.put(url, { headers: { Origin: "https://untrusted.invalid" }, data: { lucarioHeadache: true } });
  expect(denied.status()).toBe(403);
  for (const data of [{}, { lucarioHeadache: "true" }, { lucarioHeadache: true, extra: 1 }]) {
    const response = await request.put(url, { headers: { Origin: "http://127.0.0.1:3002" }, data });
    expect(response.status()).toBe(400);
  }
});

test("旧版接口仍可读写开关，次数未知时不显示虚假计数", async ({ page }) => {
  test.skip(process.env.E2E_AUTH_MODE === "production", "生产身份验证由认证回归覆盖");
  let enabled = true;
  await page.route("**/api/features/home", route => {
    if (route.request().method() === "PUT") enabled = route.request().postDataJSON().lucarioHeadache;
    return route.fulfill({ json: { lucarioHeadache: enabled, updatedAt: null } });
  });
  await page.goto("/anutrium/features");
  const toggle = page.getByRole("switch", { name: "路卡雕像的头疼模式" });
  await expect(toggle).toBeChecked();
  await expect(page.locator("#lucario-headache-description")).toHaveText("每次从关闭切换为开启记录一次，保存后刷新首页生效。");
  await expect(page.getByText(/累计头疼/)).toHaveCount(0);
  await toggle.click();
  await expect(toggle).not.toBeChecked();
  await expect(toggle).toBeEnabled();
  await expect(page.locator(".features-workspace").getByRole("alert")).toHaveCount(0);
});
