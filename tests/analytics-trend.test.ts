import { test } from "node:test";
import assert from "node:assert/strict";
import { buildTrend } from "../src/lib/analytics-trend.ts";

test("趋势计算保留空值、单点居中和零值语义", () => {
  assert.deepEqual(buildTrend([], "sessions"), {
    max: 1,
    points: [],
    path: "",
  });
  const { points } = buildTrend(
    [{ dimensions: ["20261019"], metrics: { sessions: 0 } }],
    "sessions",
  );
  assert.deepEqual(points, [
    { x: 400, y: 210, value: "0", label: "2026-10-19" },
  ]);
  assert.equal(
    buildTrend([{ dimensions: [], metrics: {} }], "sessions").points[0].value,
    "—",
  );
});

test("趋势坐标保持原有范围，大报表不展开函数参数", () => {
  const rows = Array.from({ length: 150000 }, (_, index) => ({
    dimensions: ["20261019"],
    metrics: { sessions: index },
  }));
  const chart = buildTrend(rows, "sessions");
  assert.equal(chart.max, 149999);
  assert.equal(chart.points[0].x, 30);
  assert.equal(chart.points.at(-1)!.x, 770);
  assert.equal(chart.points.at(-1)!.y, 30);
});
