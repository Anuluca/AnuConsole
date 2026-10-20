import { formatMetric, rowLabel, type AnalyticsRow } from "./analytics.ts";

/** 数据或指标变化时计算一次；鼠标移动只更新选中点，不重复生成整条折线。 */
export function buildTrend(rows: AnalyticsRow[], metric: string) {
  // 不展开数组为函数参数，避免大报表触发参数数量上限。
  const max = rows.reduce(
    (current, row) => Math.max(current, row.metrics[metric] ?? 0),
    1,
  );
  const points = rows.map((row, index) => ({
    x: rows.length === 1 ? 400 : 30 + (index / (rows.length - 1)) * 740,
    y: 210 - ((row.metrics[metric] ?? 0) / max) * 180,
    value: formatMetric(metric, row.metrics[metric]),
    label: rowLabel("trend", row.dimensions),
  }));
  return {
    max,
    points,
    path: points.map((point) => `${point.x},${point.y}`).join(" "),
  };
}
