import type { AnalyticsReport } from "@/lib/analytics";

export function ReportNotice({ report }: { report?: AnalyticsReport }) {
  if (!report) return null;
  const notes = [
    report.thresholded && "受隐私阈值限制",
    report.sampled && "包含抽样数据",
    report.dataLoss && "存在高基数汇总",
  ].filter(Boolean);
  return notes.length ? (
    <p className="monitor-note">{notes.join(" · ")}</p>
  ) : null;
}
