"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  ANALYTICS_RANGES, METRICS, METRIC_DESCRIPTIONS, PRIMARY_METRICS, OVERVIEW_METRICS, REPORT_GROUPS, REPORTS, formatMetric, rowLabel,
  type AnalyticsRange, type AnalyticsReport, type RealtimeAnalytics, type SiteAnalytics,
} from "@/lib/analytics";
import { useAnalytics } from "./use-analytics";
import { RelativeTime } from "./relative-time";
import { AnalyticsLinks } from "./analytics-links";

function RetryButton({ onClick }: { onClick: () => void }) {
  return <button className="monitor-retry" type="button" onClick={onClick}>
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M13.5 7A5.5 5.5 0 1 0 13 10M13.5 3.5V7H10" /></svg>重试
  </button>;
}

function OverviewMetric({ name, value }: { name: string; value?: number }) {
  const tooltipId = useId();
  return <div className="monitor-metric" data-metric={name} tabIndex={0} aria-describedby={tooltipId}>
    <span>{METRICS[name]}</span>
    <strong>{formatMetric(name, value)}</strong>
    <span id={tooltipId} role="tooltip" className="monitor-metric-tooltip">{METRIC_DESCRIPTIONS[name]}</span>
  </div>;
}

function ReportNotice({ report }: { report?: AnalyticsReport }) {
  if (!report) return null;
  const notes = [report.thresholded && "受隐私阈值限制", report.sampled && "包含抽样数据", report.dataLoss && "存在高基数汇总"].filter(Boolean);
  return notes.length ? <p className="monitor-note">{notes.join(" · ")}</p> : null;
}

function ReportTable({ id, report, loading, className = "" }: { id: string; report?: AnalyticsReport; loading: boolean; className?: string }) {
  const definition = REPORTS[id];
  const columns = Array.from(new Set(report?.rows.flatMap(row => Object.keys(row.metrics)) ?? []));
  return <section className={`monitor-card monitor-report ${className}`} aria-label={definition.title}>
    <header><h3>{definition.title}</h3>{!!report?.rows.length && <span>{report.rowCount > report.rows.length ? `前 ${report.rows.length} 项 / 共 ${report.rowCount} 项` : `${report.rows.length} 项`}</span>}</header>
    {!report ? <p className="monitor-empty">{loading ? "正在读取…" : "报表暂不可用"}</p>
      : report.status === "unavailable" ? <p className="monitor-empty">报表暂不可用</p>
      : !report.rows.length ? <p className="monitor-empty">暂无数据</p>
      : <div className="monitor-table-scroll" role="region" aria-label={`${definition.title}表格`} tabIndex={0}><table>
        <thead><tr><th scope="col">{definition.dimension}</th>{columns.map(key => <th scope="col" key={key}>{METRICS[key] ?? "统计值"}</th>)}</tr></thead>
        <tbody>{report.rows.map((row, index) => <tr key={index}><th scope="row">{rowLabel(id, row.dimensions)}</th>{columns.map(key => <td key={key}>{formatMetric(key, row.metrics[key])}</td>)}</tr>)}</tbody>
      </table></div>}
    <ReportNotice report={report} />
  </section>;
}

