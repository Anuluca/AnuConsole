"use client";

import { useEffect, useRef, useState } from "react";
import { parseHomeFeatures, type HomeFeatures } from "@/lib/home-features";
import { FeatureSwitch } from "./feature-switch";
import { RelatedLinks } from "./related-links";
import { LoadingIndicator } from "./loading-indicator";
import { ConnectionStatus } from "./infrastructure/connection-status";
import { useManagementResource } from "./infrastructure/ui";

function FeatureConnectionStatuses() {
  // 分别验证两端连接，不以功能开关读取成功代替平台连接成功。
  const cloudflare = useManagementResource<unknown>("/api/infrastructure/dns?page=1");
  const netlify = useManagementResource<unknown>("/api/infrastructure/netlify?page=1");
  return <>
    <ConnectionStatus service="Cloudflare" connected={!!cloudflare.data && !cloudflare.error} />
    <ConnectionStatus service="Netlify" connected={!!netlify.data && !netlify.error} />
  </>;
}

const relatedLinks = [
  { label: "Anutrium 首页", href: "https://anuluca.com/" },
  { label: "Cloudflare 控制台", href: "https://dash.cloudflare.com/" },
  { label: "Netlify 控制台", href: "https://app.netlify.com/projects/anutrium/overview" },
];

export function HomeFeaturesPanel({ canEdit, embedded = false }: { canEdit: boolean; embedded?: boolean }) {
  const [config, setConfig] = useState<HomeFeatures | null>(null);
  const [pending, setPending] = useState(true);
  const [error, setError] = useState("");
  const request = useRef<AbortController | null>(null);

  async function readOrSave(update?: boolean) {
    if (update !== undefined && !canEdit) return;
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setPending(true);
    setError("");
    let message = update === undefined ? "暂时无法读取状态，请重试。" : "保存结果未确认，请重新读取状态。";
    try {
      const response = await fetch("/api/features/home", {
        method: update === undefined ? "GET" : "PUT",
        headers: update === undefined ? undefined : { "Content-Type": "application/json" },
        body: update === undefined ? undefined : JSON.stringify({ lucarioHeadache: update }),
        cache: "no-store",
        signal: controller.signal,
      });
      const data: unknown = await response.json();
      const loadedConfig = parseHomeFeatures(data);
      if (!response.ok || !loadedConfig) {
        if (data && typeof data === "object" && "error" in data && data.error === "home_features_not_configured")
          message = "功能开关尚未配置。";
        throw new Error("feature_request_failed");
      }
      // 以服务端成功返回的状态为准，保存期间不提前改变开关。
      setConfig(loadedConfig);
    } catch {
      if (!controller.signal.aborted) {
        setConfig(null);
        setError(message);
      }
    } finally {
      if (!controller.signal.aborted) setPending(false);
    }
  }

  useEffect(() => {
    void readOrSave();
    return () => request.current?.abort();
  }, []);

  return <section className="features-workspace" aria-label={embedded ? "首页功能" : "功能调整内容区"}>
    {!embedded && <FeatureConnectionStatuses />}
    <section className="feature-module" aria-labelledby="home-features-title">
      <header><h2 id="home-features-title">首页</h2></header>
      <div className="feature-row" aria-busy={pending}>
        {pending && !config ? <LoadingIndicator label="正在读取功能状态" /> : <>
        <div className="feature-description">
          <h3>路卡雕像的头疼模式</h3>
          <p id="lucario-headache-description">每次从关闭切换为开启记录一次，保存后刷新首页生效。</p>
          {config && config.headacheCount !== null && <p>累计头疼 {config.headacheCount} 次</p>}
        </div>
        {error ? <div className="feature-error" role="alert"><span>{error}</span><button type="button" className="monitor-retry" onClick={() => void readOrSave()}>重试</button></div> : <div className="feature-control">
          <span role="status">{pending ? "保存中…" : config ? config.lucarioHeadache ? "已开启" : "已关闭" : "状态未知"}{!canEdit && " · 只读"}</span>
          <FeatureSwitch checked={config?.lucarioHeadache ?? false} disabled={pending || !config || !canEdit}
            label="路卡雕像的头疼模式" describedBy="lucario-headache-description"
            onChange={value => void readOrSave(value)} />
        </div>}
        </>}
      </div>
    </section>
    {!embedded && <RelatedLinks label="功能调整相关链接" links={relatedLinks} />}
  </section>;
}
