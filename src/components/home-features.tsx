"use client";

import { useEffect, useRef, useState } from "react";
import { isHomeFeatures, type HomeFeatures } from "@/lib/home-features";
import { FeatureSwitch } from "./feature-switch";
import { RelatedLinks } from "./related-links";

const relatedLinks = [
  { label: "Anutrium 首页", href: "https://anuluca.com/" },
  { label: "Cloudflare 控制台", href: "https://dash.cloudflare.com/" },
  { label: "Netlify 控制台", href: "https://app.netlify.com/projects/anutrium/overview" },
];

export function HomeFeaturesPanel() {
  const [config, setConfig] = useState<HomeFeatures | null>(null);
  const [pending, setPending] = useState(true);
  const [error, setError] = useState("");
  const request = useRef<AbortController | null>(null);

  async function readOrSave(update?: boolean) {
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
      if (!response.ok || !isHomeFeatures(data)) {
        if (data && typeof data === "object" && "error" in data && data.error === "home_features_not_configured")
          message = "功能开关尚未配置。";
        throw new Error("feature_request_failed");
      }
      // 以服务端成功返回的状态为准，保存期间不提前改变开关。
      setConfig(data);
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

  return <section className="features-workspace" aria-label="功能调整内容区">
    <section className="feature-module" aria-labelledby="home-features-title">
      <header><h2 id="home-features-title">首页</h2></header>
      <div className="feature-row" aria-busy={pending}>
        <div className="feature-description">
          <h3>路卡雕像的头疼模式</h3>
          <p id="lucario-headache-description">保存后刷新生效，读取失败时使用普通模式。</p>
        </div>
        {error ? <div className="feature-error" role="alert"><span>{error}</span><button type="button" className="monitor-retry" onClick={() => void readOrSave()}>重试</button></div> : <div className="feature-control">
          <span role="status">{pending ? config ? "保存中…" : "读取中…" : config ? config.lucarioHeadache ? "已开启" : "已关闭" : "状态未知"}</span>
          <FeatureSwitch checked={config?.lucarioHeadache ?? false} disabled={pending || !config}
            label="路卡雕像的头疼模式" describedBy="lucario-headache-description"
            onChange={value => void readOrSave(value)} />
        </div>}
      </div>
    </section>
    <RelatedLinks label="功能调整相关链接" links={relatedLinks} />
  </section>;
}
