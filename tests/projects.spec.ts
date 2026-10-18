import { test, expect } from "@playwright/test";
import { openNavigation } from "./helpers/navigation";

test("项目地址决定菜单、主题色和可访问的业务路由", async ({ page }, testInfo) => {
  test.skip(process.env.E2E_AUTH_MODE === "production", "开发环境验证项目切换，生产身份认证由 console.spec.ts 覆盖");
  await page.goto("/");
  await expect(page).toHaveURL("/anutrium");
  await expect(page.locator(".console")).toHaveCSS("--accent", "#E23456");
  await expect((await openNavigation(page)).getByRole("link")).toHaveText(["首页", "GA4浏览量", "功能调整", "数据维护", "关于"]);
  if (testInfo.project.name === "mobile") await page.getByRole("button", { name: "关闭菜单" }).click();

  const trigger = page.getByRole("button", { name: /当前项目：Anutrium/ });
  await trigger.click();
  const choices = page.getByRole("navigation", { name: "切换项目" });
  await expect(choices.getByRole("link")).toHaveText(["Anutrium", "DRRR情报屋"]);
  await choices.getByRole("link", { name: "DRRR情报屋" }).click();
  await expect(page).toHaveURL("/drrr");
  await expect(page.locator(".console")).toHaveCSS("--accent", "#f4f500");
  await expect(page.getByRole("button", { name: /当前项目：DRRR情报屋/ })).toHaveCSS("color", "rgb(244, 245, 0)");
  await expect((await openNavigation(page)).getByRole("link")).toHaveText(["首页", "关于"]);
  if (testInfo.project.name === "mobile") await expect(choices).toHaveCount(0);
  else await expect(choices).toBeVisible();

  await (await openNavigation(page)).getByRole("link", { name: "关于", exact: true }).click();
  await expect(page).toHaveURL("/drrr/about");
  await page.reload();
  await expect(page.locator(".console")).toHaveAttribute("data-project", "drrr");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("关于");
  await expect(page.locator(".empty-workspace")).toBeEmpty();

  await page.goto("/drrr/features");
  await expect(page.getByRole("heading", { name: /页面不存在/ })).toBeVisible();
  await page.goto("/features");
  await expect(page.getByRole("heading", { name: /页面不存在/ })).toBeVisible();
});

test("项目选择器支持 Escape，并按设备控制收起", async ({ page }, testInfo) => {
  test.skip(process.env.E2E_AUTH_MODE === "production", "开发环境验证项目切换");
  await page.goto("/anutrium");
  const trigger = page.getByRole("button", { name: /当前项目：Anutrium/ });
  await trigger.click();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("navigation", { name: "切换项目" })).toHaveCount(0);
  await expect(trigger).toBeFocused();
  await trigger.click();
  await page.getByRole("link", { name: "DRRR情报屋", exact: true }).click();
  await expect(page).toHaveURL("/drrr");
  const choices = page.getByRole("navigation", { name: "切换项目" });
  if (testInfo.project.name === "mobile") await expect(choices).toHaveCount(0);
  else await expect(choices).toBeVisible();
});
