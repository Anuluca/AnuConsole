/** 浏览器和服务端共用字段定义；凭据及上游地址不属于这个模块。 */
export const DNS_ZONE = "anuluca.com";
export const dnsTypes = ["A", "AAAA", "CNAME", "TXT", "MX", "NS", "PTR", "SRV", "CAA", "HTTPS", "SVCB", "DS", "DNSKEY", "CERT", "LOC", "NAPTR", "SMIMEA", "SSHFP", "TLSA", "URI", "OPENPGPKEY"] as const;
export type DnsType = typeof dnsTypes[number];
export type JsonObject = Record<string, unknown>;
export type DnsInput = {
  type: DnsType; name: string; content?: string; ttl: number; proxied?: boolean;
  priority?: number; comment?: string; tags?: string[]; data?: JsonObject; settings?: JsonObject;
};
export type DnsRecord = DnsInput & { id: string; proxiable: boolean; modified_on?: string };
export type DnsPage = { records: DnsRecord[]; page: number; total: number; pages: number; zone: string };

export const envContexts = ["all", "production", "deploy-preview", "branch-deploy", "branch", "dev", "dev-server"] as const;
export const envScopes = ["builds", "functions", "runtime", "post-processing"] as const;
export type EnvContext = typeof envContexts[number];
export type EnvScope = typeof envScopes[number];
export type EnvValueInput = { context: EnvContext; context_parameter?: string; value: string };
export type EnvInput = { key: string; scopes: EnvScope[]; is_secret: boolean; values: EnvValueInput[] };
export type EnvVariable = {
  key: string; scopes: EnvScope[]; is_secret: boolean;
  values: { id: string; context: EnvContext; context_parameter?: string }[];
  updated_at?: string;
};
export type NetlifySite = { screenshot_url?: string; id: string; name: string; url: string; account: string; updated_at?: string; published_deploy?: string };
export type NetlifyDetail = NetlifySite & { settings: JsonObject; repo_url?: string; admin_url: string };
export type NetlifyAccount = { id: string; slug: string; name: string };
export type GitHubRepository = { id: number; path: string; defaultBranch: string; private: boolean; linked: boolean; buildCommand?: string; publishDirectory?: string };
export type GitHubRepositoryPage = { repositories: GitHubRepository[]; page: number; hasMore: boolean };
export type NetlifyCreateInput = { accountSlug: string; settings: JsonObject };
export type NetlifyDeploy = { id: string; state: string; branch?: string; title?: string; context?: string; created_at?: string; published_at?: string; url?: string; commit_ref?: string };
export type SettingField = { label: string; kind: "string" | "boolean" | "strings" | "integer"; help?: string; secret?: boolean };

// 只开放官方 siteSetup/repoInfo 中的配置字段。响应中的账号、令牌、状态等字段不能回写。
export const siteFields: Record<string, SettingField> = {
  name: { label: "项目名称", kind: "string" },
  custom_domain: { label: "主域名", kind: "string", help: "只填写域名，不包含协议和路径；留空移除。" },
  domain_aliases: { label: "域名别名", kind: "strings" },
  branch_deploy_custom_domain: { label: "分支部署域名", kind: "string" },
  deploy_preview_custom_domain: { label: "部署预览域名", kind: "string" },
  notification_email: { label: "通知邮箱", kind: "string" },
  force_ssl: { label: "强制 HTTPS", kind: "boolean" },
  ssl: { label: "启用 SSL", kind: "boolean" },
  managed_dns: { label: "Netlify 托管 DNS", kind: "boolean", help: "anuluca.com 使用 Cloudflare DNS，修改此项前请确认域名托管方式。" },
  prevent_non_git_prod_deploys: { label: "仅允许 Git 生产部署", kind: "boolean" },
  functions_region: { label: "函数区域", kind: "string", help: "使用 Netlify 支持的区域标识；实际可用项取决于套餐。" },
  build_image: { label: "构建镜像", kind: "string" },
  prerender: { label: "预渲染配置", kind: "string" },
  password: { label: "站点访问密码", kind: "string", secret: true, help: "仅在需要更改时填写；留空不修改。" },
};
export const buildFields: Record<string, SettingField> = {
  repo_branch: { label: "生产分支", kind: "string" },
  cmd: { label: "构建命令", kind: "string" },
  dir: { label: "发布目录", kind: "string" },
  functions_dir: { label: "函数目录", kind: "string" },
  allowed_branches: { label: "允许构建的分支", kind: "strings" },
  stop_builds: { label: "停止自动构建", kind: "boolean" },
  private_logs: { label: "构建日志仅成员可见", kind: "boolean" },
  public_repo: { label: "公开仓库", kind: "boolean" },
  provider: { label: "Git 提供方", kind: "string" },
  repo_path: { label: "仓库路径", kind: "string" },
  repo_url: { label: "仓库地址", kind: "string" },
  installation_id: { label: "Git 安装 ID", kind: "integer" },
  deploy_key_id: { label: "部署公钥 ID", kind: "string" },
  id: { label: "仓库 ID", kind: "integer" },
};

