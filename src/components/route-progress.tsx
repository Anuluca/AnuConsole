"use client";

import Link, { useLinkStatus } from "next/link";
import { createContext, useCallback, useContext, useEffect, useId, useState, type ComponentProps, type ReactNode } from "react";

// 链接只订阅稳定的上报函数；进度变化不再使所有导航链接一起重渲染。
const ProgressUpdateContext = createContext((_id: string, _pending: boolean) => {});
const ProgressPendingContext = createContext(false);

export function RouteProgressProvider({ children }: { children: ReactNode }) {
  const [links, setLinks] = useState<Set<string>>(() => new Set());
  const update = useCallback((id: string, pending: boolean) => {
    setLinks(previous => {
      if (previous.has(id) === pending) return previous;
      const next = new Set(previous);
      if (pending) next.add(id); else next.delete(id);
      return next;
    });
  }, []);
  return <ProgressUpdateContext.Provider value={update}>
    <ProgressPendingContext.Provider value={links.size > 0}>{children}</ProgressPendingContext.Provider>
  </ProgressUpdateContext.Provider>;
}

function PendingLink() {
  const { pending } = useLinkStatus();
  const update = useContext(ProgressUpdateContext);
  const id = useId();
  // 跟随 Next.js 的真实导航状态；取消导航或链接卸载时同时释放状态。
  useEffect(() => {
    update(id, pending);
    return () => update(id, false);
  }, [id, pending, update]);
  return null;
}

export function ProgressLink({ children, ...props }: ComponentProps<typeof Link>) {
  return <Link {...props}>{children}<PendingLink /></Link>;
}

export function RouteProgress() {
  const pending = useContext(ProgressPendingContext);
  const [phase, setPhase] = useState<"idle" | "loading" | "complete">("idle");
  useEffect(() => {
    if (pending) setPhase("loading");
    else setPhase(previous => previous === "loading" ? "complete" : previous);
  }, [pending]);
  useEffect(() => {
    if (phase !== "complete") return;
    const timer = setTimeout(() => setPhase("idle"), 180);
    return () => clearTimeout(timer);
  }, [phase]);
  if (phase === "idle") return null;
  // 不显示虚构百分比：加载中为不定进度，路由完成后填满并退场。
  return <div className="route-progress" data-phase={phase} role="progressbar" aria-label="页面加载进度"><span /></div>;
}
