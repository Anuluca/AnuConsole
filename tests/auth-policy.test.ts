import { test } from "node:test";
import assert from "node:assert/strict";
import { developmentAuthBypass } from "../src/lib/auth-policy.ts";

test("只允许 development 免登录，其他环境保持校验", () => {
  assert.equal(developmentAuthBypass("development"), true);
  for (const environment of ["production", "test", "", "Development"]) {
    assert.equal(developmentAuthBypass(environment), false);
  }
});