export class InfrastructureError extends Error {
  code: string;
  status: number;
  constructor(code: string, status = 400) { super(code); this.code = code; this.status = status; }
}
export function object(value: unknown): value is JsonObject {
  return !!value && typeof value === "object" && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype;
}
export function invalid(): never { throw new InfrastructureError("invalid_input"); }
export function identifier(value: string): string {
  if (!/^[a-zA-Z0-9_-]{1,128}$/.test(value)) invalid();
  return value;
}
export function envKey(value: string): string {
  if (!/^[a-zA-Z_][a-zA-Z0-9_]{0,254}$/.test(value)) invalid();
  return value;
}
function onlyKeys(value: JsonObject, allowed: readonly string[]) {
  if (Object.keys(value).some(key => !allowed.includes(key))) invalid();
}
function safeJson(value: unknown, depth = 0): boolean {
  if (depth > 6) return false;
  if (value === null || typeof value === "boolean" || typeof value === "string") return true;
  if (typeof value === "number") return Number.isFinite(value);
  if (Array.isArray(value)) return value.length <= 100 && value.every(item => safeJson(item, depth + 1));
  return object(value) && Object.entries(value).length <= 100 && Object.entries(value).every(([key, item]) =>
    !["__proto__", "prototype", "constructor"].includes(key) && safeJson(item, depth + 1));
}

export function validateDns(value: unknown): DnsInput {
  if (!object(value)) invalid();
  onlyKeys(value, ["type", "name", "content", "ttl", "proxied", "priority", "comment", "tags", "data", "settings"]);
  if (!dnsTypes.includes(value.type as DnsType) || typeof value.name !== "string") invalid();
  // @ 和相对记录名在服务端展开；所有写入必须落在固定的 anuluca.com 区域中。
  let name = value.name.trim().toLowerCase().replace(/\.$/, "");
  if (name === "@") name = DNS_ZONE;
  else if (!name.includes(".")) name += `.${DNS_ZONE}`;
  if (name.length > 253 || !(name === DNS_ZONE || name.endsWith(`.${DNS_ZONE}`)) ||
    !name.split(".").every(label => label.length > 0 && label.length <= 63 && /^(?:\*|[a-z0-9_](?:[a-z0-9_-]*[a-z0-9_])?)$/.test(label))) invalid();
  if (!Number.isInteger(value.ttl) || (value.ttl !== 1 && (Number(value.ttl) < 30 || Number(value.ttl) > 86400))) invalid();
  if (value.content !== undefined && (typeof value.content !== "string" || value.content.length > 65535)) invalid();
  if (value.data !== undefined && (!object(value.data) || !safeJson(value.data))) invalid();
  if (value.content === undefined && value.data === undefined) invalid();
  if (value.proxied !== undefined && typeof value.proxied !== "boolean") invalid();
  if (value.proxied === true && !["A", "AAAA", "CNAME"].includes(String(value.type))) invalid();
  if (value.priority !== undefined && (!Number.isInteger(value.priority) || Number(value.priority) < 0 || Number(value.priority) > 65535)) invalid();
  if (value.comment !== undefined && (typeof value.comment !== "string" || value.comment.length > 500)) invalid();
  if (value.tags !== undefined && (!Array.isArray(value.tags) || value.tags.length > 50 || !value.tags.every(tag => typeof tag === "string" && tag.length <= 100))) invalid();
  if (value.settings !== undefined) {
    if (!object(value.settings)) invalid();
    onlyKeys(value.settings, ["ipv4_only", "ipv6_only", "flatten_cname"]);
    if (!Object.values(value.settings).every(item => typeof item === "boolean")) invalid();
  }
  return { ...value, name } as DnsInput;
}

function validateFields(value: unknown, fields: Record<string, SettingField>): JsonObject {
  if (!object(value)) invalid();
  onlyKeys(value, Object.keys(fields));
  for (const [key, item] of Object.entries(value)) {
    const field = fields[key];
    if (field.kind === "boolean" && typeof item !== "boolean") invalid();
    if (field.kind === "string" && item !== null && (typeof item !== "string" || item.length > 4096 || item.includes("\u0000"))) invalid();
    if (field.kind === "integer" && (!Number.isSafeInteger(item) || Number(item) < 0)) invalid();
    if (field.kind === "strings" && (!Array.isArray(item) || item.length > 100 || !item.every(x => typeof x === "string" && x.length <= 255))) invalid();
  }
  return value;
}
export function validateSiteSettings(value: unknown): JsonObject {
  if (!object(value) || !Object.keys(value).length) invalid();
  const { build_settings, repo, processing_settings, ...basic } = value;
  validateFields(basic, siteFields);
  if ("name" in basic && (typeof basic.name !== "string" || !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(basic.name))) invalid();
  for (const key of ["custom_domain", "branch_deploy_custom_domain", "deploy_preview_custom_domain"]) {
    const domain = basic[key];
    if (domain && (typeof domain !== "string" || !/^(?:\*\.)?[a-zA-Z0-9](?:[a-zA-Z0-9.-]*[a-zA-Z0-9])?$/.test(domain))) invalid();
  }
  if (build_settings !== undefined) validateFields(build_settings, buildFields);
  if (repo !== undefined) validateFields(repo, buildFields);
  if (processing_settings !== undefined) {
    if (!object(processing_settings)) invalid();
    onlyKeys(processing_settings, ["html"]);
    if (!object(processing_settings.html)) invalid();
    onlyKeys(processing_settings.html, ["pretty_urls"]);
    if (typeof processing_settings.html.pretty_urls !== "boolean") invalid();
  }
  return value;
}
export function publicSettings(site: JsonObject): JsonObject {
  const result: JsonObject = {};
  for (const key of Object.keys(siteFields)) if (!siteFields[key].secret && key in site) result[key] = site[key];
  if (object(site.build_settings)) result.build_settings = Object.fromEntries(Object.entries(site.build_settings).filter(([key]) => key in buildFields));
  if (object(site.processing_settings) && object(site.processing_settings.html)) result.processing_settings = { html: { pretty_urls: site.processing_settings.html.pretty_urls === true } };
  return result;
}