function Trend({ report, loading }: { report?: AnalyticsReport; loading: boolean }) {
  const [metric, setMetric] = useState("screenPageViews");
  const [activePoint, setActivePoint] = useState<number | null>(null);
  const id = useId();
  const rows = report?.rows ?? [];
  const max = Math.max(1, ...rows.map(row => row.metrics[metric] ?? 0));
  const x = (i: number) => rows.length === 1 ? 400 : 30 + (i / (rows.length - 1)) * 740;
  const y = (value: number) => 210 - value / max * 180;
  const selected = activePoint === null ? undefined : rows[activePoint];
  return <section className="monitor-card monitor-trend" aria-label="每日趋势">
    <header><h2>每日趋势</h2><div className="monitor-options" role="group" aria-label="趋势指标">
      {["screenPageViews", "activeUsers", "sessions"].map(key => <button key={key} type="button" aria-pressed={metric === key} onClick={() => setMetric(key)}>{METRICS[key]}</button>)}
    </div></header>
    {!report ? <p className="monitor-empty monitor-chart-empty">{loading ? "正在读取趋势…" : "趋势暂不可用"}</p>
      : report.status === "unavailable" ? <p className="monitor-empty monitor-chart-empty">趋势暂不可用</p>
      : !rows.length ? <p className="monitor-empty monitor-chart-empty">所选时间范围暂无趋势数据</p>
      : <>
        <svg className="monitor-chart" viewBox="0 0 800 250" role="group" aria-labelledby={id} onPointerLeave={() => setActivePoint(null)}>
          <title id={id}>{METRICS[metric]}每日趋势，共 {rows.length} 天</title>
          {[0, .5, 1].map(ratio => <g key={ratio}><line x1="30" y1={y(max * ratio)} x2="770" y2={y(max * ratio)} className="monitor-chart-grid" /><text x="30" y={y(max * ratio) - 7}>{formatMetric(metric, max * ratio)}</text></g>)}
          <polyline points={rows.map((row, i) => `${x(i)},${y(row.metrics[metric] ?? 0)}`).join(" ")} className="monitor-chart-line" />
          {rows.map((row, i) => <g key={i}>
            <circle cx={x(i)} cy={y(row.metrics[metric] ?? 0)} r={activePoint === i ? 5 : 3} className="monitor-chart-point" />
            <text className="monitor-chart-value" x={x(i)} y={y(row.metrics[metric] ?? 0) + (y(row.metrics[metric] ?? 0) < 50 ? 20 : -12)} textAnchor="middle" aria-hidden="true">{formatMetric(metric, row.metrics[metric])}</text>
            <circle cx={x(i)} cy={y(row.metrics[metric] ?? 0)} r="12" className="monitor-chart-hit" tabIndex={0} role="button"
              aria-label={`${rowLabel("trend", row.dimensions)}，${METRICS[metric]} ${formatMetric(metric, row.metrics[metric])}`}
              aria-describedby={activePoint === i ? `${id}-tooltip` : undefined}
              onPointerEnter={() => setActivePoint(i)} onPointerLeave={() => setActivePoint(null)}
              onFocus={() => setActivePoint(i)} onBlur={() => setActivePoint(null)} onClick={() => setActivePoint(i)}
              onKeyDown={event => { if (event.key === "Escape") setActivePoint(null); if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setActivePoint(i); } }} />
          </g>)}
          {selected && activePoint !== null && <g id={`${id}-tooltip`} role="tooltip" className="monitor-chart-tooltip"
            transform={`translate(${Math.max(8, Math.min(572, x(activePoint) - 110))},${y(selected.metrics[metric] ?? 0) > 75 ? y(selected.metrics[metric] ?? 0) - 66 : y(selected.metrics[metric] ?? 0) + 16})`}>
            <rect width="220" height="54" />
            <text x="12" y="20">{rowLabel("trend", selected.dimensions)}</text>
            <text x="12" y="41">{METRICS[metric]}：{formatMetric(metric, selected.metrics[metric])}</text>
          </g>}
          <text x="30" y="242">{rowLabel("trend", rows[0].dimensions)}</text><text x="770" y="242" textAnchor="end">{rowLabel("trend", rows[rows.length - 1].dimensions)}</text>
        </svg>
        <details className="monitor-trend-data"><summary>查看每日数据</summary><div className="monitor-table-scroll" role="region" aria-label="每日趋势表格" tabIndex={0}><table><thead><tr><th scope="col">日期</th><th scope="col">{METRICS[metric]}</th></tr></thead><tbody>{rows.map((row, i) => <tr key={i}><th scope="row">{rowLabel("trend", row.dimensions)}</th><td>{formatMetric(metric, row.metrics[metric])}</td></tr>)}</tbody></table></div></details>
      </>}
    <ReportNotice report={report} />
  </section>;
}

