export type ProjectId = "anutrium" | "drrr";
export type RouteKey = "home" | "monitor" | "ga4" | "features" | "data" | "infrastructure" | "dns" | "netlify" | "about";

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
  // 可选的主题覆盖；未提供的主题或前景色沿用 accent / onAccent。
  themeColors?: Partial<Record<"light" | "dark", { accent: string; onAccent?: string }>>;
  logoSrc: string;
  siteUrl?: string;
  routes: readonly RouteItem[];
};

// 每个项目只配置自己的业务菜单；首页和关于页按项目生成独立地址。
const shared = (id: ProjectId, key: "home" | "about", label: string): RouteItem => ({
  key, label, href: key === "home" ? `/${id}` : `/${id}/about`
});

const projectDefinitions: readonly Project[] = [
  {
    id: "anutrium", title: "Anutrium", accent: "#E23456", onAccent: "#fff", logoSrc: "/anutrium-logo.png", siteUrl: "https://anuluca.com",
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
    id: "drrr", title: "DRRR情报屋", accent: "#f4f500", onAccent: "#17191b", logoSrc: "/drrr-logo.svg", siteUrl: "https://drrr.anuluca.com",
    themeColors: { light: { accent: "#686900", onAccent: "#fff" } },
    routes: [shared("drrr", "home", "首页"), shared("drrr", "about", "关于")]
  }
];

// 运维是全项目共用能力，统一插入关于页之前；后续新增项目也自动获得自己的运维地址。
export const projects: readonly Project[] = projectDefinitions.map(project => {
  const routes = [...project.routes];
  const aboutIndex = routes.findIndex(route => route.key === "about");
  routes.splice(aboutIndex < 0 ? routes.length : aboutIndex, 0, {
    key: "infrastructure", label: "网站运维", href: `/${project.id}/infrastructure`, children: [
      { key: "dns", label: "域名解析", href: `/${project.id}/infrastructure/dns` },
      { key: "netlify", label: "部署管理", href: `/${project.id}/infrastructure/netlify` }
    ]
  });
  return { ...project, routes };
});

export function getProject(id: string | undefined): Project | undefined {
  return projects.find(project => project.id === id);
}

export function projectFromPath(pathname: string): Project {
  return getProject(pathname.split("/")[1]) ?? projects[0];
}
