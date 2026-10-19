import { test, expect } from "@playwright/test";
import { openNavigation } from "./helpers/navigation";

test("Anutrium 关于页显示简洁的项目链接", async ({ page }) => {
  test.skip(process.env.E2E_AUTH_MODE === "production", "开发环境验证关于页内容");
  await page.goto("/anutrium/about");
  const about = page.getByRole("region", { name: "关于内容区" });
  await expect(about).toContainText("Anutrium 等多个项目的管理后台");
  await expect(about).not.toContainText(/当前项目|共用能力|项目源码/);
  const github = about.getByRole("link", { name: "在新标签页打开 AnuConsole GitHub 仓库" });
  const website = about.getByRole("link", { name: "在新标签页打开 Anutrium 网站" });
  await expect(github).toHaveAttribute("href", "https://github.com/Anuluca/AnuConsole");
  await expect(website).toHaveAttribute("href", "https://anuluca.com");
  await expect(about).toContainText("开发者：Anuluca");
  await expect(about.getByRole("link", { name: "邮件反馈：tilucario@outlook.com" })).toHaveAttribute("href", "mailto:tilucario@outlook.com");
  await website.scrollIntoViewIfNeeded();
  await expect(website).toBeVisible();
});

test("项目地址决定菜单、主题色和可访问的业务路由", async ({ page }, testInfo) => {
  test.skip(process.env.E2E_AUTH_MODE === "production", "开发环境验证项目切换，生产身份认证由 console.spec.ts 覆盖");
  await page.goto("/");
  await expect(page).toHaveURL("/anutrium");
  await expect(page.locator(".console")).toHaveCSS("--accent", "#E23456");
  const themeTrigger = page.getByRole("button", { name: "显示主题", exact: true });
  // 未配置主题覆盖的项目，切换浅色与深色后仍使用同一个项目色。
  for (const theme of ["深色", "浅色"]) {
    await themeTrigger.click();
    await page.getByRole("option", { name: theme, exact: true }).click();
    await expect(page.locator(".project-current")).toHaveCSS("color", "rgb(226, 52, 86)");
    await expect(page.locator(".console")).toHaveCSS("--on-accent", "#fff");
  }
  await expect((await openNavigation(page)).getByRole("link")).toHaveText(["首页", "浏览量", "功能调整", "数据维护", "域名解析", "项目部署", "关于"]);
  if (testInfo.project.name === "mobile") await page.getByRole("button", { name: "关闭菜单" }).click();

  const trigger = page.getByRole("button", { name: /当前项目：Anutrium/ });
  await trigger.click();
  const choices = page.getByRole("navigation", { name: "切换项目" });
  await expect(choices.getByRole("link")).toHaveText(["Anutrium", "DRRR情报屋"]);
  await expect(choices.locator("img")).toHaveCount(2);
  await expect.poll(() => choices.locator("img").evaluateAll(images => images.every(image => (image as HTMLImageElement).naturalWidth > 0))).toBe(true);
  await expect(trigger.locator("svg")).toHaveCSS("transform", "matrix(-1, 0, 0, -1, 0, 0)");
  await expect(trigger).toHaveCSS("font-size", testInfo.project.name === "mobile" ? "18px" : "26px");
  await expect(choices.locator(".project-option").first()).toHaveCSS("font-size", "18px");
  await choices.getByRole("link", { name: "DRRR情报屋" }).click();
  await expect(page).toHaveURL("/drrr");
  await expect(page.locator(".console")).toHaveCSS("--project-accent", "#f4f500");
  await themeTrigger.click();
  await page.getByRole("option", { name: "浅色", exact: true }).click();
  await expect(page.getByRole("button", { name: /当前项目：DRRR情报屋/ })).toHaveCSS("color", "rgb(104, 105, 0)");
  await expect(page.locator(".console")).toHaveCSS("--on-accent", "#fff");
  await themeTrigger.click();
  await page.getByRole("option", { name: "深色", exact: true }).click();
  await expect(page.getByRole("button", { name: /当前项目：DRRR情报屋/ })).toHaveCSS("color", "rgb(244, 245, 0)");
  await expect(page.locator(".console")).toHaveCSS("--on-accent", "#17191b");
  await expect(page.locator(".project-current")).toHaveCSS("font-family", /alibaba-puhuiti/);
  await expect(page.locator(".project-switcher")).toHaveCSS("border-left-color", /\/ 0\.6\)/);
  await expect(page.locator(".site-link")).toHaveAttribute("href", "https://drrr.anuluca.com");
  await expect((await openNavigation(page)).getByRole("link")).toHaveText(["首页", "域名解析", "项目部署", "关于"]);
  if (testInfo.project.name === "mobile") await expect(choices).toHaveCount(0);
  else await expect(choices).toBeVisible();

  await (await openNavigation(page)).getByRole("link", { name: "关于", exact: true }).click();
  await expect(page).toHaveURL("/drrr/about");
  await page.reload();
  await expect(page.locator(".console")).toHaveAttribute("data-project", "drrr");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("关于");
  await expect(page.getByRole("region", { name: "关于内容区" })).toContainText("Anutrium 等多个项目的管理后台");
  const githubLink = page.getByRole("link", { name: "在新标签页打开 AnuConsole GitHub 仓库" });
  await expect(githubLink).toHaveAttribute("href", "https://github.com/Anuluca/AnuConsole");
  await githubLink.scrollIntoViewIfNeeded();
  await expect(githubLink).toBeVisible();

  await page.goto("/drrr/features");
  await expect(page.getByRole("heading", { name: /页面不存在/ })).toBeVisible();
  await page.goto("/features");
  await expect(page.getByRole("heading", { name: /页面不存在/ })).toBeVisible();
});

test("桌面只由当前项目按钮收起，手机支持 Escape 和点击外部收起", async ({ page }, testInfo) => {
  test.skip(process.env.E2E_AUTH_MODE === "production", "开发环境验证项目切换");
  await page.goto("/anutrium");
  const trigger = page.getByRole("button", { name: /当前项目：Anutrium/ });
  await trigger.click();
  const choices = page.getByRole("navigation", { name: "切换项目" });
  if (testInfo.project.name === "mobile") {
    await page.keyboard.press("Escape");
    await expect(choices).toHaveCount(0);
    await expect(trigger).toBeFocused();
    await trigger.click();
    await page.locator(".console-footer").click();
    await expect(choices).toHaveCount(0);
  } else {
    await page.locator(".page-heading").click();
    await expect(choices).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(choices).toBeVisible();
    await trigger.click();
    await expect(choices).toHaveCount(0);
  }
  await trigger.click();
  await page.getByRole("link", { name: "DRRR情报屋", exact: true }).click();
  await expect(page).toHaveURL("/drrr");
  if (testInfo.project.name === "mobile") await expect(choices).toHaveCount(0);
  else await expect(choices).toBeVisible();
});
