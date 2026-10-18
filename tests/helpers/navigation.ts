import type { Page } from "@playwright/test";

export async function openNavigation(page: Page) {
  const trigger = page.getByRole("button", { name: "打开菜单", exact: true });
  if (await trigger.isVisible() && await trigger.getAttribute("aria-expanded") !== "true") await trigger.click();
  return page.getByRole("navigation", { name: "主导航", exact: true });
}
