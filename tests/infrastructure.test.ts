import { after, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { registerHooks } from "node:module";
import { sealData } from "iron-session";
import { accountVersion, getAccount } from "../src/lib/accounts.ts";
import { hashPassword } from "../src/lib/security.ts";
import { publicSettings, validateDns, validateEnv, validateNetlifyCreate, validateSiteSettings } from "../src/lib/infrastructure-contract.ts";

const cookies = new Map<string, string>();
const globals = globalThis as typeof globalThis & { __infraCookies?: unknown };
globals.__infraCookies = { get(name: string) { return { value: cookies.get(name) ?? "" }; }, set(name: string, value: string) { cookies.set(name, value); } };
const stubs: Record<string, string> = {
  "server-only": "export {};",
  "next/headers": "export async function cookies() { return globalThis.__infraCookies; }",
  "next/navigation": "export function redirect(path) { throw new Error('REDIRECT:' + path); }",
};
const hooks = registerHooks({ resolve(specifier, context, nextResolve) {
  if (Object.hasOwn(stubs, specifier)) return { url: `data:text/javascript,${encodeURIComponent(stubs[specifier])}`, shortCircuit: true };
  if (specifier.startsWith("@/")) return { url: new URL(`../src/${specifier.slice(2)}.ts`, import.meta.url).href, shortCircuit: true };
  return nextResolve(specifier, context);
} });
const envNames = ["NODE_ENV", "ADMIN_PASSWORD_HASH", "VIEWER_PASSWORD_HASH", "SESSION_SECRET", "CLOUDFLARE_API_TOKEN", "CLOUDFLARE_ZONE_ID", "NETLIFY_API_TOKEN", "NETLIFY_SITE_IDS", "GITHUB_API_TOKEN"];
const savedEnv = Object.fromEntries(envNames.map(key => [key, process.env[key]]));
const secret = randomBytes(48).toString("hex");
const credentials = { ADMIN_PASSWORD_HASH: await hashPassword(randomBytes(20).toString("hex")), VIEWER_PASSWORD_HASH: await hashPassword(randomBytes(20).toString("hex")), SESSION_SECRET: secret };
const auth = await import("../src/lib/auth.ts");
const dns = await import("../src/app/api/infrastructure/dns/route.ts");
const record = await import("../src/app/api/infrastructure/dns/[recordId]/route.ts");
const netlify = await import("../src/app/api/infrastructure/netlify/route.ts");
const teams = await import("../src/app/api/infrastructure/netlify/accounts/route.ts");
const repositories = await import("../src/app/api/infrastructure/netlify/repositories/route.ts");
const site = await import("../src/app/api/infrastructure/netlify/[siteId]/route.ts");
const deploys = await import("../src/app/api/infrastructure/netlify/[siteId]/deploys/route.ts");
const env = await import("../src/app/api/infrastructure/netlify/[siteId]/env/route.ts");
const variable = await import("../src/app/api/infrastructure/netlify/[siteId]/env/[key]/route.ts");
const originalFetch = globalThis.fetch;
let calls: { url: string; method: string; body?: string; authorization?: string }[] = [];
let reply: (url: string, init?: RequestInit) => Response = () => Response.json({});
globalThis.fetch = async (input, init) => {
  const url = String(input);
  calls.push({ url, method: init?.method ?? "GET", body: init?.body as string | undefined, authorization: (init?.headers as Record<string, string>)?.Authorization });
  return reply(url, init);
};
const siteId = "test-site";
const siteContext = { params: Promise.resolve({ siteId }) };
const envContext = { params: Promise.resolve({ siteId, key: "API_KEY" }) };
const dnsContext = { params: Promise.resolve({ recordId: "record-id" }) };
const base = "https://console.example.invalid";
function request(path = "/api/infrastructure/dns", method = "GET", body?: unknown, origin = base) {
  return new Request(`${base}${path}`, { method, headers: { Origin: origin, "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
}
async function login(username: "admin" | "viewer") {
  const account = getAccount(username)!;
  cookies.set("anuconsole_session", await sealData({ username, role: "admin", expiresAt: Date.now() + 60000, credentialVersion: accountVersion(account) }, { password: secret, ttl: auth.SESSION_TTL }));
}
beforeEach(() => {
  cookies.clear(); calls = []; delete process.env.GITHUB_API_TOKEN;
  Object.assign(process.env, credentials, { NODE_ENV: "test", CLOUDFLARE_API_TOKEN: randomBytes(24).toString("hex"), CLOUDFLARE_ZONE_ID: "a".repeat(32), NETLIFY_API_TOKEN: randomBytes(24).toString("hex"), NETLIFY_SITE_IDS: siteId });
  reply = () => Response.json({});
});
after(() => {
  globalThis.fetch = originalFetch; hooks.deregister(); delete globals.__infraCookies;
  for (const [key, value] of Object.entries(savedEnv)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
});

test("未登录拒绝读取；viewer 无法直接调用任何运维写接口", async () => {
  await assert.rejects(() => dns.GET(request()), /REDIRECT:\/login/);
  await assert.rejects(() => netlify.GET(request()), /REDIRECT:\/login/);
  await login("viewer");
  const responses = await Promise.all([
    dns.POST(request(undefined, "POST", {})), record.PATCH(request(undefined, "PATCH", {}), dnsContext), record.DELETE(request(undefined, "DELETE"), dnsContext),
    netlify.POST(request(undefined, "POST", {})),
    site.PATCH(request(undefined, "PATCH", {}), siteContext), deploys.POST(request(undefined, "POST", {}), siteContext), env.POST(request(undefined, "POST", {}), siteContext),
    variable.PATCH(request(undefined, "PATCH", {}), envContext), variable.PUT(request(undefined, "PUT", {}), envContext), variable.DELETE(request(undefined, "DELETE"), envContext),
  ]);
  assert.ok(responses.every(response => response.status === 403));
  assert.equal(calls.length, 0);
});

test("运维写接口拒绝跨站来源、域名越界和畸形配置，均不访问外部平台", async () => {
  await login("admin");
  assert.equal((await dns.POST(request(undefined, "POST", {}, "https://other.invalid"))).status, 403);
  assert.equal((await dns.POST(request(undefined, "POST", { type: "A", name: "example.com", content: "192.0.2.1", ttl: 1 }))).status, 400);
  assert.equal((await site.PATCH(request(undefined, "PATCH", { default_hooks_data: { access_token: "blocked" } }), siteContext)).status, 400);
  assert.equal((await env.POST(request(undefined, "POST", { key: "X", scopes: [], is_secret: true, values: [] }), siteContext)).status, 400);
  assert.equal(calls.length, 0);
  const oversized = new Request(`${base}/api/infrastructure/dns`, { method: "POST", headers: { Origin: base, "Content-Type": "application/json" }, body: JSON.stringify({ content: "x".repeat(140000) }) });
  assert.equal((await dns.POST(oversized)).status, 413);
});

test("DNS 写入使用固定区域与服务端令牌，支持自动 TTL 和结构化记录", async () => {
  await login("admin");
  const input = { type: "A", name: "test", content: "192.0.2.1", ttl: 1, proxied: false };
  reply = () => Response.json({ success: true, result: { ...input, name: "test.anuluca.com", id: "record-id", proxiable: true } });
  const result = await dns.POST(request(undefined, "POST", input));
  assert.equal(result.status, 200);
  assert.equal(calls[0].url, `https://api.cloudflare.com/client/v4/zones/${"a".repeat(32)}/dns_records`);
  assert.equal(calls[0].authorization, `Bearer ${process.env.CLOUDFLARE_API_TOKEN}`);
  assert.equal(JSON.parse(calls[0].body!).name, "test.anuluca.com");
  assert.equal(JSON.stringify(await result.json()).includes(process.env.CLOUDFLARE_API_TOKEN!), false);
  assert.equal(validateDns({ type: "CAA", name: "@", ttl: 60, data: { flags: 0, tag: "issue", value: "ca.example" } }).name, "anuluca.com");
  assert.throws(() => validateDns({ ...input, type: "TXT", proxied: true }));
});

test("项目允许列表在服务端生效，项目详情不泄漏令牌、环境变量和站点密码", async () => {
  await login("admin");
  reply = () => Response.json({ id: siteId, name: "demo", account_id: "account-id", password: "private", default_hooks_data: { access_token: "private" }, build_settings: { cmd: "npm run build", env: { SECRET: "private" } } });
  const result = await site.GET(request(), siteContext);
  assert.equal(result.status, 200);
  const text = JSON.stringify(await result.json());
  assert.equal(text.includes("private"), false);
  assert.equal(text.includes("npm run build"), true);
  const denied = await site.GET(request(), { params: Promise.resolve({ siteId: "other-site" }) });
  assert.equal(denied.status, 404);
  assert.equal(calls.length, 1);
});

test("环境变量响应不含任意上下文的明文；修改单一上下文不覆盖其他值", async () => {
  await login("viewer");
  reply = url => Response.json(url.includes("/accounts/") ? [{ key: "API_KEY", scopes: ["functions"], is_secret: true, values: [{ id: "value-id", context: "dev", value: "must-never-leak" }, { id: "prod-id", context: "production", value: "must-never-leak" }] }] : { id: siteId, name: "demo", account_id: "account-id" });
  const response = await env.GET(request(), siteContext);
  const body = JSON.stringify(await response.json());
  assert.equal(body.includes("must-never-leak"), false);
  assert.equal(body.includes('"value":'), false);
  await login("admin");
  const input = { context: "production", value: randomBytes(12).toString("hex") };
  assert.equal((await variable.PATCH(request(undefined, "PATCH", input), envContext)).status, 200);
  assert.equal(calls.at(-1)!.url, `https://api.netlify.com/api/v1/accounts/account-id/env/API_KEY?site_id=${siteId}`);
  assert.deepEqual(JSON.parse(calls.at(-1)!.body!), input);
  assert.equal(calls.at(-1)!.method, "PATCH");
});

test("平台拒绝与网络故障不回显敏感错误，也不自动重试写入", async () => {
  await login("admin");
  reply = () => Response.json({ error: "sensitive-upstream-body" }, { status: 422 });
  const response = await dns.POST(request(undefined, "POST", { type: "TXT", name: "@", content: "value", ttl: 60 }));
  assert.equal(response.status, 502);
  assert.deepEqual(await response.json(), { error: "provider_rejected" });
  assert.equal(calls.length, 1);
  calls = [];
  reply = () => { throw new TypeError("network failure"); };
  assert.equal((await dns.GET(request())).status, 502);
  assert.equal(calls.length, 1);
});

test("配置校验拒绝只读字段和旧 env 写法，重设变量拒绝重复上下文", () => {
  assert.throws(() => validateSiteSettings({ account_id: "other-account" }));
  assert.throws(() => validateSiteSettings({ build_settings: { env: { X: "Y" } } }));
  assert.throws(() => validateSiteSettings(JSON.parse('{"__proto__":{"polluted":true}}')));
  assert.throws(() => validateEnv({ key: "X", scopes: ["builds"], is_secret: false, values: [{ context: "all", value: "a" }, { context: "all", value: "b" }] }));
  assert.deepEqual(publicSettings({ password: "hidden", build_settings: { env: { SECRET: "hidden" }, cmd: "build" } }), { build_settings: { cmd: "build" } });
});

test("创建项目验证团队归属，调用团队创建接口并返回脱敏详情", async () => {
  await login("admin");
  delete process.env.NETLIFY_SITE_IDS;
  const input = { accountSlug: "my-team", settings: { name: "new-project", custom_domain: "new.example.invalid" } };
  reply = (url, init) => url.endsWith("/accounts") ? Response.json([{ id: "account-id", slug: "my-team", name: "团队", billing_email: "hidden@example.invalid" }])
    : Response.json({ id: "new-site", name: "new-project", account_id: "account-id", password: "hidden-password", default_hooks_data: { access_token: "hidden-token" } }, { status: init?.method === "POST" ? 201 : 200 });
  const choices = await teams.GET(request());
  assert.deepEqual(await choices.json(), { accounts: [{ id: "account-id", slug: "my-team", name: "团队" }] });
  const created = await netlify.POST(request(undefined, "POST", input));
  assert.equal(created.status, 200);
  const body = await created.json();
  assert.equal(body.site.id, "new-site");
  assert.equal(JSON.stringify(body).includes("hidden"), false);
  assert.equal(calls.at(-1)!.url, "https://api.netlify.com/api/v1/my-team/sites?configure_dns=false");
  assert.equal(calls.at(-1)!.method, "POST");
  assert.deepEqual(JSON.parse(calls.at(-1)!.body!), { ...input.settings, managed_dns: false });
  assert.equal(calls.filter(call => call.method === "POST").length, 1);
});

test("创建项目不绕过允许列表，不向未知团队写入，也拒绝非法名称及字段", async () => {
  await login("admin");
  const input = { accountSlug: "my-team", settings: { name: "new-project" } };
  assert.equal((await netlify.POST(request(undefined, "POST", input))).status, 403);
  assert.equal(calls.length, 0);
  delete process.env.NETLIFY_SITE_IDS;
  reply = () => Response.json([{ id: "account-id", slug: "another-team", name: "其他团队" }]);
  assert.equal((await netlify.POST(request(undefined, "POST", input))).status, 404);
  assert.equal(calls.filter(call => call.method === "POST").length, 0);
  assert.throws(() => validateNetlifyCreate({ ...input, settings: { name: "Bad Name" } }));
  assert.throws(() => validateNetlifyCreate({ ...input, settings: { name: "valid", account_id: "other-account" } }));
  assert.throws(() => validateNetlifyCreate({ ...input, settings: { name: "valid", repo: { provider: "github", repo_path: "missing-owner", repo_branch: "main" } } }));
});

test("仓库列表支持私有仓库，GitHub 与 Netlify 凭据隔离且不返回多余平台字段", async () => {
  await assert.rejects(() => repositories.GET(request()), /REDIRECT:\/login/);
  await login("viewer");
  assert.equal((await repositories.GET(request())).status, 503);
  assert.equal(calls.length, 0);
  process.env.GITHUB_API_TOKEN = randomBytes(24).toString("hex");
  reply = url => url.startsWith("https://api.github.com/") ? Response.json([
    { id: 123, full_name: "example/private-repo", default_branch: "develop", private: true, temp_clone_token: "never-return", owner: { email: "never-return" } },
    { id: 456, full_name: "example/archived", default_branch: "main", private: false, archived: true },
  ]) : Response.json([{ id: siteId, build_settings: { provider: "github", repo_path: "example/private-repo", installation_id: 77, cmd: "npm run build", dir: "dist", env: { SECRET: "never-return" } } }]);
  const response = await repositories.GET(request("/api/infrastructure/netlify/repositories?page=2"));
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.deepEqual(body, { repositories: [{ id: 123, path: "example/private-repo", defaultBranch: "develop", private: true, linked: true, buildCommand: "npm run build", publishDirectory: "dist" }], page: 2, hasMore: false });
  assert.equal(JSON.stringify(body).includes("never-return"), false);
  assert.equal(calls.find(call => call.url.startsWith("https://api.github.com/"))!.authorization, `Bearer ${process.env.GITHUB_API_TOKEN}`);
  assert.equal(calls.find(call => call.url.startsWith("https://api.netlify.com/"))!.authorization, `Bearer ${process.env.NETLIFY_API_TOKEN}`);
});

test("从仓库选择创建时服务端重读仓库身份，并自动补充已有 Netlify 关联", async () => {
  await login("admin"); delete process.env.NETLIFY_SITE_IDS;
  process.env.GITHUB_API_TOKEN = randomBytes(24).toString("hex");
  reply = (url, init) => {
    if (url.endsWith("/accounts")) return Response.json([{ id: "account", slug: "team", name: "团队" }]);
    if (url.startsWith("https://api.github.com/")) return Response.json({ id: 123, full_name: "example/private-repo", private: true });
    if (init?.method === "POST") return Response.json({ id: "new-site", name: "new-project", account_id: "account" });
    return Response.json([{ id: siteId, build_settings: { provider: "github", repo_path: "example/existing", installation_id: 77 } }]);
  };
  const input = { accountSlug: "team", settings: { name: "new-project", repo: { provider: "github", id: 123, repo_path: "example/private-repo", repo_branch: "develop", cmd: "npm run build", public_repo: true, installation_id: 999 } } };
  assert.equal((await netlify.POST(request(undefined, "POST", input))).status, 200);
  const posted = JSON.parse(calls.find(call => call.method === "POST")!.body!);
  assert.equal(posted.repo.installation_id, 77);
  assert.equal(posted.repo.public_repo, false);
  assert.equal(posted.repo.repo_url, "https://github.com/example/private-repo");
  assert.equal(posted.repo.cmd, "npm run build");
  calls = [];
  assert.equal((await netlify.POST(request(undefined, "POST", { ...input, settings: { ...input.settings, repo: { ...input.settings.repo, id: 456 } } }))).status, 400);
  assert.equal(calls.some(call => call.method === "POST"), false);
});
