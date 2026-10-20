import type { Page } from "@playwright/test";

export async function openNavigation(page: Page) {
  const trigger = page.getByRole("button", { name: "打开菜单", exact: true });
  if (await trigger.isVisible() && await trigger.getAttribute("aria-expanded") !== "true") await trigger.click();
  return page.getByRole("navigation", { name: "主导航", exact: true });
}

export async function openLogoutConfirmation(page: Page) {
  const logout = page.getByRole("button", { name: "退出", exact: true });
  if (!await logout.isVisible()) await openNavigation(page);
  await logout.click();
}
