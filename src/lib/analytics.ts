export const ANALYTICS_RANGES = [7, 30, 90] as const;
export type AnalyticsRange = typeof ANALYTICS_RANGES[number];
export type AnalyticsKind = "summary" | "realtime";

export interface AnalyticsRow { dimensions: string[]; metrics: Record<string, number> }
export interface AnalyticsReport {
  id: string;
  status: "ready" | "unavailable";
  rows: AnalyticsRow[];
  rowCount: number;
  thresholded: boolean;
  sampled: boolean;
  dataLoss: boolean;
}
export interface SiteAnalytics { days: number; generatedAt: string; timeZone: string; reports: AnalyticsReport[] }
export interface RealtimeAnalytics { generatedAt: string; activeUsers: number | null; reports: AnalyticsReport[] }

export const METRICS: Record<string, string> = {
  activeUsers: "活跃用户", totalUsers: "用户总数", newUsers: "新用户", sessions: "会话数",
  engagedSessions: "互动会话", screenPageViews: "页面浏览量", eventCount: "事件数", keyEvents: "关键事件",
  engagementRate: "互动率", bounceRate: "跳出率", averageSessionDuration: "平均会话时长",
  userEngagementDuration: "总互动时长", screenPageViewsPerSession: "每次会话浏览量", totalRevenue: "总收入",
};
// 指标含义按 Google Analytics Data API 的指标定义说明。
export const METRIC_DESCRIPTIONS: Record<string, string> = {
  activeUsers: "有实际浏览或互动的人数，同一个人只算一次。",
  totalUsers: "来过网站的总人数，新老访客都算，同一个人不重复算。",
  newUsers: "第一次来网站的人有多少。",
  sessions: "网站被访问了多少次，同一个人可以访问多次。",
  engagedSessions: "停留够久、看了多个页面，或完成重要操作的访问次数。",
  screenPageViews: "页面一共被看了多少次，重复查看也算。",
  eventCount: "浏览、点击、滚动等操作，一共发生了多少次。",
  keyEvents: "你在统计后台标记为重要操作的完成次数。",
  engagementRate: "停留够久、有进一步浏览或重要操作的访问，占全部访问的比例。",
  bounceRate: "很快离开，也没有进一步浏览或重要操作的访问比例。",
  averageSessionDuration: "每次访问平均停留了多久。",
  userEngagementDuration: "所有人把网站放在前台浏览的时间，加起来有多久。",
  screenPageViewsPerSession: "每次访问平均看了几个页面。",
  totalRevenue: "购买、订阅和广告赚到的钱，已扣除退款。",
};
export const PRIMARY_METRICS = ["activeUsers", "screenPageViews", "sessions", "userEngagementDuration"];
export const OVERVIEW_METRICS = Object.keys(METRICS).filter(key => !["eventCount", "engagedSessions", "engagementRate"].includes(key));
export const REPORTS: Record<string, { title: string; dimension: string }> = {
  pages: { title: "页面浏览", dimension: "页面" }, landing: { title: "入口页面", dimension: "页面" },
  channels: { title: "访问渠道", dimension: "渠道" }, sources: { title: "来源与媒介", dimension: "来源 / 媒介" },
  firstSources: { title: "首次访问来源", dimension: "来源 / 媒介" }, campaigns: { title: "推广活动", dimension: "活动" },
  countries: { title: "国家与地区", dimension: "国家 / 地区" }, regions: { title: "地区分布", dimension: "地区" },
  cities: { title: "城市分布", dimension: "城市" }, devices: { title: "设备类型", dimension: "设备" },
  browsers: { title: "浏览器", dimension: "浏览器" }, systems: { title: "操作系统", dimension: "系统" },
  languages: { title: "语言", dimension: "语言" }, screens: { title: "屏幕分辨率", dimension: "分辨率" },
  events: { title: "事件统计", dimension: "事件" }, hours: { title: "访问时段", dimension: "时段" },
  weekdays: { title: "星期分布", dimension: "星期" }, projects: { title: "作品点击", dimension: "作品" },
  tools: { title: "工具点击", dimension: "工具" }, shares: { title: "分享方式", dimension: "方式" },
  realtimeCountries: { title: "实时国家与地区", dimension: "国家 / 地区" }, realtimeEvents: { title: "实时事件", dimension: "事件" },
};
export const REPORT_GROUPS = [
  { title: "页面", ids: ["pages", "landing"] },
  { title: "来源", ids: ["channels", "sources", "campaigns"] },
  { title: "地域", ids: ["countries", "regions", "cities"] },
  { title: "设备", ids: ["devices", "browsers", "systems", "languages", "screens"] },
  { title: "行为", ids: ["events", "hours", "weekdays"] },
  { title: "作品与工具", ids: ["projects", "tools", "shares"] },
];

