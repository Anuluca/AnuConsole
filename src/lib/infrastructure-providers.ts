import "server-only";
import {
  DNS_ZONE, InfrastructureError, dnsTypes, identifier, object, publicSettings,
  type DnsInput, type DnsPage, type DnsRecord, type EnvInput, type EnvValueInput, type EnvVariable,
  type GitHubRepositoryPage, type JsonObject, type NetlifyAccount, type NetlifyCreateInput, type NetlifyDeploy, type NetlifyDetail, type NetlifySite,
} from "./infrastructure-contract.ts";

type Provider = "cloudflare" | "netlify";
const origins = { cloudflare: "https://api.cloudflare.com/client/v4", netlify: "https://api.netlify.com/api/v1" };

/** 固定上游、禁止重定向，确保浏览器输入不能把服务凭据带到任意主机。写入不自动重试。 */
async function upstream(provider: Provider, path: string, method = "GET", body?: unknown): Promise<unknown> {
  const token = process.env[provider === "cloudflare" ? "CLOUDFLARE_API_TOKEN" : "NETLIFY_API_TOKEN"];
  if (!token?.trim()) throw new InfrastructureError(`${provider}_not_configured`, 503);
  try {
    const response = await fetch(`${origins[provider]}${path}`, {
      method, headers: { Authorization: `Bearer ${token}`, Accept: "application/json", ...(body !== undefined ? { "Content-Type": "application/json" } : {}) },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      cache: "no-store", redirect: "error", signal: AbortSignal.timeout(15000),
    });
    // 错误响应可能回显环境变量等敏感输入，只返回稳定的本地错误码。
    if (!response.ok) {
      const code = response.status === 401 || response.status === 403 ? "provider_unauthorized" : response.status === 404 ? "not_found" : response.status === 429 ? "provider_rate_limited" : response.status >= 500 ? "provider_unavailable" : "provider_rejected";
      throw new InfrastructureError(code, response.status === 404 ? 404 : response.status === 429 ? 429 : 502);
    }
    if (response.status === 204) return null;
    const data: unknown = await response.json();
    if (provider === "cloudflare") {
      if (!object(data) || data.success !== true) throw new InfrastructureError("provider_rejected", 502);
      return data;
    }
    return data;
  } catch (error) {
    if (error instanceof InfrastructureError) throw error;
    throw new InfrastructureError("provider_unavailable", 502);
  }
}

function dnsPath() {
  const zone = process.env.CLOUDFLARE_ZONE_ID?.trim();
  if (!zone || !/^[a-f0-9]{32}$/i.test(zone)) throw new InfrastructureError("cloudflare_not_configured", 503);
  return `/zones/${zone}/dns_records`;
}
function dnsRecord(value: unknown): DnsRecord {
  if (!object(value) || typeof value.id !== "string" || typeof value.name !== "string" || !dnsTypes.includes(value.type as DnsInput["type"])) throw new InfrastructureError("invalid_response", 502);
  if (!(value.name === DNS_ZONE || value.name.endsWith(`.${DNS_ZONE}`))) throw new InfrastructureError("invalid_response", 502);
  const record: JsonObject = {};
  for (const key of ["id", "type", "name", "content", "ttl", "proxied", "priority", "comment", "tags", "data", "settings", "proxiable", "modified_on"]) if (key in value) record[key] = value[key];
  return record as DnsRecord;
}
export async function listDns(page: number, search = "", type = ""): Promise<DnsPage> {
  const query = new URLSearchParams({ page: String(page), per_page: "50", order: "name" });
  if (search) query.set("search", search.slice(0, 253));
  if (type) {
    if (!dnsTypes.includes(type as DnsInput["type"])) throw new InfrastructureError("invalid_input");
    query.set("type", type);
  }
  const data = await upstream("cloudflare", `${dnsPath()}?${query}`) as JsonObject;
  if (!Array.isArray(data.result)) throw new InfrastructureError("invalid_response", 502);
  const info = object(data.result_info) ? data.result_info : {};
  return { records: data.result.map(dnsRecord), page, pages: Number(info.total_pages) || 1, total: Number(info.total_count) || data.result.length, zone: DNS_ZONE };
}
export async function writeDns(input: DnsInput, id?: string) {
  const data = await upstream("cloudflare", `${dnsPath()}${id ? `/${identifier(id)}` : ""}`, id ? "PATCH" : "POST", input) as JsonObject;
  return { record: dnsRecord(data.result) };
}
export async function deleteDns(id: string) {
  // 先读取并校验记录所属域名，再删除，防止错误区域配置影响其他域名。
  const path = `${dnsPath()}/${identifier(id)}`;
  const data = await upstream("cloudflare", path) as JsonObject;
  dnsRecord(data.result);
  await upstream("cloudflare", path, "DELETE");
  return { ok: true };
}

