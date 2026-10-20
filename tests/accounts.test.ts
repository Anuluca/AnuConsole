import { test } from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { accountVersion, authenticateAccount, getAccount, sessionIdentity } from "../src/lib/accounts.ts";
import { hashPassword } from "../src/lib/security.ts";
import { upsertEnvValues } from "../scripts/lib/env-values.mjs";

test("两个账号使用独立密码，未配置的只读账号无法登录", async () => {
  const adminPassword = randomBytes(18).toString("hex");
  const viewerPassword = randomBytes(18).toString("hex");
  const credentials = { ADMIN_PASSWORD_HASH: await hashPassword(adminPassword), VIEWER_PASSWORD_HASH: await hashPassword(viewerPassword) };
  assert.deepEqual(await authenticateAccount("admin", adminPassword, credentials), { username: "admin", role: "admin" });
  assert.deepEqual(await authenticateAccount("user", viewerPassword, credentials), { username: "user", role: "viewer" });
  assert.equal(await authenticateAccount("user", adminPassword, credentials), null);
  assert.equal(await authenticateAccount("unknown", adminPassword, credentials), null);
  assert.equal(await authenticateAccount("user", viewerPassword, { ADMIN_PASSWORD_HASH: credentials.ADMIN_PASSWORD_HASH }), null);
});

test("权限从账号配置推导，过期、密码变更和禁用账号使会话失效", async () => {
  const credentials = { VIEWER_PASSWORD_HASH: await hashPassword(randomBytes(18).toString("hex")) };
  const viewer = getAccount("user", credentials)!;
  const session = { username: "user", expiresAt: 2000, credentialVersion: accountVersion(viewer), role: "admin" };
  assert.deepEqual(sessionIdentity(session, credentials, 1000), { username: "user", role: "viewer" });
  assert.equal(sessionIdentity(session, credentials, 2000), null);
  assert.equal(sessionIdentity(session, {}, 1000), null);
  assert.equal(sessionIdentity({ ...session, expiresAt: Infinity }, credentials, 1000), null);
  assert.equal(sessionIdentity({ ...session, username: "admin" }, credentials, 1000), null);
  assert.equal(sessionIdentity(session, { VIEWER_PASSWORD_HASH: await hashPassword(randomBytes(18).toString("hex")) }, 1000), null);
});

test("新增及重置账号只替换目标环境变量，不覆盖其他凭据", () => {
  const initial = "# local settings\nADMIN_PASSWORD_HASH=existing-admin\nSESSION_SECRET=existing-session\nHOME_FEATURES_TOKEN=existing-feature\n";
  const added = upsertEnvValues(initial, { VIEWER_PASSWORD_HASH: "viewer-hash" });
  assert.ok(added.includes(initial));
  assert.ok(added.includes("VIEWER_PASSWORD_HASH=viewer-hash\n"));
  const reset = upsertEnvValues(added, { ADMIN_PASSWORD_HASH: "new-admin", SESSION_SECRET: "new-session" });
  assert.ok(reset.includes("VIEWER_PASSWORD_HASH=viewer-hash\n"));
  assert.ok(reset.includes("HOME_FEATURES_TOKEN=existing-feature\n"));
  assert.equal((upsertEnvValues(added, { VIEWER_PASSWORD_HASH: "new-viewer" }).match(/VIEWER_PASSWORD_HASH=/g) ?? []).length, 1);
});
