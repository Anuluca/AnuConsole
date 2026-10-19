import { EmptyPage } from "@/components/empty-page";
import { HomeFeaturesPanel } from "@/components/home-features";
import { MonitorDashboard } from "@/components/monitor-dashboard";
import { requireUser } from "@/lib/auth";

export const metadata = { title: "首页" };
export default async function HomePage({ params }: { params: Promise<{ project: string }> }) {
  const user = await requireUser();
  if ((await params).project !== "anutrium") return <EmptyPage label="首页" />;
  // 首页复用监视器读取与功能开关，避免产生独立的数据口径或绕过只读权限。
  return <section className="project-home" aria-label="首页内容区">
    <section className="home-module" aria-labelledby="home-analytics-title">
      <h2 id="home-analytics-title" className="home-module-title">浏览量</h2>
      <MonitorDashboard overviewOnly />
    </section>
    <section className="home-module" aria-labelledby="home-settings-title">
      <h2 id="home-settings-title" className="home-module-title">功能调整</h2>
      <HomeFeaturesPanel canEdit={user.role === "admin"} embedded />
    </section>
  </section>;
}