export function validateNetlifyCreate(value: unknown): NetlifyCreateInput {
  if (!object(value)) invalid();
  onlyKeys(value, ["accountSlug", "settings"]);
  if (typeof value.accountSlug !== "string") invalid();
  identifier(value.accountSlug);
  if (!object(value.settings)) invalid();
  onlyKeys(value.settings, ["name", "custom_domain", "repo"]);
  const settings = validateSiteSettings(value.settings);
  if (typeof settings.name !== "string" || !settings.name) invalid();
  if (settings.repo !== undefined) {
    const repo = settings.repo as JsonObject;
    if (!["github", "gitlab", "bitbucket"].includes(String(repo.provider)) ||
      typeof repo.repo_path !== "string" || !/^[a-zA-Z0-9_.-]+(?:\/[a-zA-Z0-9_.-]+)+$/.test(repo.repo_path) ||
      typeof repo.repo_branch !== "string" || !repo.repo_branch.trim()) invalid();
  }
  return { accountSlug: value.accountSlug, settings };
}

export function validateEnvValue(value: unknown): EnvValueInput {
  if (!object(value)) invalid();
  onlyKeys(value, ["context", "context_parameter", "value"]);
  if (!envContexts.includes(value.context as EnvContext) || typeof value.value !== "string" || value.value.length > 32768 || value.value.includes("\u0000")) invalid();
  if (value.context === "branch") {
    if (typeof value.context_parameter !== "string" || !value.context_parameter.trim() || value.context_parameter.length > 255) invalid();
  } else if (value.context_parameter !== undefined && value.context_parameter !== "") invalid();
  return value as EnvValueInput;
}
export function validateEnv(value: unknown): EnvInput {
  if (!object(value)) invalid();
  onlyKeys(value, ["key", "scopes", "is_secret", "values"]);
  if (typeof value.key !== "string") invalid();
  envKey(value.key);
  if (typeof value.is_secret !== "boolean" || !Array.isArray(value.scopes) || !value.scopes.length ||
    !value.scopes.every(scope => envScopes.includes(scope as EnvScope)) || new Set(value.scopes).size !== value.scopes.length) invalid();
  if (!Array.isArray(value.values) || !value.values.length || value.values.length > 50) invalid();
  const values = value.values.map(validateEnvValue);
  if (new Set(values.map(item => `${item.context}:${item.context_parameter ?? ""}`)).size !== values.length) invalid();
  return { key: value.key, scopes: value.scopes as EnvScope[], is_secret: value.is_secret, values };
}

export const infrastructureMessages: Record<string, string> = {
  cloudflare_not_configured: "尚未配置 Cloudflare API 令牌或 Zone ID。",
  netlify_not_configured: "尚未配置 Netlify API 令牌。",
  netlify_creation_restricted: "当前已启用项目 ID 允许列表，新增项目需先调整服务端管理范围。",
  netlify_create_rejected: "Netlify 拒绝创建项目，请检查名称是否已被占用、团队权限及仓库授权。",
  github_not_configured: "尚未配置 GitHub 仓库读取授权，请在服务端配置 GITHUB_API_TOKEN。",
  github_unauthorized: "GitHub 仓库读取授权失效或权限不足，请检查令牌及仓库访问范围。",
  provider_unauthorized: "服务凭据失效或权限不足，请检查对应平台的令牌权限。",
  provider_rate_limited: "平台请求过于频繁，请稍后刷新。",
  provider_rejected: "平台拒绝了此次操作，请检查字段、资源状态及套餐支持情况。",
  provider_unavailable: "暂时无法连接平台，请稍后刷新。",
  invalid_response: "平台返回的数据不完整，请稍后刷新。",
  invalid_input: "提交内容无效，请检查表单。",
  not_found: "记录或项目不存在，或不在允许管理的范围内。",
  forbidden: "只读账号不能执行修改操作。",
  forbidden_origin: "请求来源校验失败，请刷新页面后重试。",
  invalid_content_type: "请求格式不正确。",
  body_too_large: "提交内容超过大小限制。",
  request_failed: "请求未完成。写入结果尚未确认，请先刷新数据再操作。",
};
