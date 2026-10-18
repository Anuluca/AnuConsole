import { test, expect } from "@playwright/test";
import { openNavigation } from "./helpers/navigation";

const production = process.env.E2E_AUTH_MODE === "production";

test("环境访问策略、项目路由、转场几何与刷新", async ({ page, context }, testInfo) => {
  if (production) {
    const password = process.env.E2E_ADMIN_PASSWORD;
    if (!password) throw new Error("请通过环境变量 E2E_ADMIN_PASSWORD 提供本地测试密码。");
    for (const path of ["/anutrium", "/anutrium/monitor/ga4", "/anutrium/features", "/anutrium/data", "/anutrium/about", "/drrr", "/drrr/about"]) {
      await page.goto(path);
      await expect(page).toHaveURL(/\/login$/);
    }
    await expect(page.getByRole("heading", { name: /DRIVEN BY/ })).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath("login.png"), fullPage: true });
    await page.getByLabel("登录密码").fill("deliberately-incorrect");
    await page.getByRole("button", { name: "登录", exact: true }).click();
    await expect(page.getByRole("status")).toContainText("账号或密码错误");
    await page.getByLabel("登录密码").fill(password);
    await page.getByRole("button", { name: "显示密码", exact: true }).click();
    await expect(page.getByLabel("登录密码")).toHaveAttribute("type", "text");
    await page.getByRole("button", { name: "隐藏密码", exact: true }).click();
    await page.getByRole("button", { name: "登录", exact: true }).click();
    await expect(page).toHaveURL("/anutrium");
    const cookie = (await context.cookies()).find(cookie => cookie.name === "anuconsole_session");
    expect(cookie?.httpOnly).toBe(true);
    expect(cookie?.sameSite).toBe("Strict");
    expect(cookie?.value).not.toContain(password);
  } else {
    for (const path of ["/anutrium", "/anutrium/monitor/ga4", "/anutrium/features", "/anutrium/data", "/anutrium/about", "/drrr", "/drrr/about"]) {
      await page.goto(path);
      await expect(page).toHaveURL(path);
    }
    expect((await context.cookies()).some(cookie => cookie.name === "anuconsole_session")).toBe(false);
    await expect(page.getByRole("button", { name: /退出/ })).toBeVisible();
  }

  await page.goto("/anutrium");
  await expect((await openNavigation(page)).getByRole("link")).toHaveText(["首页", "GA4浏览量", "功能调整", "数据维护", "域名解析", "部署管理", "关于"]);

  for (const route of [
    { label: "首页", title: "首页", path: "/anutrium" },
    { label: "GA4浏览量", title: "GA4浏览量", path: "/anutrium/monitor/ga4" },
    { label: "功能调整", title: "功能调整", path: "/anutrium/features" },
    { label: "数据维护", title: "数据维护", path: "/anutrium/data" },
    { label: "关于", title: "关于", path: "/anutrium/about" }
  ]) {
    await (await openNavigation(page)).getByRole("link", { name: new RegExp(route.label) }).click();
    await expect(page).toHaveURL(route.path);
    await expect(page.getByRole("heading", { level: 1, name: route.title })).toBeVisible();
    await expect(page.getByRole("region", { name: `${route.path === "/anutrium/monitor/ga4" ? "监视器" : route.label}内容区` })).toBeVisible();
    await expect(page.locator("a[aria-current='page']")).toContainText(route.label);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const animation = await page.locator(".route-view").evaluate(element => {
      const animation = element.getAnimations()[0];
      return {
        duration: animation?.effect?.getTiming().duration,
        opacity: (animation?.effect as KeyframeEffect)?.getKeyframes().map(frame => Number(frame.opacity))
      };
    });
    expect(animation.duration).toBe(180);
    expect(animation.opacity).toEqual([1, .2, 1, .2, 1, 1]);
    // 在动画每一帧采样路由容器、主体和侧栏，闪烁不得改变几何位置。
    const samples = await page.evaluate(async () => {
      const samples: number[][] = [];
      for (let frame = 0; frame < 15; frame += 1) {
        await new Promise(requestAnimationFrame);
        samples.push([".route-view", ".main-content", ".sidebar"].flatMap(selector => {
          const rect = document.querySelector(selector)!.getBoundingClientRect();
          return [rect.top, rect.left];
        }));
      }
      return samples;
    });
    for (const sample of samples) sample.forEach((value, index) => expect(Math.abs(value - samples[0][index])).toBeLessThanOrEqual(1));
  }
  await expect(page.locator("body")).not.toContainText(/FOR ANUTRIUM|WORKSPACE/);
  await expect(page.locator("body")).not.toContainText(/ONE SITE|YOUR CONTROL|\/ CONSOLE/);
  await expect(page.locator(".page-heading-cn")).toHaveCount(0);
  await expect(page.locator(".sidebar-domain")).toHaveCount(0);
  await expect(page.locator("nav[aria-label=\"主导航\"]")).not.toContainText(/Overview|Features|Data|01|02|03/);
  await expect(page.locator(".menu-icon")).toHaveCount(9);
  await expect(page.getByRole("navigation", { name: "面包屑" })).toContainText("关于");
  await expect(page.getByRole("region", { name: "关于内容区" })).toContainText("Anutrium 等多个项目的管理后台");
  await expect(page.getByRole("region", { name: "关于内容区" })).not.toContainText(/当前项目|共用能力|项目源码/);
  await expect(page.getByRole("link", { name: "在新标签页打开 AnuConsole GitHub 仓库" })).toHaveAttribute("href", "https://github.com/Anuluca/AnuConsole");
  await expect(page.getByRole("link", { name: "在新标签页打开 Anutrium 网站" })).toHaveAttribute("href", "https://anuluca.com");
  await expect(page.locator(".console-footer")).toHaveCSS("justify-content", testInfo.project.name === "mobile" ? "space-between" : "flex-end");
  await expect(page.locator(".console-footer")).toHaveCSS("font-size", testInfo.project.name === "mobile" ? "9px" : "12px");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(page.locator(".route-view")).toHaveCSS("animation-name", "none");
  await page.reload();
  await expect(page).toHaveURL("/anutrium/about");
  await page.screenshot({ path: testInfo.outputPath("console.png"), fullPage: true });
  const beforeDialog = await page.locator(".main-content").boundingBox();
  const bodyWidth = await page.evaluate(() => document.body.getBoundingClientRect().width);
  await page.getByRole("button", { name: "退出", exact: true }).click();
  await expect(page.getByRole("alertdialog")).toBeVisible();
  await expect(page.getByRole("button", { name: "取消", exact: true })).toBeFocused();
  await expect(page).toHaveURL("/anutrium/about");
  const afterDialog = await page.locator(".main-content").boundingBox();
  expect(Math.abs(afterDialog!.x - beforeDialog!.x)).toBeLessThanOrEqual(1);
  expect(Math.abs(afterDialog!.y - beforeDialog!.y)).toBeLessThanOrEqual(1);
  expect(Math.abs(await page.evaluate(() => document.body.getBoundingClientRect().width) - bodyWidth)).toBeLessThanOrEqual(1);
  await page.getByRole("button", { name: "取消", exact: true }).click();
  await expect(page.getByRole("alertdialog")).not.toBeVisible();
  await expect(page).toHaveURL("/anutrium/about");
  await page.getByRole("button", { name: "退出", exact: true }).click();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("alertdialog")).not.toBeVisible();
  await page.getByRole("button", { name: "退出", exact: true }).click();
  await page.screenshot({ path: testInfo.outputPath("logout-confirm.png"), fullPage: true });
  await page.getByRole("button", { name: "确认退出", exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
  expect((await context.cookies()).some(cookie => cookie.name === "anuconsole_session")).toBe(false);
  await page.goto("/anutrium/data");
  await expect(page).toHaveURL(production ? /\/login$/ : "/anutrium/data");
});

test("环境访问策略不受伪造 Cookie 影响", async ({ page, context }) => {
  await context.addCookies([{ name: "anuconsole_session", value: "forged-admin-session", domain: "127.0.0.1", path: "/" }]);
  await page.goto("/anutrium/features");
  await expect(page).toHaveURL(production ? /\/login$/ : "/anutrium/features");
});
