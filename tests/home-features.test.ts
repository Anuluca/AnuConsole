import assert from "node:assert/strict";
import { test } from "node:test";
import { parseHomeFeatures } from "../src/lib/home-features.ts";

const updatedAt = "2026-10-18T16:02:51.217Z";

test("旧版接口缺少次数时保留真实开关状态，不伪造累计次数", () => {
  for (const lucarioHeadache of [true, false]) {
    assert.deepEqual(parseHomeFeatures({ lucarioHeadache, updatedAt }), {
      lucarioHeadache, headacheCount: null, updatedAt,
    });
  }
});

test("新版接口保留真实次数，代理返回的未知次数可再次解析", () => {
  for (const headacheCount of [0, 10, 17, null]) {
    const config = { lucarioHeadache: true, headacheCount, updatedAt };
    assert.deepEqual(parseHomeFeatures(config), config);
  }
});

test("旧版兼容不放过损坏的开关、日期及计数", () => {
  for (const value of [
    null, {}, { lucarioHeadache: "true", updatedAt },
    { lucarioHeadache: true, updatedAt: "invalid" },
    ...[-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, "10", undefined].map(headacheCount => ({
      lucarioHeadache: true, headacheCount, updatedAt,
    })),
  ]) assert.equal(parseHomeFeatures(value), null);
});