export function MonitorDashboard() {
  const [statusTarget, setStatusTarget] = useState<HTMLElement | null>(null);
  useEffect(() => { setStatusTarget(document.getElementById("route-heading-status")); }, []);
  const [days, setDays] = useState<AnalyticsRange>(1);
  const [moreOpen, setMoreOpen] = useState(false);
  const activityRow = useRef<HTMLDivElement>(null);
  const [expandedHeight, setExpandedHeight] = useState<number>();
  function toggleOverview() {
    // 展开时保持整行原有高度，避免右侧卡片隐藏后影响后续内容位置。
    if (!moreOpen) setExpandedHeight(activityRow.current?.getBoundingClientRect().height);
    setMoreOpen(open => !open);
  }
  const [refresh, setRefresh] = useState(0);
  const [group, setGroup] = useState(0);
  const summary = useAnalytics<SiteAnalytics>(`/api/analytics/summary?days=${days}`, 600000, refresh);
  const realtime = useAnalytics<RealtimeAnalytics>("/api/analytics/realtime", 60000, refresh);
  const data = summary.data;
  const reports = new Map(data?.reports.map(report => [report.id, report]));
  const liveReports = new Map(realtime.data?.reports.map(report => [report.id, report]));
  const metrics = Object.assign({}, ...["overview", "engagement"].map(id => {
    const report = reports.get(id);
    return report?.status === "ready" ? report.rows[0]?.metrics : undefined;
  })) as Record<string, number>;
  const metricCard = (key: string) => <OverviewMetric key={key} name={key} value={metrics[key]} />;
  return <section className="monitor-dashboard" aria-label="监视器内容区">
    {statusTarget && (data || realtime.data) && !summary.error && !realtime.error && createPortal(<span className="monitor-connection" role="status"><svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m3 8 3 3 7-7" /></svg>已链接GA4</span>, statusTarget)}
    <div className="monitor-meta">
      <div className="monitor-meta-actions">
        <div className="monitor-options" role="group" aria-label="统计时间范围">
          {ANALYTICS_RANGES.map(range => <button type="button" key={range} aria-pressed={days === range} onClick={() => setDays(range)}>{range === 1 ? "今天" : `近 ${range} 天`}</button>)}
        </div>
      </div>
      {summary.error ? <div className="monitor-summary-error" role="alert" title={`${summary.error}${data ? " 当前保留上次结果。" : ""}`}>
        <span>{summary.error.includes("尚未配置") ? "尚未配置" : "读取失败"}{data && <span className="monitor-stale-note">（保留上次结果）</span>}</span>
        <RetryButton onClick={() => setRefresh(value => value + 1)} />
      </div> : <span>{summary.loading ? "正在读取统计…" : <>更新于 <RelativeTime value={data?.generatedAt} /></>}</span>}
    </div>
    {!!data?.reports.length && data.reports.every(report => report.status === "unavailable") && <p className="monitor-note">所有报表暂不可用，请稍后重试。</p>}
    <div ref={activityRow} className={`monitor-activity-row${moreOpen ? " monitor-activity-expanded" : ""}`} style={{ minHeight: moreOpen ? expandedHeight : undefined }}>
    <section className="monitor-card monitor-overview" aria-label="概览" aria-busy={summary.loading}>
      <header><h2>概览</h2></header>
      <div className="monitor-default-row">
        <div className="monitor-metrics">{PRIMARY_METRICS.map(metricCard)}</div>
        <button type="button" className="monitor-more-toggle" aria-expanded={moreOpen} aria-controls="monitor-more-metrics" onClick={toggleOverview}>
          更多指标<svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="m6 4 4 4-4 4" /></svg>
        </button>
      </div>
      {moreOpen && <div className="monitor-more" id="monitor-more-metrics"><div className="monitor-metrics">{OVERVIEW_METRICS.filter(key => !PRIMARY_METRICS.includes(key)).map(metricCard)}</div></div>}
      {["overview", "engagement"].map(id => <ReportNotice key={id} report={reports.get(id)} />)}
      {data && ["overview", "engagement"].some(id => reports.get(id)?.status !== "ready") && <p className="monitor-note">部分汇总指标暂不可用。</p>}
    </section>
      <div className="monitor-live-panel">
      <section className="monitor-card monitor-live" aria-label="实时统计" aria-busy={realtime.loading}>
        <header><h2>实时活跃用户</h2><p>近 30 分钟 · 每分钟自动读取</p></header>
        <div className="monitor-live-content">
          <strong>{formatMetric("activeUsers", realtime.data?.activeUsers)}</strong>
          <p>更新于 <RelativeTime value={realtime.data?.generatedAt} /></p>
        </div>
        {realtime.error && <p className="monitor-error" role="alert">实时统计：{realtime.error}{realtime.data ? " 当前保留上次结果。" : ""}<RetryButton onClick={() => setRefresh(value => value + 1)} /></p>}
      </section>
      <ReportTable className="monitor-live-countries" id="realtimeCountries" report={liveReports.get("realtimeCountries")} loading={realtime.loading} />
      <ReportTable className="monitor-live-events" id="realtimeEvents" report={liveReports.get("realtimeEvents")} loading={realtime.loading} />
      </div>
      <Trend report={reports.get("trend")} loading={summary.loading} />
    </div>
    <section className="monitor-details" aria-label="分类报表">
      <div className="monitor-section-heading"><h2>分类报表</h2><div className="monitor-options monitor-groups" role="group" aria-label="报表分类">{REPORT_GROUPS.map((item, i) => <button key={item.title} type="button" aria-pressed={group === i} onClick={() => setGroup(i)}>{item.title}</button>)}</div></div>
      <div className={`monitor-reports${["来源", "地域", "行为", "作品与工具"].includes(REPORT_GROUPS[group].title) ? " monitor-reports-three" : ""}${REPORT_GROUPS[group].title === "地域" ? " monitor-reports-region" : ""}${REPORT_GROUPS[group].title === "设备" ? " monitor-reports-devices" : ""}`}>{REPORT_GROUPS[group].ids.map(id => <ReportTable key={id} id={id} report={reports.get(id)} loading={summary.loading} />)}</div>
    </section>
    <AnalyticsLinks />
  </section>;
}
