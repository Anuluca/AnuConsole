"use client";

import { useEffect, useState } from "react";

class AnalyticsReadError extends Error {}

interface Resource<T> { url: string; data?: T; error?: string; loading: boolean }
export function useAnalytics<T>(url: string, interval: number, refresh: number) {
  const [resource, setResource] = useState<Resource<T>>({ url, loading: true });
  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setTimeout>;
    let controller: AbortController | undefined;
    async function load() {
      clearTimeout(timer);
      if (!alive || document.hidden || (controller && !controller.signal.aborted)) return;
      controller = new AbortController();
      const current = controller;
      setResource(previous => ({ url, data: previous.url === url ? previous.data : undefined, loading: true }));
      try {
        const response = await fetch(url, { signal: current.signal, cache: "no-store" });
        if (response.redirected || response.status === 401) throw new AnalyticsReadError("登录已过期，请重新登录后读取。");
        const data = await response.json();
        if (!response.ok) throw new AnalyticsReadError(data.error === "analytics_not_configured" ? "统计读取尚未配置。" : "统计暂时无法读取，请重试。");
        if (alive && !current.signal.aborted) setResource({ url, data, loading: false });
      } catch (error) {
        if (alive && !current.signal.aborted) setResource(previous => ({ url, data: previous.url === url ? previous.data : undefined, loading: false, error: error instanceof AnalyticsReadError ? error.message : "统计暂时无法读取，请重试。" }));
      } finally {
        if (controller === current) {
          controller = undefined;
          if (alive && !document.hidden) timer = setTimeout(load, interval);
        }
      }
    }
    // 后台页面暂停请求，恢复可见后校准数据；切换时间范围和离开路由时取消旧请求。
    function visibility() {
      clearTimeout(timer);
      if (document.hidden) controller?.abort();
      else void load();
    }
    void load();
    document.addEventListener("visibilitychange", visibility);
    return () => {
      alive = false;
      clearTimeout(timer);
      controller?.abort();
      document.removeEventListener("visibilitychange", visibility);
    };
  }, [url, interval, refresh]);
  return resource.url === url ? resource : { url, loading: true } as Resource<T>;
}
