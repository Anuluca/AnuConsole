"use client";

import { useEffect, useState } from "react";
import { formatRelativeTime } from "@/lib/relative-time";

export function RelativeTime({ value }: { value?: string }) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | undefined;
    // 展示时间随时钟更新；后台暂停，恢复可见时立即校准，避免额外请求报表。
    function sync() {
      clearInterval(timer);
      if (document.hidden || !value) return;
      setNow(Date.now());
      timer = setInterval(() => setNow(Date.now()), 1000);
    }
    sync();
    document.addEventListener("visibilitychange", sync);
    return () => { clearInterval(timer); document.removeEventListener("visibilitychange", sync); };
  }, [value]);
  const valid = value && Number.isFinite(Date.parse(value));
  const exact = valid ? new Date(value).toLocaleString("zh-CN", { timeZone: "Asia/Shanghai", hour12: false }) + "（北京时间）" : undefined;
  return <time dateTime={valid ? value : undefined} title={exact}>{now === null ? "—" : formatRelativeTime(value, now)}</time>;
}
