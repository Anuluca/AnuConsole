import { test, expect, type Page } from "@playwright/test";
import { projects } from "../src/lib/projects";
import { openNavigation } from "./helpers/navigation";

test.beforeEach(() => { test.skip(process.env.E2E_AUTH_MODE === "production", "真实登录由认证回归覆盖；此处模拟上游结果验证管理界面"); });

test("DNS 记录增改删、筛选、取消确认与保存失败后的重新读取", async ({ page }) => {
  let records = [{ id: "record-one", type: "A", name: "www.anuluca.com", content: "192.0.2.1", ttl: 1, proxied: true, proxiable: true, comment: "测试记录", tags: [] }];
  let fail = false;
  const writes: string[] = [];
  await page.route("**/api/infrastructure/dns**", async route => {
    const request = route.request();
    const url = new URL(request.url());
    if (request.method() !== "GET") {
      writes.push(request.method());
      if (fail) return route.fulfill({ status: 502, json: { error: "provider_unavailable" } });
      if (request.method() === "POST") records.push({ ...request.postDataJSON(), id: "record-two", proxiable: true });
      if (request.method() === "PATCH") records = records.map(record => record.id === url.pathname.split("/").at(-1) ? { ...record, ...request.postDataJSON() } : record);
      if (request.method() === "DELETE") records = records.filter(record => record.id !== url.pathname.split("/").at(-1));
      return route.fulfill({ json: { ok: true } });
    }
    const search = url.searchParams.get("search");
    return route.fulfill({ json: { records: records.filter(record => !search || record.name.includes(search)), page: 1, pages: 1, total: records.length, zone: "anuluca.com" } });
  });
  await page.goto("/anutrium/infrastructure/dns");
  const workspace = page.getByRole("region", { name: "DNS记录管理" });
  await expect(workspace.getByText("www.anuluca.com", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "新增记录" }).click();
  let dialog = page.getByRole("dialog");
  const recordType = dialog.getByRole("button", { name: "记录类型", exact: true });
  await expect(page.locator("body")).toBeFocused();
  await recordType.focus();
  await page.keyboard.press("ArrowDown");
  await expect(dialog.getByRole("listbox", { name: "记录类型" })).not.toBeFocused();
  await expect(recordType).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await expect(recordType).toContainText("AAAA");
  await recordType.click();
  await page.keyboard.press("Home");
  await page.keyboard.press("Enter");
  await expect(recordType).toHaveText("A");
  await recordType.click();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeVisible();
  await expect(recordType).toBeFocused();
  await dialog.getByLabel("记录名称", { exact: false }).fill("docs");
  await dialog.getByRole("textbox", { name: "记录内容", exact: true }).fill("192.0.2.2");
  await dialog.getByRole("button", { name: "保存记录" }).click();
  await expect(dialog).toHaveCount(0);
  await expect(workspace.getByText("docs.anuluca.com", { exact: true })).toBeVisible();
  const row = workspace.getByRole("row").filter({ hasText: "docs.anuluca.com" });
  await row.getByRole("button", { name: "编辑", exact: true }).click();
  dialog = page.getByRole("dialog");
  await dialog.getByRole("textbox", { name: "记录内容", exact: true }).fill("192.0.2.3");
  await dialog.getByRole("button", { name: "保存记录" }).click();
  await expect(dialog).toHaveCount(0);
  await expect(workspace.getByText("192.0.2.3", { exact: true })).toBeVisible();
  await row.getByRole("button", { name: "删除", exact: true }).click();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(writes).toEqual(["POST", "PATCH"]);
  await row.getByRole("button", { name: "删除", exact: true }).click();
  await page.getByRole("button", { name: "确认删除", exact: true }).click();
  await expect(workspace.getByText("docs.anuluca.com", { exact: true })).toHaveCount(0);
  fail = true;
  await workspace.getByRole("button", { name: "编辑", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "保存记录" }).click();
  await expect(workspace.getByRole("alert")).toContainText("已重新读取记录");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(workspace.getByText("192.0.2.1", { exact: true })).toBeVisible();
  await page.getByRole("textbox", { name: "搜索 DNS 记录" }).fill("missing");
  await page.getByRole("button", { name: "搜索", exact: true }).click();
  await expect(workspace).toContainText("没有符合条件的 DNS 记录");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

const demoSite = { id: "demo-site", name: "sample-project", url: "https://sample.example.invalid/", account: "演示团队", published_deploy: "deploy-current", settings: { name: "sample-project", custom_domain: "sample.example.invalid", force_ssl: true, build_settings: { cmd: "npm run build", repo_branch: "main" } }, admin_url: "https://app.netlify.com/projects/sample-project/overview" };
async function mockNetlify(page: Page) {
  let settings = structuredClone(demoSite.settings);
  const writes: { path: string; method: string; body: unknown }[] = [];
  await page.route("**/api/infrastructure/netlify**", async route => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (request.method() !== "GET") {
      const body = request.postData() ? request.postDataJSON() : undefined;
      writes.push({ path, method: request.method(), body });
      if (path.endsWith("/demo-site") && request.method() === "PATCH") { settings = { ...settings, ...body }; return route.fulfill({ json: { ...demoSite, settings, name: settings.name } }); }
      return route.fulfill({ json: { ok: true } });
    }
    if (path.endsWith("/deploys")) return route.fulfill({ json: { deploys: [{ id: "deploy-current", state: "ready", branch: "main", title: "当前部署", context: "production", created_at: "2026-10-18T10:00:00Z" }, { id: "deploy-old", state: "ready", branch: "main", title: "上一版本", context: "production", created_at: "2026-10-17T10:00:00Z" }], page: 1, hasMore: false } });
    if (path.endsWith("/env")) return route.fulfill({ json: { variables: [{ key: "SERVICE_TOKEN", scopes: ["functions"], is_secret: true, values: [{ id: "production-value", context: "production" }, { id: "preview-value", context: "deploy-preview" }] }] } });
    if (path.endsWith("/demo-site")) return route.fulfill({ json: { ...demoSite, settings } });
    return route.fulfill({ json: { sites: [demoSite], page: 1, hasMore: false, restricted: true } });
  });
  return writes;
}

test("Netlify 可精确访问项目，构建与恢复必须确认，设置只提交修改字段", async ({ page }) => {
  const writes = await mockNetlify(page);
  await page.goto("/anutrium/infrastructure/netlify");
  await page.getByRole("link", { name: /sample-project/ }).click();
  await expect(page).toHaveURL(/\?site=demo-site$/);
  await expect(page.getByRole("heading", { level: 2, name: "sample-project" })).toBeVisible();
  await page.getByRole("button", { name: "重新部署", exact: true }).click();
  await page.getByRole("dialog").getByLabel("构建分支", { exact: true }).fill("preview");
  await page.getByRole("dialog").getByLabel("清除构建缓存").check();
  await page.getByRole("button", { name: "确认构建", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(writes[0].body).toEqual({ action: "build", branch: "preview", clear_cache: true });
  await page.getByRole("button", { name: "恢复此部署" }).click();
  await page.getByRole("button", { name: "取消", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(writes).toHaveLength(1);
  await page.getByRole("button", { name: "恢复此部署" }).click();
  await page.getByRole("button", { name: "确认恢复", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(writes[1].body).toEqual({ action: "restore", deployId: "deploy-old" });
  await expect(page.locator(".infra-deploy").filter({ hasText: "上一版本" })).toContainText("当前线上版本");
  await page.getByRole("button", { name: "项目设置", exact: true }).click();
  await page.getByLabel("项目名称", { exact: true }).fill("renamed-project");
  await page.getByRole("button", { name: "保存设置", exact: true }).click();
  await page.getByRole("button", { name: "确认保存", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(writes[2].body).toEqual({ name: "renamed-project" });
  await expect(page.getByRole("heading", { name: "renamed-project", exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { name: "sample-project", exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("环境变量隐藏已存值，修改单个上下文、添加变量和删除上下文使用独立操作", async ({ page }) => {
  const writes = await mockNetlify(page);
  await page.goto("/anutrium/infrastructure/netlify?site=demo-site");
  await page.getByRole("button", { name: "环境变量", exact: true }).click();
  await expect(page.getByText("SERVICE_TOKEN", { exact: true })).toBeVisible();
  await expect(page.locator(".infra-env-context")).toHaveCount(0);
  await page.getByRole("button", { name: "详细配置", exact: true }).click();
  await expect(page.getByLabel("变量值已隐藏")).toHaveCount(2);
  await page.locator(".infra-env-context").filter({ hasText: "生产环境" }).getByRole("button", { name: "修改值", exact: true }).click();
  await expect(page.getByRole("dialog").getByLabel("新变量值")).toHaveValue("");
  await page.getByRole("dialog").getByLabel("新变量值").fill("new-user-entered-value");
  await page.getByRole("button", { name: "保存变量", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(writes[0]).toMatchObject({ method: "PATCH", body: { context: "production", value: "new-user-entered-value" } });
  await page.getByRole("button", { name: "新增变量", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("变量名称", { exact: true }).fill("NEW_KEY");
  await dialog.getByLabel("新变量值").fill("new-value");
  await dialog.getByRole("button", { name: "部署上下文 1", exact: true }).click();
  await dialog.getByRole("option", { name: "生产环境", exact: true }).click();
  await dialog.getByRole("button", { name: "保存变量", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  expect(writes[1]).toMatchObject({ method: "POST", body: { key: "NEW_KEY", values: [{ context: "production", context_parameter: "", value: "new-value" }] } });
  await page.locator(".infra-env-context").filter({ hasText: "部署预览" }).getByRole("button", { name: "删除上下文" }).click();
  await page.getByRole("button", { name: "确认删除", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(writes[2].method).toBe("DELETE");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("未配置凭据时显示明确错误，可重试；未知项目不开放运维路由", async ({ page }) => {
  await page.route("**/api/infrastructure/dns**", route => route.fulfill({ status: 503, json: { error: "cloudflare_not_configured" } }));
  await page.goto("/anutrium/infrastructure/dns");
  await expect(page.getByRole("region", { name: "DNS记录管理" }).getByRole("alert")).toContainText("尚未配置 Cloudflare");
  await page.getByRole("button", { name: "重试", exact: true }).click();
  await expect(page.getByRole("region", { name: "DNS记录管理" }).getByRole("alert")).toContainText("尚未配置 Cloudflare");
  await page.goto("/unknown-project/infrastructure/dns");
  await expect(page.getByRole("heading", { name: /页面不存在/ })).toBeVisible();
});

test("所有项目显示网站运维，运维跳转、部署详情和返回保留当前项目", async ({ page }) => {
  await mockNetlify(page);
  await page.route("**/api/infrastructure/dns**", route => route.fulfill({ json: { records: [], page: 1, pages: 1, total: 0, zone: "anuluca.com" } }));
  for (const project of projects) {
    const root = `/${project.id}/infrastructure`;
    await page.goto(`/${project.id}`);
    const navigation = await openNavigation(page);
    await expect(navigation.getByRole("button", { name: "网站运维", exact: true })).toBeVisible();
    await expect(navigation.getByRole("link", { name: "域名解析", exact: true })).toHaveAttribute("href", `${root}/dns`);
    await navigation.getByRole("link", { name: "域名解析", exact: true }).click();
    await expect(page).toHaveURL(`${root}/dns`);
    await expect(page.getByRole("region", { name: "DNS记录管理" })).toBeVisible();
    await expect(page.locator(".console")).toHaveAttribute("data-project", project.id);
    await page.goto(root);
    await expect(page).toHaveURL(`${root}/dns`);
    await (await openNavigation(page)).getByRole("link", { name: "项目部署", exact: true }).click();
    await expect(page).toHaveURL(`${root}/netlify`);
    await page.getByRole("link", { name: /sample-project/ }).click();
    await expect(page).toHaveURL(`${root}/netlify?site=demo-site`);
    await page.reload();
    await expect(page.getByRole("heading", { level: 2, name: "sample-project" })).toBeVisible();
    await expect(page.locator(".console")).toHaveAttribute("data-project", project.id);
    await page.getByRole("link", { name: "← 项目列表", exact: true }).click();
    await expect(page).toHaveURL(`${root}/netlify`);
  }
});

test("新增项目支持团队与 Git 配置，取消不创建，成功后保留当前项目路径", async ({ page }) => {
  const writes: unknown[] = [];
  let createdName = "";
  await page.route("**/api/infrastructure/netlify**", async route => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (request.method() === "POST") {
      const input = request.postDataJSON(); writes.push(input); createdName = input.settings.name;
      return route.fulfill({ json: { site: { ...demoSite, id: "created-site", name: createdName } } });
    }
    if (path.endsWith("/accounts")) return route.fulfill({ json: { accounts: [{ id: "one", slug: "first-team", name: "团队一" }, { id: "two", slug: "second-team", name: "团队二" }] } });
    if (path.endsWith("/repositories")) return route.fulfill({ json: { repositories: [{ id: 123, path: "example/repository", defaultBranch: "develop", private: true, linked: false }], page: 1, hasMore: false } });
    if (path.endsWith("/created-site")) return route.fulfill({ json: { ...demoSite, id: "created-site", name: createdName } });
    if (path.endsWith("/deploys")) return route.fulfill({ json: { deploys: [], page: 1, hasMore: false } });
    return route.fulfill({ json: { sites: [demoSite], page: 1, hasMore: false, restricted: false } });
  });
  for (const project of projects) {
    const root = `/${project.id}/infrastructure/netlify`;
    await page.goto(root);
    await page.getByRole("button", { name: "新增项目", exact: true }).click();
    await page.getByRole("button", { name: "取消", exact: true }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    const previousCount = writes.length;
    await page.getByRole("button", { name: "新增项目", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "新增 Netlify 项目" });
    await expect(dialog.getByRole("button", { name: "创建项目", exact: true })).toBeDisabled();
    await dialog.getByRole("button", { name: "所属团队", exact: true }).click();
    await dialog.getByRole("option", { name: "团队二 (second-team)", exact: true }).click();
    await dialog.getByRole("textbox", { name: /^项目名称/ }).fill(`new-${project.id}`);
    await dialog.getByRole("textbox", { name: /^自定义域名/ }).fill("new.example.invalid");
    if (project.id === "drrr") {
      await dialog.getByLabel("关联 Git 仓库").check();
      await dialog.getByRole("button", { name: "GitHub 仓库", exact: true }).click();
      await dialog.getByRole("option", { name: "example/repository · 私有", exact: true }).click();
      await expect(dialog.getByLabel("生产分支", { exact: true })).toHaveValue("develop");
      await dialog.getByLabel("构建命令", { exact: true }).fill("npm run build");
      await dialog.getByLabel("发布目录", { exact: true }).fill("dist");
    }
    await dialog.getByRole("button", { name: "创建项目", exact: true }).click();
    await expect(dialog).toHaveCount(0);
    await expect(page).toHaveURL(`${root}?site=created-site`);
    await expect(page.getByRole("heading", { level: 2, name: `new-${project.id}` })).toBeVisible();
    expect(writes.length).toBe(previousCount + 1);
    expect(writes.at(-1)).toMatchObject({ accountSlug: "second-team", settings: { name: `new-${project.id}`, custom_domain: "new.example.invalid" } });
    if (project.id === "drrr") expect(writes.at(-1)).toMatchObject({ settings: { repo: { provider: "github", id: 123, repo_path: "example/repository", repo_branch: "develop", public_repo: false, cmd: "npm run build", dir: "dist" } } });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
});

test("创建失败后重新读取列表，启用允许列表时禁用新增项目", async ({ page }) => {
  let restricted = false;
  let attempts = 0;
  let reads = 0;
  await page.route("**/api/infrastructure/netlify**", async route => {
    if (route.request().method() === "POST") { attempts++; return route.abort("failed"); }
    if (new URL(route.request().url()).pathname.endsWith("/accounts")) return route.fulfill({ json: { accounts: [{ id: "one", slug: "team", name: "团队" }] } });
    reads++; return route.fulfill({ json: { sites: [], page: 1, hasMore: false, restricted } });
  });
  await page.goto("/anutrium/infrastructure/netlify");
  await page.getByRole("button", { name: "新增项目", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("textbox", { name: /^项目名称/ }).fill("new-project");
  await dialog.getByRole("button", { name: "创建项目", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole("region", { name: "Netlify部署管理" }).getByRole("alert")).toContainText("请先核对项目列表");
  expect(attempts).toBe(1);
  expect(reads).toBeGreaterThan(1);
  restricted = true;
  await page.getByRole("button", { name: "刷新", exact: true }).click();
  await expect(page.getByRole("button", { name: "新增项目", exact: true })).toBeDisabled();
});

test("仓库可搜索选择、自动填入配置，未配置授权时不能关联创建", async ({ page }) => {
  let configured = false;
  await page.route("**/api/infrastructure/netlify**", async route => {
    const path = new URL(route.request().url()).pathname;
    if (route.request().method() !== "GET") throw new Error("本测试不应创建项目");
    if (path.endsWith("/accounts")) return route.fulfill({ json: { accounts: [{ id: "one", slug: "team", name: "团队" }] } });
    if (path.endsWith("/repositories")) return route.fulfill(configured ? { json: { repositories: [
      { id: 123, path: "example/private-repository", defaultBranch: "development", private: true, linked: true, buildCommand: "pnpm build", publishDirectory: "output" },
      { id: 456, path: "example/public-repository", defaultBranch: "master", private: false, linked: false },
    ], page: 1, hasMore: false } } : { status: 503, json: { error: "github_not_configured" } });
    return route.fulfill({ json: { sites: [], page: 1, hasMore: false, restricted: false } });
  });
  await page.goto("/anutrium/infrastructure/netlify");
  await page.getByRole("button", { name: "新增项目", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("关联 Git 仓库").check();
  await expect(dialog.getByRole("alert")).toContainText("GITHUB_API_TOKEN");
  await expect(dialog.getByRole("button", { name: "创建项目", exact: true })).toBeDisabled();
  configured = true;
  await dialog.getByRole("button", { name: "重试", exact: true }).click();
  await dialog.getByLabel("搜索当前页仓库", { exact: true }).fill("private");
  const picker = dialog.getByRole("button", { name: "GitHub 仓库", exact: true });
  await picker.click();
  await expect(dialog.getByRole("option")).toHaveCount(2);
  await dialog.getByRole("option", { name: "example/private-repository · 私有", exact: true }).click();
  await expect(dialog.getByRole("textbox", { name: /^项目名称/ })).toHaveValue("private-repository");
  await expect(dialog.getByLabel("生产分支", { exact: true })).toHaveValue("development");
  await expect(dialog.getByLabel("构建命令", { exact: true })).toHaveValue("pnpm build");
  await expect(dialog.getByLabel("发布目录", { exact: true })).toHaveValue("output");
  await expect(dialog.getByLabel("Git 安装 ID", { exact: true })).toHaveCount(0);
  await picker.click();
  await dialog.getByRole("option", { name: "请选择仓库", exact: true }).click();
  await expect(dialog.getByRole("button", { name: "创建项目", exact: true })).toBeDisabled();
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
});

test("项目预览图用于列表和详情，加载失败时隐藏", async ({ page }) => {
  await mockNetlify(page);
  await page.route("**/preview.test/site.svg", route => route.fulfill({ contentType: "image/svg+xml", body: '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="120"><rect width="200" height="120" fill="#E23456"/></svg>' }));
  await page.route("**/api/infrastructure/netlify**", async route => {
    if (route.request().method() !== "GET") throw new Error("预览测试只允许读取");
    const path = new URL(route.request().url()).pathname;
    const site = { ...demoSite, screenshot_url: "https://preview.test/site.svg" };
    if (path.endsWith("/demo-site")) return route.fulfill({ json: site });
    if (path.endsWith("/netlify")) return route.fulfill({ json: { sites: [site], page: 1, hasMore: false, restricted: true } });
    return route.fallback();
  });
  await page.goto("/anutrium/infrastructure/netlify");
  const preview = page.getByRole("img", { name: "sample-project 网站预览" });
  await expect(preview).toBeVisible();
  await page.getByRole("link", { name: /管理项目/ }).click();
  await expect(page.getByRole("region", { name: "Netlify项目详情", exact: true })).toBeVisible();
  await expect(preview).toBeVisible();
  await preview.evaluate(image => image.dispatchEvent(new Event("error")));
  await expect(preview).toHaveCount(0);
});
