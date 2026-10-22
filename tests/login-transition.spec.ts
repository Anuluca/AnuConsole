import { openLogoutConfirmation } from "./helpers/navigation";
import { test, expect } from "@playwright/test";

test("登录与确认退出跨页面过渡", async ({ page, context }) => {
  const password = process.env.E2E_ADMIN_PASSWORD;
  if (!password) {
    test.skip(true, "未提供 E2E_ADMIN_PASSWORD，不能执行真实登录回归。");
    return;
  }
  await page.goto("/login");
  await page.getByRole("tab", { name: "管理员", exact: true }).click();
  await page.getByLabel("登录密码", { exact: true }).fill(password);
  await page.getByRole("button", { name: "登录", exact: true }).click();
  await expect(page).toHaveURL("/anutrium");
  await expect(page.getByRole("heading", { name: "首页", exact: true })).toBeVisible();
  await expect(page.locator(".page-surface")).toHaveCSS("animation-name", "page-enter");
  expect((await context.cookies()).some(cookie => cookie.name === "anuconsole_session")).toBe(true);
  await openLogoutConfirmation(page);
  await expect(page.getByRole("alertdialog")).toBeVisible();
  await page.getByRole("button", { name: "确认退出", exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.locator(".page-surface")).toHaveCSS("animation-name", "page-enter");
  expect((await context.cookies()).some(cookie => cookie.name === "anuconsole_session")).toBe(false);
});


test("默认游客入口、键盘切换与免密码访问", async ({ page, context }) => {
  await page.goto("/login");
  const guest = page.getByRole("tab", { name: "游客", exact: true });
  await expect(guest).toHaveAttribute("aria-selected", "true");
  await expect(page.getByLabel("登录密码", { exact: true })).toBeHidden();
  const before = await page.locator(".login-panel-inner").boundingBox();
  await guest.focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("tab", { name: "管理员", exact: true })).toHaveAttribute("aria-selected", "true");
  await expect(guest).toBeFocused();
  await expect(page.getByLabel("登录密码", { exact: true })).toBeVisible();
  const after = await page.locator(".login-panel-inner").boundingBox();
  expect(after).toEqual(before);
  const button = await page.getByRole("button", { name: "登录", exact: true }).boundingBox();
  const form = await page.locator("#login-panel-admin .login-form").boundingBox();
  expect(button!.width).toBeCloseTo(form!.width, 0);
  await page.keyboard.press("Home");
  const loginStartedAt = Date.now() / 1000;
  await page.getByRole("button", { name: "游客访问", exact: true }).click();
  await expect(page).toHaveURL("/anutrium");
  await expect(page.locator(".account")).toContainText("guest");
  const sessionCookie = (await context.cookies()).find(cookie => cookie.name === "anuconsole_session");
  // 必须为持久 Cookie，不能仅在当前浏览器进程内保留会话。
  expect(sessionCookie).toBeDefined();
  expect(sessionCookie!.expires).toBeGreaterThanOrEqual(loginStartedAt + 14 * 86400 - 1);
  expect(sessionCookie!.expires).toBeLessThanOrEqual(Date.now() / 1000 + 14 * 86400 + 1);
  await page.reload();
  await expect(page.locator(".account")).toContainText("guest");
  const denied = await page.request.put("/api/features/home", { data: { lucarioHeadache: false } });
  expect(denied.status()).toBe(403);
});
