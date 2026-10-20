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
