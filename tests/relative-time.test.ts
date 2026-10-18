import { test } from "node:test";
import assert from "node:assert/strict";
import { formatRelativeTime } from "../src/lib/relative-time.ts";

const now = Date.parse("2026-10-17T01:00:00Z");
const ago = (seconds: number) => new Date(now - seconds * 1000).toISOString();

test("使用 Day.js 默认阈值显示中文相对时间", () => {
  for (const [seconds, expected] of [
    [0, "0 秒前"], [1, "1 秒前"], [20, "20 秒前"], [44, "44 秒前"], [45, "1 分钟前"], [300, "5 分钟前"],
    [2700, "1 小时前"], [7200, "2 小时前"], [22 * 3600, "1 天前"],
    [3 * 86400, "3 天前"], [30 * 86400, "1 个月前"], [365 * 86400, "1 年前"],
  ] as const) assert.equal(formatRelativeTime(ago(seconds), now), expected);
});

test("缺失或无效日期不显示错误时间", () => {
  assert.equal(formatRelativeTime(undefined, now), "—");
  assert.equal(formatRelativeTime("invalid", now), "—");
  assert.equal(formatRelativeTime(ago(300), NaN), "—");
});
