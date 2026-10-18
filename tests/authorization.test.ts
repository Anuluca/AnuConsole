import { after, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { registerHooks } from "node:module";
import { sealData } from "iron-session";
import { accountVersion, getAccount } from "../src/lib/accounts.ts";
import { hashPassword } from "../src/lib/security.ts";

// 仅替换 Next.js 的请求上下文，使用真实的加密 Cookie、授权函数与 API 处理器。
const cookieValues = new Map<string, string>();
const testGlobals = globalThis as typeof globalThis & { __anuTestCookieStore?: unknown };
testGlobals.__anuTestCookieStore = {
  get(name: string) { return { value: cookieValues.get(name) ?? "" }; },
  set(name: string, value: string) { cookieValues.set(name, value); },
};
const stubs: Record<string, string> = {
  "server-only": "export {};",
  "next/headers": "export async function cookies() { return globalThis.__anuTestCookieStore; }",
  "next/navigation": "export function redirect(path) { throw new Error('REDIRECT:' + path); }",
};
const hooks = registerHooks({
  resolve(specifier, context, nextResolve) {
    if (Object.hasOwn(stubs, specifier)) return { url: `data:text/javascript,${encodeURIComponent(stubs[specifier])}`, shortCircuit: true };
    if (specifier.startsWith("@/")) return { url: new URL(`../src/${specifier.slice(2)}.ts`, import.meta.url).href, shortCircuit: true };
    return nextResolve(specifier, context);
  },
});
const keys = ["NODE_ENV", "ADMIN_PASSWORD_HASH", "VIEWER_PASSWORD_HASH", "SESSION_SECRET", "HOME_FEATURES_TOKEN"] as const;
const originalEnv = Object.fromEntries(keys.map(key => [key, process.env[key]]));
const adminPassword = randomBytes(18).toString("hex");
const viewerPassword = randomBytes(18).toString("hex");
const credentials = { ADMIN_PASSWORD_HASH: await hashPassword(adminPassword), VIEWER_PASSWORD_HASH: await hashPassword(viewerPassword) };
Object.assign(process.env, credentials, { NODE_ENV: "test", SESSION_SECRET: randomBytes(48).toString("hex"), HOME_FEATURES_TOKEN: randomBytes(32).toString("hex") });
const auth = await import("../src/lib/auth.ts");
const route = await import("../src/app/api/features/home/route.ts");
const actions = await import("../src/app/actions.ts");
const originalFetch = globalThis.fetch;
let upstreamCalls = 0;
globalThis.fetch = async () => {
  upstreamCalls++;
  return Response.json({ lucarioHeadache: true, headacheCount: 10, updatedAt: null });
};

beforeEach(() => {
  cookieValues.clear();
  upstreamCalls = 0;
  Object.assign(process.env, credentials, { NODE_ENV: "test" });
});
after(() => {
  globalThis.fetch = originalFetch;
  delete testGlobals.__anuTestCookieStore;
  hooks.deregister();
  for (const key of keys) {
    if (originalEnv[key] === undefined) delete process.env[key];
    else Object.assign(process.env, { [key]: originalEnv[key] });
  }
});

async function signedSession(username: "admin" | "viewer", extra = {}) {
  const account = getAccount(username)!;
  cookieValues.set("anuconsole_session", await sealData({
    username, expiresAt: Date.now() + 60000, credentialVersion: accountVersion(account), ...extra,
  }, { password: process.env.SESSION_SECRET!, ttl: auth.SESSION_TTL }));
}
const updateRequest = () => new Request("https://console.example.invalid/api/features/home", {
  method: "PUT", headers: { Origin: "https://console.example.invalid", "Content-Type": "application/json" },
  body: JSON.stringify({ lucarioHeadache: false }),
});

test("未登录及伪造 Cookie 不能访问受保护的读取接口", async () => {
  await assert.rejects(() => route.GET(), /REDIRECT:\/login/);
  cookieValues.set("anuconsole_session", "forged-session");
  await assert.rejects(() => route.GET(), /REDIRECT:\/login/);
  assert.equal(upstreamCalls, 0);
});

test("viewer 可读取数据，但直接写入返回 403 且不访问上游", async () => {
  await signedSession("viewer", { role: "admin" });
  assert.deepEqual(await auth.requireUser(), { username: "viewer", role: "viewer" });
  assert.equal((await route.GET()).status, 200);
  assert.equal(upstreamCalls, 1);
  const denied = await route.PUT(updateRequest());
  assert.equal(denied.status, 403);
  assert.deepEqual(await denied.json(), { error: "forbidden" });
  assert.equal(upstreamCalls, 1);
});

test("管理员保留写权限，开发免登录也不提升已登录 viewer 的权限", async () => {
  await signedSession("admin");
  assert.equal((await route.PUT(updateRequest())).status, 200);
  await signedSession("viewer");
  Object.assign(process.env, { NODE_ENV: "development" });
  assert.equal((await route.PUT(updateRequest())).status, 403);
  cookieValues.clear();
  assert.equal((await auth.requireUser()).role, "admin");
});

test("密码变更、禁用 viewer 和会话到期后不可继续读取", async () => {
  await signedSession("viewer");
  delete process.env.VIEWER_PASSWORD_HASH;
  await assert.rejects(() => route.GET(), /REDIRECT:\/login/);
  Object.assign(process.env, credentials);
  await signedSession("viewer", { expiresAt: Date.now() - 1 });
  await assert.rejects(() => route.GET(), /REDIRECT:\/login/);
});

test("登录动作创建正确角色的加密会话，账号与密码不能交叉使用", async () => {
  for (const [username, password] of [["viewer", viewerPassword], ["admin", adminPassword]]) {
    const form = new FormData();
    form.set("username", username);
    form.set("password", password);
    await assert.rejects(() => actions.login({ error: "" }, form), /REDIRECT:\/$/);
    assert.equal((await auth.requireUser()).username, username);
  }
  const wrong = new FormData();
  wrong.set("username", "viewer");
  wrong.set("password", adminPassword);
  assert.match((await actions.login({ error: "" }, wrong)).error, /账号或密码错误/);
});
