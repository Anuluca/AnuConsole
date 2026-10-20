"use client";

import { useState } from "react";
import { FloraLikesPanel } from "./flora-likes";
import { RouteHeaderRefresh } from "./route-header-refresh";

// 页面级刷新代数由所有数据模块共享；新增模块仅需接收 refreshToken 即可纳入刷新。
export function DataContent({ canEdit }: { canEdit: boolean }) {
  const [refreshToken, setRefreshToken] = useState(0);
  return <>
    <RouteHeaderRefresh onRefresh={() => setRefreshToken((value) => value + 1)} />
    <section className="project-home data-workspace" aria-label="数据维护内容区">
      <section className="home-module" aria-labelledby="flora-data-title">
        <h2 id="flora-data-title" className="home-module-title">花花小窝</h2>
        <FloraLikesPanel canEdit={canEdit} refreshToken={refreshToken} />
      </section>
    </section>
  </>;
}
