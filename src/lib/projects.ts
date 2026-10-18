export type ProjectId = "anutrium" | "drrr";
export type RouteKey = "home" | "monitor" | "ga4" | "features" | "data" | "about";

export type RouteItem = {
  key: RouteKey;
  label: string;
  href: string;
  children?: RouteItem[];
};

type Project = {
  id: ProjectId;
  title: string;
  accent: string;
  onAccent: string;
  siteUrl?: string;
  routes: readonly RouteItem[];
};

// 每个项目只配置自己的业务菜单；首页和关于页按项目生成独立地址。
const shared = (id: ProjectId, key: "home" | "about", label: string): RouteItem => ({
  key, label, href: key === "home" ? `/${id}` : `/${id}/about`
});

export const projects: readonly Project[] = [
  {
    id: "anutrium", title: "Anutrium", accent: "#E23456", onAccent: "#fff", siteUrl: "https://anuluca.com",
    routes: [
      shared("anutrium", "home", "首页"),
      { key: "monitor", label: "监视器", href: "/anutrium/monitor", children: [
        { key: "ga4", label: "GA4浏览量", href: "/anutrium/monitor/ga4" }
      ] },
      { key: "features", label: "功能调整", href: "/anutrium/features" },
      { key: "data", label: "数据维护", href: "/anutrium/data" },
      shared("anutrium", "about", "关于")
    ]
  },
  {
    id: "drrr", title: "DRRR情报屋", accent: "#f4f500", onAccent: "#17191b",
    routes: [shared("drrr", "home", "首页"), shared("drrr", "about", "关于")]
  }
];

export function getProject(id: string | undefined): Project | undefined {
  return projects.find(project => project.id === id);
}

export function projectFromPath(pathname: string): Project {
  return getProject(pathname.split("/")[1]) ?? projects[0];
}