const numbers = new Intl.NumberFormat("zh-CN", { maximumFractionDigits: 2 });
export function formatMetric(key: string, value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  if (key.endsWith("Rate")) return `${(value * 100).toFixed(1)}%`;
  if (key.endsWith("Duration")) {
    const seconds = Math.max(0, Math.round(value));
    return `${Math.floor(seconds / 60)}分${seconds % 60}秒`;
  }
  return numbers.format(value);
}

const dimensionNames: Record<string, string> = {
  "(not set)": "未识别", "(direct)": "直接访问", "(none)": "无", "(not provided)": "未提供",
  desktop: "桌面设备", mobile: "手机", tablet: "平板", smarttv: "智能电视",
  Direct: "直接访问", "Organic Search": "自然搜索", "Organic Social": "自然社交", Referral: "引荐访问",
  "Paid Search": "付费搜索", "Paid Social": "付费社交", "Organic Video": "自然视频", "Organic Shopping": "自然购物",
  Email: "邮件", Display: "展示广告", Unassigned: "未分配", "Cross-network": "跨网络",
  page_view: "页面浏览", session_start: "会话开始", first_visit: "首次访问", user_engagement: "用户互动",
  scroll: "页面滚动", click: "链接点击", project_click: "查看作品", tool_click: "进入工具",
  share: "分享", resume_click: "简历操作", external_link_click: "外链点击", file_download: "文件下载",
};
export function rowLabel(id: string, dimensions: string[]): string {
  if (id === "weekdays") return ["周日", "周一", "周二", "周三", "周四", "周五", "周六"][Number(dimensions[0])] ?? "未识别";
  if (id === "hours") return `${dimensions[0]}:00`;
  if (id === "trend") return dimensions[0]?.replace(/^(\d{4})(\d{2})(\d{2})$/, "$1-$2-$3") || "未识别";
  return dimensions.map(value => dimensionNames[value] ?? value).join(" / ") || "未识别";
}

function record(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null && !Array.isArray(value); }
// 在服务端校验上游契约；字段缺失、非有限数字和格式异常不能被当作零值展示。
export function isAnalyticsPayload(value: unknown, kind: AnalyticsKind, days?: number): value is SiteAnalytics | RealtimeAnalytics {
  if (!record(value) || typeof value.generatedAt !== "string" || !Number.isFinite(Date.parse(value.generatedAt)) || !Array.isArray(value.reports)) return false;
  if (kind === "summary" && (value.days !== days || typeof value.timeZone !== "string")) return false;
  if (kind === "realtime" && value.activeUsers !== null && (typeof value.activeUsers !== "number" || !Number.isFinite(value.activeUsers) || value.activeUsers < 0)) return false;
  const seen = new Set<string>();
  return value.reports.every(report => {
    if (!record(report) || typeof report.id !== "string" || seen.has(report.id)) return false;
    seen.add(report.id);
    return ["ready", "unavailable"].includes(report.status as string) &&
      ["thresholded", "sampled", "dataLoss"].every(key => typeof report[key] === "boolean") &&
      Number.isInteger(report.rowCount) && (report.rowCount as number) >= 0 && Array.isArray(report.rows) &&
      report.rows.every(row => record(row) && Array.isArray(row.dimensions) && row.dimensions.every(v => typeof v === "string") &&
        record(row.metrics) && Object.values(row.metrics).every(v => typeof v === "number" && Number.isFinite(v)));
  });
}
