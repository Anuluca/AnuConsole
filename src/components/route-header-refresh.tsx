"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ManagementButton } from "./infrastructure/management-button";

// 与连接状态共用路由标题栏；桌面位于右侧，手机由样式排在连接状态上方。
export function RouteHeaderRefresh({ onRefresh, disabled = false }: { onRefresh: () => void; disabled?: boolean }) {
  const [target, setTarget] = useState<HTMLElement | null>(null);
  useEffect(() => setTarget(document.getElementById("route-heading-status")), []);
  if (!target) return null;
  return createPortal(
    <ManagementButton icon="refresh" type="button" disabled={disabled} onClick={onRefresh}>刷新</ManagementButton>,
    target,
  );
}
