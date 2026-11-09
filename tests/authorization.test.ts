import { after, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { registerHooks } from "node:module";
import { sealData } from "iron-session";
import { accountVersion, getAccount } from "../src/lib/accounts.ts";
import { hashPassword } from "../src/lib/security.ts";

// 仅替换 Next.js 的请求上下文，使用真实的加密 Cookie、授权函数与 API 处理器。
const cookieValues = new Map<string, string>();
let cookieMaxAge: number | undefined;
const testGlobals = globalThis as typeof globalThis & { __anuTestCookieStore?: unknown };
testGlobals.__anuTestCookieStore = {
  get(name: string) { return { value: cookieValues.get(name) ?? "" }; },
  set(name: string, value: string, options?: { maxAge?: number }) {
    cookieValues.set(name, value);
    cookieMaxAge = options?.maxAge;
  },
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
const likesRoute = await import("../src/app/api/data/flora-likes/route.ts");
const notesRoute = await import("../src/app/api/notes/route.ts");
const noteRoute = await import("../src/app/api/notes/[id]/route.ts");
const monkeyRoute = await import("../src/app/api/monkey-articles/route.ts");
const monkeyItemRoute = await import("../src/app/api/monkey-articles/[id]/route.ts");
const actions = await import("../src/app/actions.ts");
const originalFetch = globalThis.fetch;
let upstreamCalls = 0;
globalThis.fetch = async (input, init) => {
  upstreamCalls++;
  if (String(input).includes('/admin/monkey-articles')) return Response.json({ articles: [], nextCursor: null }, { headers: { ETag: 'W/\"v1\"', 'X-Article-Version': '\"v1\"' } });
  if (String(input).includes('/admin/notes')) {
    if (init?.method === 'GET' && String(input).endsWith(noteId)) return new Response(noteSource, { headers: { 'Content-Type': 'text/markdown', ETag: 'W/"version-one"', 'X-Note-Version': '"version-one"' } });
    return Response.json({ notes: [], nextCursor: null }, { headers: { ETag: '"version-two"' } });
  }
  if (String(input).includes('/admin/floratrium/likes')) return Response.json({ counts:{huahua:5,xiaohei:3},version:'1',updatedAt:null,limit:10,timezone:'Asia/Shanghai',days:[],adjustments:[] });
  return Response.json({ lucarioHeadache: true, headacheCount: 10, updatedAt: null });
};

beforeEach(() => {
  cookieValues.clear();
  cookieMaxAge = undefined;
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

async function signedSession(username: "admin" | "user", extra = {}) {
  const account = getAccount(username)!;
  cookieValues.set("anuconsole_session", await sealData({
    username, expiresAt: Date.now() + 60000, credentialVersion: accountVersion(account), ...extra,
  }, { password: process.env.SESSION_SECRET!, ttl: auth.SESSION_TTL }));
}
const updateRequest = () => new Request("https://console.example.invalid/api/features/home", {
  method: "PUT", headers: { Origin: "https://console.example.invalid", "Content-Type": "application/json" },
  body: JSON.stringify({ lucarioHeadache: false }),
});

for (const username of ["admin", "user", "guest"] as const) {
  test(`${username} 登录后会话与持久 Cookie 保留 14 天，到期立即失效`, async t => {
    const now = Date.now();
    const fourteenDays = 14 * 24 * 60 * 60;
    t.mock.timers.enable({ apis: ["Date"], now });
    await auth.createUserSession(username);
    assert.equal(cookieMaxAge, fourteenDays);
    assert.equal((await auth.getSession()).expiresAt, now + fourteenDays * 1000);
    // 使用真实加密 Cookie 重新读取，验证有效期边界而非仅检查配置常量。
    t.mock.timers.tick(fourteenDays * 1000 - 1);
    assert.equal((await auth.getAuthenticatedUser())?.username, username);
    t.mock.timers.tick(1);
    assert.equal(await auth.getAuthenticatedUser(), null);
  });
}

test("未登录及伪造 Cookie 不能访问受保护的读取接口", async () => {
  await assert.rejects(() => route.GET(), /REDIRECT:\/login/);
  cookieValues.set("anuconsole_session", "forged-session");
  await assert.rejects(() => route.GET(), /REDIRECT:\/login/);
  assert.equal(upstreamCalls, 0);
});

test("user 可读取数据，但直接写入返回 403 且不访问上游", async () => {
  await signedSession("user", { role: "admin" });
  assert.deepEqual(await auth.requireUser(), { username: "user", role: "viewer" });
  assert.equal((await route.GET()).status, 200);
  assert.equal(upstreamCalls, 1);
  const denied = await route.PUT(updateRequest());
  assert.equal(denied.status, 403);
  assert.deepEqual(await denied.json(), { error: "forbidden" });
  assert.equal(upstreamCalls, 1);
});

test("管理员保留写权限，开发免登录也不提升已登录 user 的权限", async () => {
  await signedSession("admin");
  assert.equal((await route.PUT(updateRequest())).status, 200);
  await signedSession("user");
  Object.assign(process.env, { NODE_ENV: "development" });
  assert.equal((await route.PUT(updateRequest())).status, 403);
  cookieValues.clear();
  assert.equal((await auth.requireUser()).role, "admin");
});

test("密码变更、禁用 user 和会话到期后不可继续读取", async () => {
  await signedSession("user");
  delete process.env.VIEWER_PASSWORD_HASH;
  await assert.rejects(() => route.GET(), /REDIRECT:\/login/);
  Object.assign(process.env, credentials);
  await signedSession("user", { expiresAt: Date.now() - 1 });
  await assert.rejects(() => route.GET(), /REDIRECT:\/login/);
});

test("登录动作创建正确角色的加密会话，账号与密码不能交叉使用", async () => {
  for (const [username, password] of [["user", viewerPassword], ["admin", adminPassword]]) {
    const form = new FormData();
    form.set("username", username);
    form.set("password", password);
    await assert.rejects(() => actions.login({ error: "" }, form), /REDIRECT:\/$/);
    assert.equal((await auth.requireUser()).username, username);
  }
  const wrong = new FormData();
  wrong.set("username", "user");
  wrong.set("password", adminPassword);
  assert.match((await actions.login({ error: "" }, wrong)).error, /账号或密码错误/);
});


test("喜爱维护只读用户不可写，管理员写入受同源与字段校验保护", async () => {
  await signedSession('user');
  assert.equal((await likesRoute.GET()).status, 200);
  const write = (origin = 'https://console.example.invalid', counts = {huahua:10,xiaohei:20}) => new Request('https://console.example.invalid/api/data/flora-likes', {method:'PUT',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({counts,version:'1'})});
  assert.equal((await likesRoute.PUT(write())).status,403);
  assert.equal(upstreamCalls,1);
  await signedSession('admin');
  assert.equal((await likesRoute.PUT(write('https://evil.invalid'))).status,403);
  assert.equal((await likesRoute.PUT(write('https://console.example.invalid',{huahua:-1,xiaohei:1}))).status,400);
  assert.equal(upstreamCalls,1);
  assert.equal((await likesRoute.PUT(write())).status,200);
  assert.equal(upstreamCalls,2);
});


test("游客无需密码即可登录，生产及开发环境始终只读", async () => {
  delete process.env.VIEWER_PASSWORD_HASH;
  const form = new FormData();
  form.set("username", "admin");
  form.set("role", "admin");
  await assert.rejects(() => actions.guestLogin({ error: "" }, form), /REDIRECT:\/$/);
  for (const environment of ["production", "development"]) {
    Object.assign(process.env, { NODE_ENV: environment });
    assert.deepEqual(await auth.requireUser(), { username: "guest", role: "viewer" });
    assert.equal((await route.GET()).status, 200);
    const before = upstreamCalls;
    assert.equal((await route.PUT(updateRequest())).status, 403);
    assert.equal(upstreamCalls, before);
  }
});

test("游客会话到期或管理员凭据轮换后失效", async () => {
  await assert.rejects(() => actions.guestLogin({ error: "" }, new FormData()), /REDIRECT:\/$/);
  const session = await auth.getSession();
  session.expiresAt = Date.now() - 1;
  await session.save();
  await assert.rejects(() => route.GET(), /REDIRECT:\/login/);
  await assert.rejects(() => actions.guestLogin({ error: "" }, new FormData()), /REDIRECT:\/$/);
  process.env.ADMIN_PASSWORD_HASH = await hashPassword(randomBytes(18).toString("hex"));
  await assert.rejects(() => route.GET(), /REDIRECT:\/login/);
});

const noteId = '2aa08581-e032-4f35-9aa7-c84c19c57e98';
const noteSource = '---\ntitle: "笔记测试"\ndate: "2026-10-31"\ncategory: technology\n---\n\n## 正文';
const noteContext = () => ({ params: Promise.resolve({ id: noteId }) });
const noteRequest = (origin = 'https://console.example.invalid', body = noteSource) => new Request(`https://console.example.invalid/api/notes/${noteId}`, {
  method: 'PUT', headers: { Origin: origin, 'Content-Type': 'text/markdown' }, body,
});
test('笔记接口拒绝匿名访问，只读账号不可发布，管理员写入受同源和文件格式校验保护', async () => {
  await assert.rejects(notesRoute.GET(new Request('https://console.example.invalid/api/notes')), /REDIRECT:/);
  await signedSession('user');
  assert.equal((await notesRoute.GET(new Request('https://console.example.invalid/api/notes'))).status, 200);
  upstreamCalls = 0;
  assert.equal((await noteRoute.PUT(noteRequest(), noteContext())).status, 403);
  assert.equal(upstreamCalls, 0);
  await signedSession('admin');
  assert.equal((await noteRoute.PUT(noteRequest('https://evil.invalid'), noteContext())).status, 403);
  assert.equal((await noteRoute.PUT(noteRequest(undefined, '# 缺少元信息'), noteContext())).status, 400);
  assert.equal(upstreamCalls, 0);
  assert.equal((await noteRoute.PUT(noteRequest(), noteContext())).status, 200);
  assert.equal(upstreamCalls, 1);
});

test('笔记编辑和删除始终校验管理员、同源和版本，读取代理保留 ETag', async () => {
  const request = (method: string, origin = 'https://console.example.invalid', etag: string | null = '"version-one"') => new Request(`https://console.example.invalid/api/notes/${noteId}`, {
    method, headers: { Origin: origin, 'Content-Type': 'text/markdown', ...(etag ? { 'If-Match': etag } : {}) }, body: method === 'PATCH' ? noteSource : undefined,
  });
  await signedSession('user');
  const read = await noteRoute.GET(request('GET'), noteContext());
  assert.equal(read.headers.get('ETag'), '"version-one"');
  assert.equal(read.headers.get('X-Note-Version'), '"version-one"');
  assert.equal(await read.text(), noteSource);
  upstreamCalls = 0;
  assert.equal((await noteRoute.PATCH(request('PATCH'), noteContext())).status, 403);
  assert.equal((await noteRoute.DELETE(request('DELETE'), noteContext())).status, 403);
  assert.equal(upstreamCalls, 0);
  await signedSession('admin');
  for (const method of ['PATCH', 'DELETE'] as const) {
    assert.equal((await noteRoute[method](request(method, 'https://evil.invalid'), noteContext())).status, 403);
    assert.equal((await noteRoute[method](request(method, undefined, null), noteContext())).status, 428);
  }
  assert.equal(upstreamCalls, 0);
  const received: { method?: string; etag?: string | null }[] = [];
  const currentFetch = globalThis.fetch;
  globalThis.fetch = async (_input, init) => {
    received.push({ method: init?.method, etag: new Headers(init?.headers).get('If-Match') });
    return Response.json({ id: noteId, etag: '"version-two"' }, { headers: { ETag: '"version-two"' } });
  };
  try {
    assert.equal((await noteRoute.PATCH(request('PATCH'), noteContext())).headers.get('ETag'), '"version-two"');
    assert.equal((await noteRoute.DELETE(request('DELETE'), noteContext())).status, 200);
    assert.deepEqual(received, [{ method: 'PATCH', etag: '"version-one"' }, { method: 'DELETE', etag: '"version-one"' }]);
    globalThis.fetch = async () => Response.json({ error: 'note_conflict' }, { status: 412 });
    assert.equal((await noteRoute.PATCH(request('PATCH'), noteContext())).status, 412);
    assert.equal((await noteRoute.DELETE(request('DELETE'), noteContext())).status, 412);
  } finally { globalThis.fetch = currentFetch; }
});


test("猴子档案读取需要登录，删除校验管理员、同源与版本", async () => {
  const id = "8200000000000-00000000-0000-4000-8000-000000000001";
  const context = { params: Promise.resolve({ id }) };
  const list = new Request("https://console.example.invalid/api/monkey-articles");
  const deletion = (origin = "https://console.example.invalid", etag = '\"v1\"') => new Request(`${list.url}/${id}`, { method: "DELETE", headers: { Origin: origin, "If-Match": etag } });
  await assert.rejects(() => monkeyRoute.GET(list), /REDIRECT:\/login/);
  await signedSession("user");
  assert.equal((await monkeyRoute.GET(list)).status, 200);
  assert.equal((await monkeyItemRoute.GET(list, context)).headers.get("ETag"), '"v1"');
  const before = upstreamCalls;
  assert.equal((await monkeyItemRoute.DELETE(deletion(), context)).status, 403);
  assert.equal(upstreamCalls, before);
  await signedSession("admin");
  assert.equal((await monkeyItemRoute.DELETE(deletion("https://evil.invalid"), context)).status, 403);
  assert.equal((await monkeyItemRoute.DELETE(deletion(undefined, ""), context)).status, 428);
  assert.equal((await monkeyItemRoute.GET(list, { params: Promise.resolve({id:"bad"}) })).status, 404);
  assert.equal(upstreamCalls, before);
  assert.equal((await monkeyItemRoute.DELETE(deletion(), context)).status, 200);
  assert.equal(upstreamCalls, before + 1);
});
