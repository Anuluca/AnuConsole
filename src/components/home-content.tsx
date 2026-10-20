"use client";

import { useState } from "react";
import { HomeFeaturesPanel } from "./home-features";
import { MonitorDashboard } from "./monitor-dashboard";
import { RouteHeaderRefresh } from "./route-header-refresh";

export function HomeContent({ canEdit }: { canEdit: boolean }) {
  const [refreshToken, setRefreshToken] = useState(0);
  return <>
    <RouteHeaderRefresh onRefresh={() => setRefreshToken((value) => value + 1)} />
    <section className="project-home" aria-label="首页内容区">
      <section className="home-module" aria-labelledby="home-analytics-title">
        <h2 id="home-analytics-title" className="home-module-title">浏览量</h2>
        <MonitorDashboard overviewOnly refreshToken={refreshToken} />
      </section>
      <section className="home-module" aria-labelledby="home-settings-title">
        <h2 id="home-settings-title" className="home-module-title">功能调整</h2>
        <HomeFeaturesPanel canEdit={canEdit} embedded refreshToken={refreshToken} />
      </section>
    </section>
  </>;
}