function siteAllowed(id: string): boolean {
  const allowed = process.env.NETLIFY_SITE_IDS?.split(",").map(value => value.trim()).filter(Boolean);
  return !allowed?.length || allowed.includes(id);
}
function siteSummary(value: unknown): NetlifySite {
  if (!object(value) || typeof value.id !== "string" || typeof value.name !== "string") throw new InfrastructureError("invalid_response", 502);
  return { id: value.id, name: value.name, screenshot_url: safeUrl(value.screenshot_url || (object(value.published_deploy) ? value.published_deploy.screenshot_url : "")) || undefined, url: safeUrl(value.ssl_url || value.url), account: String(value.account_name || value.account_slug || ""), updated_at: typeof value.updated_at === "string" ? value.updated_at : undefined,
    published_deploy: object(value.published_deploy) && typeof value.published_deploy.id === "string" ? value.published_deploy.id : undefined };
}
function safeUrl(value: unknown): string {
  try { const url = new URL(String(value)); return ["http:", "https:"].includes(url.protocol) ? url.href : ""; } catch { return ""; }
}
async function siteRaw(id: string): Promise<JsonObject> {
  identifier(id);
  if (!siteAllowed(id)) throw new InfrastructureError("not_found", 404);
  const site = await upstream("netlify", `/sites/${id}`);
  if (!object(site) || site.id !== id || typeof site.account_id !== "string") throw new InfrastructureError("invalid_response", 502);
  return site;
}
export async function listNetlify(page: number) {
  const data = await upstream("netlify", `/sites?page=${page}&per_page=50`);
  if (!Array.isArray(data)) throw new InfrastructureError("invalid_response", 502);
  return { sites: data.map(siteSummary).filter(site => siteAllowed(site.id)), page, hasMore: data.length === 50, restricted: !!process.env.NETLIFY_SITE_IDS?.trim() };
}
export async function listNetlifyAccounts(): Promise<{ accounts: NetlifyAccount[] }> {
  const data = await upstream("netlify", "/accounts");
  if (!Array.isArray(data)) throw new InfrastructureError("invalid_response", 502);
  return { accounts: data.map(account => {
    if (!object(account) || typeof account.id !== "string" || typeof account.slug !== "string" || typeof account.name !== "string") throw new InfrastructureError("invalid_response", 502);
    // 团队响应含账单、成员等字段，此处仅返回创建项目需要的选择信息。
    return { id: account.id, slug: account.slug, name: account.name };
  }) };
}

