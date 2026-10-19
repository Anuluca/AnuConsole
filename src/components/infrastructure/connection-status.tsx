"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

/** 仅在实际读取成功后展示连接状态，读取失败时移除，避免误报。 */
export function ConnectionStatus({ service, connected }: { service: string; connected: boolean }) {
  const [target, setTarget] = useState<HTMLElement | null>(null);
  useEffect(() => { setTarget(document.getElementById("route-heading-status")); }, []);
  if (!target || !connected) return null;
  return createPortal(<span className="monitor-connection" role="status">
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m3 8 3 3 7-7" /></svg>
    已链接{service}
  </span>, target);
}
