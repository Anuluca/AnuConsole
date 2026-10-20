"use client";

import { useId, useMemo, useRef, useState } from "react";
import {
  ANALYTICS_RANGES,
  METRICS,
  METRIC_DESCRIPTIONS,
  PRIMARY_METRICS,
  OVERVIEW_METRICS,
  REPORT_GROUPS,
  formatMetric,
  type AnalyticsRange,
  type RealtimeAnalytics,
  type SiteAnalytics,
} from "@/lib/analytics";
import { useAnalytics } from "./use-analytics";
import { RelativeTime } from "./relative-time";
import { AnalyticsLinks } from "./analytics-links";
import { LoadingIndicator } from "./loading-indicator";
import { ConnectionStatus } from "./connection-status";
import { ReportNotice } from "./analytics/report-notice";
import { ReportTable } from "./analytics/report-table";
import { Trend } from "./analytics/trend";
import { RouteHeaderRefresh } from "./route-header-refresh";

function RetryButton({ onClick }: { onClick: () => void }) {
  return (
    <button className="monitor-retry" type="button" onClick={onClick}>
      <svg
        width="14"
        height="14"
        viewBox="0 0 16 16"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M13.5 7A5.5 5.5 0 1 0 13 10M13.5 3.5V7H10" />
      </svg>
      重试
    </button>
  );
}

function OverviewMetric({ name, value }: { name: string; value?: number }) {
  const tooltipId = useId();
  return (
    <div
      className="monitor-metric"
      data-metric={name}
      tabIndex={0}
      aria-describedby={tooltipId}
    >
      <span>{METRICS[name]}</span>
      <strong>{formatMetric(name, value)}</strong>
      <span id={tooltipId} role="tooltip" className="monitor-metric-tooltip">
        {METRIC_DESCRIPTIONS[name]}
      </span>
    </div>
  );
}