async function github(path: string): Promise<unknown> {
  const token = process.env.GITHUB_API_TOKEN?.trim();
  if (!token) throw new InfrastructureError("github_not_configured", 503);
  try {
    const response = await fetch(`https://api.github.com${path}`, { headers: {
      Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2026-03-10", "User-Agent": "AnuConsole",
    }, cache: "no-store", redirect: "error", signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw new InfrastructureError(response.status === 401 || response.status === 403 ? "github_unauthorized" : response.status === 404 ? "not_found" : response.status === 429 ? "provider_rate_limited" : "provider_unavailable", response.status === 404 ? 404 : 502);
    return await response.json();
  } catch (error) {
    if (error instanceof InfrastructureError) throw error;
    throw new InfrastructureError("provider_unavailable", 502);
  }
}

async function linkedGitHubRepositories() {
  const repositories: JsonObject[] = [];
  // 复用已有 GitHub App 关联信息，不返回仓库 env、访问令牌或完整平台响应。
  for (let page = 1; page <= 10; page++) {
    const sites = await upstream("netlify", `/sites?page=${page}&per_page=100`);
    if (!Array.isArray(sites)) throw new InfrastructureError("invalid_response", 502);
    for (const site of sites) if (object(site) && typeof site.id === "string" && siteAllowed(site.id) && object(site.build_settings)) {
      const repo = site.build_settings;
      if (repo.provider === "github" && typeof repo.repo_path === "string") repositories.push(Object.fromEntries(Object.entries(repo).filter(([key]) => ["repo_path", "repo_branch", "installation_id", "deploy_key_id", "cmd", "dir"].includes(key))));
    }
    if (sites.length < 100) break;
  }
  return repositories;
}

export async function listGitHubRepositories(page: number): Promise<GitHubRepositoryPage> {
  if (!process.env.GITHUB_API_TOKEN?.trim()) throw new InfrastructureError("github_not_configured", 503);
  const [data, linked] = await Promise.all([github(`/user/repos?per_page=100&page=${page}&sort=updated&direction=desc`), linkedGitHubRepositories()]);
  if (!Array.isArray(data)) throw new InfrastructureError("invalid_response", 502);
  const repositories = data.filter(repo => object(repo) && repo.archived !== true && repo.disabled !== true).map(repo => {
    if (!object(repo) || !Number.isSafeInteger(repo.id) || typeof repo.full_name !== "string" || typeof repo.default_branch !== "string" || typeof repo.private !== "boolean") throw new InfrastructureError("invalid_response", 502);
    const existing = linked.find(item => String(item.repo_path).toLowerCase() === String(repo.full_name).toLowerCase());
    return { id: Number(repo.id), path: repo.full_name, defaultBranch: repo.default_branch, private: repo.private, linked: !!existing,
      ...(typeof existing?.cmd === "string" ? { buildCommand: existing.cmd } : {}), ...(typeof existing?.dir === "string" ? { publishDirectory: existing.dir } : {}) };
  });
  return { repositories, page, hasMore: data.length === 100 };
}

async function selectedGitHubRepository(input: JsonObject): Promise<JsonObject> {
  const path = String(input.repo_path);
  const parts = path.split("/");
  if (parts.length !== 2 || parts.some(part => !/^[a-zA-Z0-9_.-]+$/.test(part))) throw new InfrastructureError("invalid_input");
  const actual = await github(`/repos/${parts.map(encodeURIComponent).join("/")}`);
  if (!object(actual) || typeof actual.full_name !== "string" || !Number.isSafeInteger(actual.id) || typeof actual.private !== "boolean") throw new InfrastructureError("invalid_response", 502);
  if (actual.archived === true || actual.disabled === true || actual.full_name.toLowerCase() !== path.toLowerCase() || (input.id !== undefined && input.id !== actual.id)) throw new InfrastructureError("invalid_input");
  const linked = await linkedGitHubRepositories();
  const existing = linked.find(repo => String(repo.repo_path).toLowerCase() === path.toLowerCase());
  const owner = path.split("/")[0].toLowerCase();
  const ids = [...new Set(linked.filter(repo => String(repo.repo_path).split("/")[0].toLowerCase() === owner && Number.isSafeInteger(repo.installation_id)).map(repo => Number(repo.installation_id)))];
  const installation = Number.isSafeInteger(existing?.installation_id) ? existing!.installation_id : ids.length === 1 ? ids[0] : undefined;
  const { installation_id: _installation, deploy_key_id: _deployKey, ...settings } = input;
  // 仓库身份、可见性和关联标识由服务端读取，不能依赖浏览器提交的值。
  return { ...settings, id: actual.id, provider: "github", repo_path: actual.full_name, repo_url: `https://github.com/${actual.full_name}`, public_repo: !actual.private,
    ...(installation !== undefined ? { installation_id: installation } : {}), ...(typeof existing?.deploy_key_id === "string" ? { deploy_key_id: existing.deploy_key_id } : {}) };
}
export async function createNetlify(input: NetlifyCreateInput) {
  // 新项目 ID 无法预先加入允许列表，启用限制时在创建前拒绝，避免产生不可管理的项目。
  if (process.env.NETLIFY_SITE_IDS?.trim()) throw new InfrastructureError("netlify_creation_restricted", 403);
  const { accounts } = await listNetlifyAccounts();
  if (!accounts.some(account => account.slug === input.accountSlug)) throw new InfrastructureError("not_found", 404);
  const settings = { ...input.settings };
  if (object(settings.repo) && settings.repo.provider === "github") settings.repo = await selectedGitHubRepository(settings.repo);
  try {
    const data = await upstream("netlify", `/${encodeURIComponent(input.accountSlug)}/sites?configure_dns=false`, "POST", { ...settings, managed_dns: false });
    if (!object(data)) throw new InfrastructureError("invalid_response", 502);
    return { site: siteDetail(data) };
  } catch (error) {
    if (error instanceof InfrastructureError && error.code === "provider_rejected") throw new InfrastructureError("netlify_create_rejected", 502);
    throw error;
  }
}
function siteDetail(site: JsonObject): NetlifyDetail {
  return { ...siteSummary(site), settings: publicSettings(site), repo_url: object(site.build_settings) ? safeUrl(site.build_settings.repo_url) : undefined,
    admin_url: `https://app.netlify.com/projects/${encodeURIComponent(String(site.name))}/overview` };
}
export async function getNetlify(id: string) { return siteDetail(await siteRaw(id)); }
export async function updateNetlify(id: string, settings: JsonObject) {
  await siteRaw(id);
  const data = await upstream("netlify", `/sites/${id}`, "PATCH", settings);
  if (!object(data)) throw new InfrastructureError("invalid_response", 502);
  return siteDetail(data);
}
function deploySummary(value: unknown): NetlifyDeploy {
  if (!object(value) || typeof value.id !== "string" || typeof value.state !== "string") throw new InfrastructureError("invalid_response", 502);
  const result: JsonObject = { id: value.id, state: value.state };
  for (const key of ["branch", "title", "context", "created_at", "published_at", "commit_ref"]) if (typeof value[key] === "string") result[key] = value[key];
  result.url = safeUrl(value.deploy_ssl_url || value.deploy_url || value.ssl_url || value.url);
  return result as NetlifyDeploy;
}
export async function listDeploys(id: string, page: number) {
  await siteRaw(id);
  const data = await upstream("netlify", `/sites/${id}/deploys?page=${page}&per_page=20`);
  if (!Array.isArray(data)) throw new InfrastructureError("invalid_response", 502);
  return { deploys: data.map(deploySummary), page, hasMore: data.length === 20 };
}
export async function triggerBuild(id: string, branch: string, clearCache: boolean) {
  await siteRaw(id);
  const query = new URLSearchParams({ clear_cache: String(clearCache), title: "Triggered from AnuConsole" });
  if (branch) query.set("branch", branch);
  const data = await upstream("netlify", `/sites/${id}/builds?${query}`, "POST");
  if (!object(data) || typeof data.id !== "string") throw new InfrastructureError("invalid_response", 502);
  return { ok: true, id: data.id };
}
export async function restoreDeploy(id: string, deployId: string) {
  await siteRaw(id);
  identifier(deployId);
  // 使用带 site_id 的部署接口，让平台同时校验部署归属，不能跨项目发布。
  return { deploy: deploySummary(await upstream("netlify", `/sites/${id}/deploys/${deployId}/restore`, "POST")) };
}
async function envPath(id: string) {
  const site = await siteRaw(id);
  return `/accounts/${encodeURIComponent(String(site.account_id))}/env`;
}
function envSummary(value: unknown): EnvVariable {
  if (!object(value) || typeof value.key !== "string" || !Array.isArray(value.values) || !Array.isArray(value.scopes)) throw new InfrastructureError("invalid_response", 502);
  // 即使普通变量或 dev 上下文允许读取，也永远不把 value、用户信息传给浏览器。
  return { key: value.key, scopes: value.scopes as EnvVariable["scopes"], is_secret: value.is_secret === true,
    updated_at: typeof value.updated_at === "string" ? value.updated_at : undefined,
    values: value.values.map(item => {
      if (!object(item) || typeof item.id !== "string" || typeof item.context !== "string") throw new InfrastructureError("invalid_response", 502);
      return { id: item.id, context: item.context as EnvVariable["values"][number]["context"], ...(typeof item.context_parameter === "string" ? { context_parameter: item.context_parameter } : {}) };
    }) };
}
export async function listEnv(id: string) {
  const path = await envPath(id);
  const data = await upstream("netlify", `${path}?site_id=${encodeURIComponent(id)}`);
  if (!Array.isArray(data)) throw new InfrastructureError("invalid_response", 502);
  return { variables: data.map(envSummary) };
}
export async function createEnv(id: string, input: EnvInput) {
  const path = await envPath(id);
  await upstream("netlify", `${path}?site_id=${encodeURIComponent(id)}`, "POST", [input]);
  return { ok: true };
}
export async function updateEnv(id: string, key: string, input: EnvInput | EnvValueInput, replace: boolean) {
  const path = await envPath(id);
  await upstream("netlify", `${path}/${encodeURIComponent(key)}?site_id=${encodeURIComponent(id)}`, replace ? "PUT" : "PATCH", input);
  return { ok: true };
}
export async function removeEnv(id: string, key: string, valueId?: string) {
  const path = await envPath(id);
  await upstream("netlify", `${path}/${encodeURIComponent(key)}${valueId ? `/value/${identifier(valueId)}` : ""}?site_id=${encodeURIComponent(id)}`, "DELETE");
  return { ok: true };
}
