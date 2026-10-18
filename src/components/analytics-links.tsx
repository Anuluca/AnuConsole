import { RelatedLinks } from "./related-links";

// 仅使用官方入口；不拼接媒体资源 ID，登录后由用户选择有权限的资源。
const links = [
  { label: "Google Analytics", href: "https://analytics.google.com/analytics/web/" },
  { label: "跟踪代码管理器（Tag Manager）", href: "https://tagmanager.google.com/" }
];

export function AnalyticsLinks() {
  return <RelatedLinks label="GA4 相关链接" links={links} />;
}