export function MonitorDashboard({
  overviewOnly = false,
  refreshToken = 0,
}: {
  overviewOnly?: boolean;
  refreshToken?: number;
}) {
  const [days, setDays] = useState<AnalyticsRange>(1);
  const [moreOpen, setMoreOpen] = useState(false);
  const activityRow = useRef<HTMLDivElement>(null);
  const [expandedHeight, setExpandedHeight] = useState<number>();
  function toggleOverview() {
    // 展开时保持整行原有高度，避免右侧卡片隐藏后影响后续内容位置。
    if (!moreOpen)
      setExpandedHeight(activityRow.current?.getBoundingClientRect().height);
    setMoreOpen((open) => !open);
  }
  const [refresh, setRefresh] = useState(0);
  const [group, setGroup] = useState(0);
  const summary = useAnalytics<SiteAnalytics>(
    `/api/analytics/summary?days=${days}`,
    600000,
    refresh + refreshToken,
  );
  const realtime = useAnalytics<RealtimeAnalytics>(
    "/api/analytics/realtime",
    60000,
    refresh + refreshToken,
  );
  const data = summary.data;
  const reports = useMemo(
    () => new Map(data?.reports.map((report) => [report.id, report])),
    [data],
  );
  const liveReports = useMemo(
    () => new Map(realtime.data?.reports.map((report) => [report.id, report])),
    [realtime.data],
  );
  const metrics = useMemo(
    () =>
      Object.assign(
        {},
        ...["overview", "engagement"].map((id) => {
          const report = reports.get(id);
          return report?.status === "ready"
            ? report.rows[0]?.metrics
            : undefined;
        }),
      ) as Record<string, number>,
    [reports],
  );
  const metricCard = (key: string) => (
    <OverviewMetric key={key} name={key} value={metrics[key]} />
  );
  return (
    <section
      className={`monitor-dashboard${overviewOnly ? " home-analytics" : ""}`}
      aria-label={overviewOnly ? "浏览量概览" : "监视器内容区"}
    >
      {!overviewOnly && (
        <ConnectionStatus
          service="GA4"
          connected={
            !!(data || realtime.data) && !summary.error && !realtime.error
          }
        />
      )}
      {!overviewOnly && <RouteHeaderRefresh onRefresh={() => setRefresh((value) => value + 1)} />}
      {!overviewOnly && (
        <div className="monitor-meta">
          <div className="monitor-meta-actions">
            <div
              className="monitor-options"
              role="group"
              aria-label="统计时间范围"
            >
              {ANALYTICS_RANGES.map((range) => (
                <button
                  type="button"
                  key={range}
                  aria-pressed={days === range}
                  onClick={() => setDays(range)}
                >
                  {range === 1 ? "今天" : `近 ${range} 天`}
                </button>
              ))}
            </div>
          </div>
          {summary.error ? (
            <div
              className="monitor-summary-error"
              role="alert"
              title={`${summary.error}${data ? " 当前保留上次结果。" : ""}`}
            >
              <span>
                {summary.error.includes("尚未配置") ? "尚未配置" : "读取失败"}
                {data && (
                  <span className="monitor-stale-note">（保留上次结果）</span>
                )}
              </span>
              <RetryButton onClick={() => setRefresh((value) => value + 1)} />
            </div>
          ) : summary.loading ? (
            <LoadingIndicator compact label="正在读取统计" />
          ) : (
            <div className="monitor-updated">
              <span>更新于 <RelativeTime value={data?.generatedAt} /></span>
            </div>
          )}
        </div>
      )}
      {!overviewOnly &&
        !!data?.reports.length &&
        data.reports.every((report) => report.status === "unavailable") && (
          <p className="monitor-note">所有报表暂不可用，请稍后重试。</p>
        )}
      <div
        ref={activityRow}
        className={
          overviewOnly
            ? "home-analytics-grid"
            : `monitor-activity-row${moreOpen ? " monitor-activity-expanded" : ""}`
        }
        style={{
          minHeight: !overviewOnly && moreOpen ? expandedHeight : undefined,
        }}
      >
        <section
          className="monitor-card monitor-overview"
          aria-label="概览"
          aria-busy={summary.loading}
        >
          <header>
            <h2>概览</h2>
            {overviewOnly && summary.error && (
              <div className="monitor-summary-error" role="alert">
                <span>读取失败</span>
                <RetryButton onClick={() => setRefresh((value) => value + 1)} />
              </div>
            )}
          </header>
          <div className="monitor-default-row">
            <div className="monitor-metrics">
              {PRIMARY_METRICS.map(metricCard)}
            </div>
            {!overviewOnly && (
              <button
                type="button"
                className="monitor-more-toggle"
                aria-expanded={moreOpen}
                aria-controls="monitor-more-metrics"
                onClick={toggleOverview}
              >
                更多指标
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 16 16"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  aria-hidden="true"
                >
                  <path d="m6 4 4 4-4 4" />
                </svg>
              </button>
            )}
          </div>
          {!overviewOnly && moreOpen && (
            <div className="monitor-more" id="monitor-more-metrics">
              <div className="monitor-metrics">
                {OVERVIEW_METRICS.filter(
                  (key) => !PRIMARY_METRICS.includes(key),
                ).map(metricCard)}
              </div>
            </div>
          )}
          {["overview", "engagement"].map((id) => (
            <ReportNotice key={id} report={reports.get(id)} />
          ))}
          {data &&
            ["overview", "engagement"].some(
              (id) => reports.get(id)?.status !== "ready",
            ) && <p className="monitor-note">部分汇总指标暂不可用。</p>}
        </section>
        <div
          className={overviewOnly ? "home-live-panel" : "monitor-live-panel"}
        >
          <section
            className="monitor-card monitor-live"
            aria-label="实时统计"
            aria-busy={realtime.loading}
          >
            <header>
              <h2>实时活跃用户</h2>
              {!overviewOnly && <p>近 30 分钟 · 每分钟自动读取</p>}
            </header>
            <div className="monitor-live-content">
              <strong>
                {formatMetric("activeUsers", realtime.data?.activeUsers)}
              </strong>
              {!overviewOnly && (
                <p>
                  更新于 <RelativeTime value={realtime.data?.generatedAt} />
                </p>
              )}
            </div>
            {realtime.error && (
              <p className="monitor-error" role="alert">
                实时统计：{realtime.error}
                {realtime.data ? " 当前保留上次结果。" : ""}
                <RetryButton onClick={() => setRefresh((value) => value + 1)} />
              </p>
            )}
          </section>
          {!overviewOnly && (
            <>
              <ReportTable
                className="monitor-live-countries"
                id="realtimeCountries"
                report={liveReports.get("realtimeCountries")}
                loading={realtime.loading}
              />
              <ReportTable
                className="monitor-live-events"
                id="realtimeEvents"
                report={liveReports.get("realtimeEvents")}
                loading={realtime.loading}
              />
            </>
          )}
        </div>
        {!overviewOnly && (
          <Trend report={reports.get("trend")} loading={summary.loading} />
        )}
      </div>
      {overviewOnly && (
        <Trend report={reports.get("trend")} loading={summary.loading} />
      )}
      {!overviewOnly && (
        <>
          <section className="monitor-details" aria-label="分类报表">
            <div className="monitor-section-heading">
              <h2>分类报表</h2>
              <div
                className="monitor-options monitor-groups"
                role="group"
                aria-label="报表分类"
              >
                {REPORT_GROUPS.map((item, i) => (
                  <button
                    key={item.title}
                    type="button"
                    aria-pressed={group === i}
                    onClick={() => setGroup(i)}
                  >
                    {item.title}
                  </button>
                ))}
              </div>
            </div>
            <div
              className={`monitor-reports${["来源", "地域", "行为", "作品与工具"].includes(REPORT_GROUPS[group].title) ? " monitor-reports-three" : ""}${REPORT_GROUPS[group].title === "地域" ? " monitor-reports-region" : ""}${REPORT_GROUPS[group].title === "设备" ? " monitor-reports-devices" : ""}`}
            >
              {REPORT_GROUPS[group].ids.map((id) => (
                <ReportTable
                  key={id}
                  id={id}
                  report={reports.get(id)}
                  loading={summary.loading}
                />
              ))}
            </div>
          </section>
          <AnalyticsLinks />
        </>
      )}
    </section>
  );
}
