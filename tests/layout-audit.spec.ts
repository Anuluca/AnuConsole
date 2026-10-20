import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  test.skip(
    process.env.E2E_AUTH_MODE === "production",
    "复用开发服务；生产身份验证由授权测试覆盖",
  );
  // 只使用模拟读取；验证布局和连接标识时不访问真实平台或执行写入。
  await page.route("**/api/**", (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/api/features/home")
      return route.fulfill({
        json: { lucarioHeadache: false, headacheCount: 5, updatedAt: null },
      });
    if (path === "/api/infrastructure/connections")
      return route.fulfill({ json: { cloudflare: true, netlify: true } });
    if (path === "/api/analytics/realtime")
      return route.fulfill({ json: { activeUsers: 2, reports: [] } });
    return route.fulfill({
      json: {
        reports: [
          {
            id: "overview",
            status: "ready",
            rows: [
              {
                dimensions: [],
                metrics: {
                  activeUsers: 1,
                  screenPageViews: 200,
                  sessions: 40,
                  userEngagementDuration: 125,
                },
              },
            ],
          },
          { id: "engagement", status: "ready", rows: [] },
        ],
      },
    });
  });
});

test("首页重构保留排列、等高、数值对齐与手机字号", async ({
  page,
}, testInfo) => {
  await page.goto("/anutrium");
  await expect(page.locator(".monitor-metric strong").first()).toHaveText("1");
  await expect(page.getByRole("switch")).toBeEnabled();
  const geometry = await page.evaluate(() => {
    const rect = (selector: string) => {
      const box = document.querySelector(selector)!.getBoundingClientRect();
      return { x: box.x, y: box.y, width: box.width, height: box.height };
    };
    return {
      live: rect(".home-live-panel"),
      overview: rect(".home-analytics-grid > .monitor-overview"),
      feature: rect(".project-home .feature-module"),
      values: Array.from(
        document.querySelectorAll(".monitor-metric strong"),
        (node) =>
          node.getBoundingClientRect().y +
          node.getBoundingClientRect().height / 2,
      ),
      sizes: Array.from(
        document.querySelectorAll(".monitor-metric strong"),
        (node) => getComputedStyle(node).fontSize,
      ),
      overflow: document.documentElement.scrollWidth > innerWidth,
    };
  });
  expect(geometry.live.x).toBeLessThan(geometry.overview.x);
  expect(
    Math.abs(geometry.overview.width / geometry.live.width - 2),
  ).toBeLessThan(0.03);
  expect(geometry.live.y).toBe(geometry.overview.y);
  expect(
    Math.max(...geometry.values) - Math.min(...geometry.values),
  ).toBeLessThan(1);
  if (testInfo.project.name === "desktop")
    expect(geometry.feature.height).toBe(geometry.overview.height);
  else expect(geometry.sizes).toEqual(["14px", "14px", "14px", "12px"]);
  expect(geometry.overflow).toBe(false);
  await page.screenshot({
    path: testInfo.outputPath("home-layout.png"),
    fullPage: true,
  });
});

test("功能调整共用一个轻量连接接口，两个标识独立反映结果", async ({ page }, testInfo) => {
  const paths = new Set<string>();
  page.on("request", (request) => {
    const path = new URL(request.url()).pathname;
    if (path.startsWith("/api/infrastructure/")) paths.add(path);
  });
  await page.route("**/api/infrastructure/connections", (route) => {
    return route.fulfill({ json: { cloudflare: true, netlify: true } });
  });
  await page.goto("/anutrium/features");
  const statuses = page.locator(".route-heading-status");
  await expect(statuses.getByRole("status")).toHaveText([
    "已链接Cloudflare",
    "已链接Netlify",
  ]);
  if (testInfo.project.name === "mobile") {
    const badges = await statuses.getByRole("status").all();
    const first = (await badges[0].boundingBox())!;
    const second = (await badges[1].boundingBox())!;
    const refresh = (await statuses.getByRole("button", { name: "刷新", exact: true }).boundingBox())!;
    expect(first.y).toBe(second.y);
    expect(first.y).toBeGreaterThanOrEqual(refresh.y + refresh.height);
    expect((await statuses.boundingBox())!.width).toBeLessThanOrEqual(200);
    const title = page.locator(".page-heading h1");
    const titleBounds = (await title.boundingBox())!;
    expect(first.x).toBeGreaterThanOrEqual(titleBounds.x + titleBounds.width);
    expect(refresh.y).toBeLessThan(titleBounds.y + titleBounds.height);
    expect(await title.evaluate(el => el.getBoundingClientRect().height <= parseFloat(getComputedStyle(el).lineHeight) + 1)).toBe(true);
  }
  // 开发 StrictMode 可取消并重启读取；校验只使用状态接口，不下载完整业务列表。
  expect([...paths]).toEqual(["/api/infrastructure/connections"]);
  await page.route("**/api/infrastructure/connections", (route) =>
    route.fulfill({ json: { cloudflare: true, netlify: false } }),
  );
  await page.reload();
  await expect(statuses.getByRole("status")).toHaveText(["已链接Cloudflare"]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
