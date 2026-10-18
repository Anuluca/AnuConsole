import { test, expect } from "@playwright/test";

test("登录与确认退出跨页面过渡", async ({ page, context }) => {
  const password = process.env.E2E_ADMIN_PASSWORD;
  if (!password) throw new Error("请通过 E2E_ADMIN_PASSWORD 提供本地测试密码。");
  await page.goto("/login");
  await page.getByLabel("登录密码", { exact: true }).fill(password);
  await page.getByRole("button", { name: "登录", exact: true }).click();
  await expect(page).toHaveURL("/anutrium");
  await expect(page.getByRole("heading", { name: "首页", exact: true })).toBeVisible();
  await expect(page.locator(".page-surface")).toHaveCSS("animation-name", "page-enter");
  expect((await context.cookies()).some(cookie => cookie.name === "anuconsole_session")).toBe(true);
  await page.getByRole("button", { name: "退出", exact: true }).click();
  await expect(page.getByRole("alertdialog")).toBeVisible();
  await page.getByRole("button", { name: "确认退出", exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.locator(".page-surface")).toHaveCSS("animation-name", "page-enter");
  expect((await context.cookies()).some(cookie => cookie.name === "anuconsole_session")).toBe(false);
});
