import { test, expect } from "@playwright/test";
import { openNavigation } from "./helpers/navigation";

test("正文独立滚动，标题与框架固定，卡片不超出视口", async ({ page }, testInfo) => {
  test.skip(process.env.E2E_AUTH_MODE === "production", "使用开发环境验证框架几何");
  await page.route("**/api/analytics/**", route => route.fulfill({ json: route.request().url().includes("summary")
    ? { days: 7, generatedAt: "2026-10-17T01:00:00Z", timeZone: "Asia/Shanghai", reports: [] }
    : { generatedAt: "2026-10-17T01:00:00Z", activeUsers: 0, reports: [] } }));
  await page.goto("/anutrium/monitor/ga4");
  const scroll = page.getByRole("region", { name: "页面内容", exact: true });
  await expect(page.getByRole("region", { name: "概览", exact: true })).toHaveAttribute("aria-busy", "false");
  const geometry = () => page.evaluate(() => [".topbar", ".sidebar", ".main-content", ".route-header", ".console-footer"].map(selector => {
    const rect = document.querySelector(selector)!.getBoundingClientRect();
    return { top: rect.top, left: rect.left, bottom: rect.bottom, right: rect.right };
  }));
  const before = await geometry();
  const viewport = page.viewportSize()!;
  for (const rect of before) {
    expect(rect.top).toBeGreaterThanOrEqual(0);
    expect(rect.left).toBeGreaterThanOrEqual(0);
    expect(rect.bottom).toBeLessThanOrEqual(viewport.height);
    expect(rect.right).toBeLessThanOrEqual(viewport.width);
  }
  await expect(page.locator(".route-header")).toHaveCSS("border-bottom-width", "1px");
  await scroll.hover();
  await page.mouse.wheel(0, 600);
  await expect.poll(() => scroll.evaluate(el => el.scrollTop)).toBeGreaterThan(0);
  const after = await geometry();
  for (let index = 0; index < before.length; index++) {
    for (const key of ["top", "left", "bottom", "right"] as const) expect(Math.abs(after[index][key] - before[index][key])).toBeLessThanOrEqual(1);
  }
  await scroll.evaluate(el => { el.scrollTop = el.scrollHeight; });
  await page.mouse.wheel(0, 2000);
  expect(await page.evaluate(() => window.scrollY)).toBe(0);
  expect(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight && document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await expect(page.locator(".monitor-details")).toBeInViewport();
  await page.screenshot({ path: testInfo.outputPath("monitor-scroll.png") });
  await (await openNavigation(page)).getByRole("link", { name: "功能调整", exact: true }).click();
  await expect(page).toHaveURL("/anutrium/features");
  expect(await scroll.evaluate(el => el.scrollTop)).toBe(0);
  // 路由闪烁各帧中，标题与框架的位置均不得漂移。
  const samples = await page.evaluate(async () => {
    const samples: number[][] = [];
    for (let i = 0; i < 15; i++) {
      await new Promise(requestAnimationFrame);
      samples.push([".main-content", ".route-header", ".sidebar"].flatMap(selector => {
        const rect = document.querySelector(selector)!.getBoundingClientRect();
        return [rect.top, rect.left];
      }));
    }
    return samples;
  });
  for (const sample of samples) sample.forEach((value, i) => expect(Math.abs(value - samples[0][i])).toBeLessThanOrEqual(1));
  expect(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight)).toBe(true);
});
