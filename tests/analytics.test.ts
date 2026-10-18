import { test } from "node:test";
import assert from "node:assert/strict";
import { ANALYTICS_RANGES, formatMetric, isAnalyticsPayload, rowLabel } from "../src/lib/analytics.ts";

const report = { id: "overview", status: "ready", rows: [{ dimensions: [], metrics: { activeUsers: 0 } }], rowCount: 1, thresholded: false, sampled: false, dataLoss: false };
const summary = { days: 30, generatedAt: "2026-10-17T01:00:00Z", timeZone: "Asia/Shanghai", reports: [report] };

test("统计契约接受真实零值、空数据及部分失败", () => {
  assert.equal(ANALYTICS_RANGES.includes(1), true);
  assert.equal(isAnalyticsPayload({ ...summary, days: 1 }, "summary", 1), true);
  assert.equal(isAnalyticsPayload(summary, "summary", 30), true);
  assert.equal(isAnalyticsPayload({ ...summary, reports: [{ ...report, status: "unavailable", rows: [] }] }, "summary", 30), true);
  assert.equal(isAnalyticsPayload({ generatedAt: summary.generatedAt, activeUsers: 0, reports: [] }, "realtime"), true);
  assert.equal(isAnalyticsPayload({ generatedAt: summary.generatedAt, activeUsers: null, reports: [] }, "realtime"), true);
});

test("拒绝范围不符、损坏的报表及非有限指标", () => {
  for (const value of [null, {}, { ...summary, days: 7 }, { ...summary, generatedAt: "invalid" },
    { ...summary, reports: [report, report] },
    { ...summary, reports: [{ ...report, rows: [{ dimensions: [], metrics: { activeUsers: Infinity } }] }] },
    { ...summary, reports: [{ ...report, rowCount: -1 }] },
    { ...summary, reports: [{ ...report, rows: [{ dimensions: [9], metrics: {} }] }] }]) {
    assert.equal(isAnalyticsPayload(value, "summary", 30), false);
  }
  for (const activeUsers of [undefined, -1, Infinity, "0"]) {
    assert.equal(isAnalyticsPayload({ generatedAt: summary.generatedAt, activeUsers, reports: [] }, "realtime"), false);
  }
});

test("缺失值不伪造零值，百分比和时间按中文格式展示", () => {
  assert.equal(formatMetric("activeUsers", undefined), "—");
  assert.equal(formatMetric("activeUsers", null), "—");
  assert.equal(formatMetric("activeUsers", 0), "0");
  assert.equal(formatMetric("engagementRate", .625), "62.5%");
  assert.equal(formatMetric("averageSessionDuration", 125), "2分5秒");
  assert.equal(rowLabel("devices", ["mobile"]), "手机");
  assert.equal(rowLabel("events", ["page_view"]), "页面浏览");
  assert.equal(rowLabel("trend", ["20261017"]), "2026-10-17");
  assert.equal(rowLabel("weekdays", ["6"]), "周六");
});
