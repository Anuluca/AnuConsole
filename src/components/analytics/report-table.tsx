"use client";

import { memo, useMemo } from "react";
import {
  METRICS,
  REPORTS,
  formatMetric,
  rowLabel,
  type AnalyticsReport,
} from "@/lib/analytics";
import { LoadingIndicator } from "../loading-indicator";
import { ReportNotice } from "./report-notice";

export const ReportTable = memo(function ReportTable({
  id,
  report,
  loading,
  className = "",
}: {
  id: string;
  report?: AnalyticsReport;
  loading: boolean;
  className?: string;
}) {
  const definition = REPORTS[id];
  const columns = useMemo(
    () =>
      Array.from(
        new Set(report?.rows.flatMap((row) => Object.keys(row.metrics)) ?? []),
      ),
    [report],
  );
  return (
    <section
      className={`monitor-card monitor-report ${className}`}
      aria-label={definition.title}
    >
      <header>
        <h3>{definition.title}</h3>
        {!!report?.rows.length && (
          <span>
            {report.rowCount > report.rows.length
              ? `前 ${report.rows.length} 项 / 共 ${report.rowCount} 项`
              : `${report.rows.length} 项`}
          </span>
        )}
      </header>
      {!report ? (
        loading ? (
          <LoadingIndicator label={`正在读取${definition.title}`} />
        ) : (
          <p className="monitor-empty">报表暂不可用</p>
        )
      ) : report.status === "unavailable" ? (
        <p className="monitor-empty">报表暂不可用</p>
      ) : !report.rows.length ? (
        <p className="monitor-empty">暂无数据</p>
      ) : (
        <div
          className="monitor-table-scroll"
          role="region"
          aria-label={`${definition.title}表格`}
          tabIndex={0}
        >
          <table>
            <thead>
              <tr>
                <th scope="col">{definition.dimension}</th>
                {columns.map((key) => (
                  <th scope="col" key={key}>
                    {METRICS[key] ?? "统计值"}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {report.rows.map((row, index) => (
                <tr key={index}>
                  <th scope="row">{rowLabel(id, row.dimensions)}</th>
                  {columns.map((key) => (
                    <td key={key}>{formatMetric(key, row.metrics[key])}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <ReportNotice report={report} />
    </section>
  );
});
