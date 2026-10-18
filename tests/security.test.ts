import { test } from "node:test";
import assert from "node:assert/strict";
import { hashPassword, verifyPassword, LoginLimiter } from "../src/lib/security.ts";

test("密码使用独立随机盐，正确密码通过，错误密码被拒绝", async () => {
  const password = "test-only-secret-123";
  const first = await hashPassword(password);
  assert.notEqual(first, await hashPassword(password));
  assert.equal(await verifyPassword(password, first), true);
  assert.equal(await verifyPassword("wrong", first), false);
  assert.equal(await verifyPassword(password, "scrypt:invalid:hash"), false);
  assert.equal(await verifyPassword("a".repeat(257), first), false);
});

test("达到登录尝试上限后阻止请求，窗口到期恢复", () => {
  const limiter = new LoginLimiter(2, 60_000);
  assert.equal(limiter.consume(100), true);
  assert.equal(limiter.consume(200), true);
  assert.equal(limiter.consume(300), false);
  assert.equal(limiter.consume(60_099), false);
  assert.equal(limiter.consume(60_100), true);
});
