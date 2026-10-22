"use client";

import { memo, useId, useMemo, useState } from "react";
import {
  METRICS,
  formatMetric,
  rowLabel,
  type AnalyticsReport,
} from "@/lib/analytics";
import { buildTrend } from "@/lib/analytics-trend";
import { LoadingIndicator } from "../loading-indicator";
import { ReportNotice } from "./report-notice";

export const Trend = memo(function Trend({
  report,
  loading,
}: {
  report?: AnalyticsReport;
  loading: boolean;
}) {
  const [metric, setMetric] = useState("screenPageViews");
  const [activePoint, setActivePoint] = useState<number | null>(null);
  const id = useId();
  const rows = report?.rows ?? [];
  const { max, points, path } = useMemo(
    () => buildTrend(report?.rows ?? [], metric),
    [report, metric],
  );
  // 日期刻度复用数据点的横坐标；单日只显示中央刻度，避免左右重复同一天。
  const dateTicks = points.length <= 1 ? points : [points[0], points[points.length - 1]];
  const y = (value: number) => 210 - (value / max) * 180;
  const selected = activePoint === null ? undefined : points[activePoint];
  return (
    <section className="monitor-card monitor-trend" aria-label="每日趋势">
      <header>
        <h2>每日趋势</h2>
        <div className="monitor-options" role="group" aria-label="趋势指标">
          {["screenPageViews", "activeUsers", "sessions"].map((key) => (
            <button
              key={key}
              type="button"
              aria-pressed={metric === key}
              onClick={() => setMetric(key)}
            >
              {METRICS[key]}
            </button>
          ))}
        </div>
      </header>
      {!report ? (
        loading ? (
          <LoadingIndicator
            className="monitor-chart-empty"
            label="正在读取趋势"
          />
        ) : (
          <p className="monitor-empty monitor-chart-empty">趋势暂不可用</p>
        )
      ) : report.status === "unavailable" ? (
        <p className="monitor-empty monitor-chart-empty">趋势暂不可用</p>
      ) : !rows.length ? (
        <p className="monitor-empty monitor-chart-empty">
          所选时间范围暂无趋势数据
        </p>
      ) : (
        <>
          <svg
            className="monitor-chart"
            viewBox="0 0 800 250"
            role="group"
            aria-labelledby={id}
            onPointerLeave={() => setActivePoint(null)}
          >
            <title id={id}>
              {METRICS[metric]}每日趋势，共 {rows.length} 天
            </title>
            {[0, 0.5, 1].map((ratio) => (
              <g key={ratio}>
                <line
                  x1="30"
                  y1={y(max * ratio)}
                  x2="770"
                  y2={y(max * ratio)}
                  className="monitor-chart-grid"
                />
                <text x="30" y={y(max * ratio) - 7}>
                  {formatMetric(metric, max * ratio)}
                </text>
              </g>
            ))}
            <polyline points={path} className="monitor-chart-line" />
            {points.map((point, i) => (
              <g key={i}>
                <circle
                  cx={point.x}
                  cy={point.y}
                  r={activePoint === i ? 5 : 3}
                  className="monitor-chart-point"
                />
                <text
                  className="monitor-chart-value"
                  x={point.x}
                  y={point.y + (point.y < 50 ? 20 : -12)}
                  textAnchor="middle"
                  aria-hidden="true"
                >
                  {point.value}
                </text>
                <circle
                  cx={point.x}
                  cy={point.y}
                  r="12"
                  className="monitor-chart-hit"
                  tabIndex={0}
                  role="button"
                  aria-label={`${point.label}，${METRICS[metric]} ${point.value}`}
                  aria-describedby={
                    activePoint === i ? `${id}-tooltip` : undefined
                  }
                  onPointerEnter={() => setActivePoint(i)}
                  onPointerLeave={() => setActivePoint(null)}
                  onFocus={() => setActivePoint(i)}
                  onBlur={() => setActivePoint(null)}
                  onClick={() => setActivePoint(i)}
                  onKeyDown={(event) => {
                    if (event.key === "Escape") setActivePoint(null);
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      setActivePoint(i);
                    }
                  }}
                />
              </g>
            ))}
            {selected && activePoint !== null && (
              <g
                id={`${id}-tooltip`}
                role="tooltip"
                className="monitor-chart-tooltip"
                transform={`translate(${Math.max(8, Math.min(572, selected.x - 110))},${selected.y > 75 ? selected.y - 66 : selected.y + 16})`}
              >
                <rect width="220" height="54" />
                <text x="12" y="20">
                  {selected.label}
                </text>
                <text x="12" y="41">
                  {METRICS[metric]}：{selected.value}
                </text>
              </g>
            )}
            {dateTicks.map((point, index) => (
              <text key={index} className="monitor-chart-date" x={point.x} y="242"
                textAnchor={dateTicks.length === 1 ? "middle" : index === 0 ? "start" : "end"}>
                {point.label}
              </text>
            ))}
          </svg>
          <details className="monitor-trend-data">
            <summary>查看每日数据</summary>
            <div
              className="monitor-table-scroll"
              role="region"
              aria-label="每日趋势表格"
              tabIndex={0}
            >
              <table>
                <thead>
                  <tr>
                    <th scope="col">日期</th>
                    <th scope="col">{METRICS[metric]}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, i) => (
                    <tr key={i}>
                      <th scope="row">{rowLabel("trend", row.dimensions)}</th>
                      <td>{formatMetric(metric, row.metrics[metric])}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </>
      )}
      <ReportNotice report={report} />
    </section>
  );
});
