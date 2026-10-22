import { test, expect } from "@playwright/test";
import { openNavigation } from "./helpers/navigation";

const data = {
  counts: { huahua: 100, xiaohei: 50 }, version: "1", updatedAt: null,
  limit: 10, timezone: "Asia/Shanghai", adjustments: [],
  days: [{ date: "2026-10-21", counts: { huahua: 123456, xiaohei: 1234 }, visitors: 12345,
    countries: { CN: 12345, "long-country-name": 12 }, devices: { mobile: 12345 }, browsers: { Safari: 12345 } }],
};

test("点击统计在直达、连续刷新及路由切换后保持同一布局", async ({ page }, testInfo) => {
  // 所有业务数据均为请求夹具；本测试不发出任何写入。
  await page.route("**/api/data/flora-likes", route => {
    expect(route.request().method()).toBe("GET");
    return route.fulfill({ json: data });
  });
  const mobile = testInfo.project.name !== "desktop";
  const snapshot = async () => {
    await expect(page.locator(".flora-like-table tbody")).toContainText("2026-10-21");
    await page.evaluate(() => document.fonts.ready);
    return page.locator(".flora-likes-panel").evaluate(panel => {
      const table = panel.querySelector<HTMLTableElement>("table")!;
      const wrapper = panel.querySelector<HTMLElement>(".flora-like-table")!;
      return {
        font: getComputedStyle(table).fontSize,
        tableLayout: getComputedStyle(table).tableLayout,
        columns: getComputedStyle(panel.querySelector(".flora-statistics-details")!).gridTemplateColumns,
        inputHeight: panel.querySelector("input")!.getBoundingClientRect().height,
        buttonHeight: panel.querySelector(".flora-likes-form button")!.getBoundingClientRect().height,
        tableOverflow: wrapper.scrollWidth > wrapper.clientWidth,
        pageOverflow: document.documentElement.scrollWidth > innerWidth,
      };
    });
  };
  await page.goto("/anutrium/data");
  const initial = await snapshot();
  expect(initial.inputHeight).toBe(48);
  expect(initial.buttonHeight).toBe(initial.inputHeight);
  expect(initial.pageOverflow).toBe(false);
  if (mobile) {
    expect(initial.font).toBe("11px");
    expect(initial.tableLayout).toBe("fixed");
    expect(initial.tableOverflow).toBe(false);
  }
  // 完整刷新重新获取样式，避免只验证热更新后的内存状态。
  for (let reload = 0; reload < 2; reload++) {
    await page.reload();
    expect(await snapshot()).toEqual(initial);
  }
  await (await openNavigation(page)).getByRole("link", { name: "首页", exact: true }).click();
  await expect(page).toHaveURL("/anutrium");
  await (await openNavigation(page)).getByRole("link", { name: "数据维护", exact: true }).click();
  expect(await snapshot()).toEqual(initial);
  await page.reload();
  expect(await snapshot()).toEqual(initial);
});

test("实时数字的手机端留白在刷新后保留", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === "desktop", "仅验证手机端留白");
  await page.route("**/api/analytics/realtime", route => route.fulfill({
    json: { generatedAt: new Date().toISOString(), activeUsers: 5, reports: [] },
  }));
  await page.goto("/anutrium");
  const number = page.locator(".monitor-live-content > strong");
  for (let load = 0; load < 3; load++) {
    if (load) await page.reload();
    await expect(number).toHaveText("5");
    await expect(number).toHaveCSS("padding-top", "12px");
    await expect(number).toHaveCSS("padding-bottom", "12px");
    await expect(number).toHaveCSS("min-height", "74px");
  }
});

test("手机登录输入保持适合 Safari 的字号且不限制手动缩放", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === "desktop", "桌面字号保持原样");
  await page.goto("/login");
  for (let load = 0; load < 2; load++) {
    if (load) await page.reload();
    await page.getByRole("tab", { name: "管理员", exact: true }).click();
    for (const id of ["username", "password"]) {
      const input = page.locator(`#${id}`);
      await input.click();
      await expect(input).toHaveCSS("font-size", "16px");
    }
    const viewport = await page.locator('meta[name="viewport"]').getAttribute("content");
    expect(viewport).not.toMatch(/user-scalable\s*=\s*no|maximum-scale\s*=\s*1(?:[\s,]|$)/);
  }
});

test("手机登录页始终留在窗口内，动画和标签切换不改变外框位置", async ({ page, browserName }, testInfo) => {
  test.skip(testInfo.project.name === "desktop", "仅限制手机登录布局");
  for (const viewport of [{ width: 320, height: 568 }, { width: 390, height: 664 }, { width: 402, height: 874 }, { width: 667, height: 375 }]) {
    await page.setViewportSize(viewport);
    await page.goto("/login");
    await page.evaluate(() => document.fonts.ready);
    const check = async () => {
      const geometry = await page.locator(".login-page").evaluate(el => {
        const active = el.querySelector('.login-panels > [role="tabpanel"]:not([hidden])')!;
        const bounds = el.getBoundingClientRect();
        const items = [el.querySelector(".login-tools")!, active.querySelector(".login-submit")!, el.querySelector(".login-footer")!];
        return {
          bounds: { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height },
          overflow: document.documentElement.scrollHeight > innerHeight || document.documentElement.scrollWidth > innerWidth,
          controlsInside: items.every(item => { const r = item.getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight && r.left >= 0 && r.right <= innerWidth; }),
        };
      });
      expect(geometry.overflow).toBe(false);
      expect(geometry.controlsInside).toBe(true);
      expect(geometry.bounds).toEqual({ x: 0, y: 0, ...viewport });
      return geometry.bounds;
    };
    const initial = await check();
    await expect(page.locator(".login-page")).toHaveCSS("touch-action", "pinch-zoom");
    await expect(page.locator("html")).toHaveCSS("overscroll-behavior-y", "none");
    // 移动 WebKit 不支持滚轮模拟；Chromium 额外验证默认滚动行为。
    if (browserName === "chromium") {
      await page.mouse.move(viewport.width / 2, viewport.height / 2);
      await page.mouse.wheel(0, 400);
    }
    expect(await check()).toEqual(initial);
    expect(await page.evaluate(() => scrollY)).toBe(0);
    await page.getByRole("tab", { name: "管理员", exact: true }).click();
    await expect(page.getByRole("tab", { name: "管理员", exact: true })).toHaveAttribute("aria-selected", "true");
    expect(await check()).toEqual(initial);
    // 从正在输入切到完整代码，覆盖代码高度大幅变化的情况。
    await page.emulateMedia({ reducedMotion: "reduce" });
    expect(await check()).toEqual(initial);
    await page.evaluate(() => window.scrollTo(0, 300));
    expect(await page.evaluate(() => scrollY)).toBe(0);
    expect(await page.locator("body").evaluate(el => el.style.overflow)).toBe("");
    await page.reload();
    expect(await check()).toEqual(initial);
    await page.emulateMedia({ reducedMotion: "no-preference" });
  }
});
