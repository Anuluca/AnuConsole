"use client";

import { usePathname } from "next/navigation";

export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  // 登录页与后台之间重建动画层，后台内部导航继续使用原有的两次闪烁。
  const section = pathname === "/login" ? "login" : "console";
  return <div key={section} className="page-surface">{children}</div>;
}
