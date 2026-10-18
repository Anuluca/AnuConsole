import { test, expect } from "@playwright/test";
import { loginCode } from "../src/lib/login-code";

test("代码输入动画与减少动态效果", async ({ page }) => {
  await page.goto("/login");
  const code = page.locator(".code-animation");
  const initial = Number(await code.getAttribute("data-typed"));
  await expect.poll(async () => Number(await code.getAttribute("data-typed"))).toBeGreaterThan(initial);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(code.locator(".code-line")).toHaveCount(loginCode.split("\n").length);
  await expect(code).toContainText("export function ThemeProvider");
  await expect(page.locator(".code-cursor")).toHaveCSS("animation-name", "none");
  const complete = await code.getAttribute("data-typed");
  await page.getByRole("heading").click();
  expect(await code.getAttribute("data-typed")).toBe(complete);
});

test("确认框柔和阴影与进出场动画", async ({ page }) => {
  await page.goto("/anutrium/data");
  const dialog = page.getByRole("alertdialog");
  const main = await page.locator(".main-content").boundingBox();
  await page.getByRole("button", { name: "退出", exact: true }).click();
  await expect(dialog).toBeVisible();
  await expect(dialog).toHaveAttribute("data-phase", "open");
  await expect(dialog.locator("h2")).toHaveCSS("font-weight", "900");
  const shadow = await dialog.evaluate(element => getComputedStyle(element).boxShadow);
  expect(shadow).toMatch(/(?:90|100)px/);
  await page.getByRole("button", { name: "取消", exact: true }).click();
  await expect(dialog).toHaveAttribute("data-phase", "leaving");
  await expect(dialog).not.toBeVisible();
  const after = await page.locator(".main-content").boundingBox();
  expect(Math.abs(after!.x - main!.x)).toBeLessThanOrEqual(1);
  expect(Math.abs(after!.y - main!.y)).toBeLessThanOrEqual(1);
  await expect(page).toHaveURL("/anutrium/data");
  await page.getByRole("button", { name: "退出", exact: true }).click();
  await expect(dialog).toHaveAttribute("data-phase", "open");
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  await expect(page.getByRole("button", { name: "退出", exact: true })).toBeFocused();
});
