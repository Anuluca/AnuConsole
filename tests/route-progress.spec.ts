import { test, expect } from "@playwright/test";
import { openNavigation } from "./helpers/navigation";

test("路由响应等待期间显示进度条，完成后清除且不移动框架", async ({ page }) => {
  test.skip(process.env.E2E_AUTH_MODE === "production", "使用开发服务验证导航等待状态");
  let release = () => {};
  const waiting = new Promise<void>(resolve => { release = resolve; });
  // 延迟真实页面请求，验证进度条覆盖服务端等待时间，而非只在切换后播放。
  await page.route("**/anutrium/features**", async route => {
    await waiting;
    await route.continue();
  });
  await page.goto("/anutrium/about");
  const before = await page.locator(".main-content").boundingBox();
  const navigation = await openNavigation(page);
  const click = navigation.getByRole("link", { name: "功能调整", exact: true }).click();
  try {
    await expect(page.getByRole("progressbar", { name: "页面加载进度" })).toBeVisible();
    await expect(page).toHaveURL("/anutrium/about");
  } finally {
    release();
  }
  await click;
  await expect(page).toHaveURL("/anutrium/features");
  await expect(page.getByRole("progressbar")).toHaveCount(0);
  const after = await page.locator(".main-content").boundingBox();
  expect(after?.x).toBe(before?.x);
  expect(after?.y).toBe(before?.y);
});
