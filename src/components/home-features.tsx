"use client";

import { useEffect, useRef, useState } from "react";
import { parseHomeFeatures, type HomeFeatures } from "@/lib/home-features";
import { FeatureSwitch } from "./feature-switch";
import { RelatedLinks } from "./related-links";
import { LoadingIndicator } from "./loading-indicator";
import { ConnectionStatus } from "./connection-status";
import { useManagementResource } from "./infrastructure/ui";
import { RouteHeaderRefresh } from "./route-header-refresh";

function FeatureConnectionStatuses() {
  // 合并状态请求；平台独立校验，不为两个标识下载完整业务列表。
  const connections = useManagementResource<{
    cloudflare: boolean;
    netlify: boolean;
  }>("/api/infrastructure/connections");
  return (
    <>
      <ConnectionStatus
        service="Cloudflare"
        connected={connections.data?.cloudflare === true && !connections.error}
      />
      <ConnectionStatus
        service="Netlify"
        connected={connections.data?.netlify === true && !connections.error}
      />
    </>
  );
}

const relatedLinks = [
  { label: "Anutrium 首页", href: "https://anuluca.com/" },
  { label: "Cloudflare 控制台", href: "https://dash.cloudflare.com/" },
  {
    label: "Netlify 控制台",
    href: "https://app.netlify.com/projects/anutrium/overview",
  },
];

function HeadacheIcon() {
  // 用头部轮廓与闪电表达头疼，避免小尺寸下的漩涡线条挤在一起。
  return <svg className="feature-heading-icon" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M8 21v-4.5A7 7 0 1 1 18 10l3 4h-3v4h-4v3" />
    <path d="m12 5-3 5h3l-1 4 5-6h-4l1-3" />
  </svg>;
}

export function HomeFeaturesPanel({
  canEdit,
  embedded = false,
  refreshToken = 0,
}: {
  canEdit: boolean;
  embedded?: boolean;
  refreshToken?: number;
}) {
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
    let message =
      update === undefined
        ? "暂时无法读取状态，请重试。"
        : "保存结果未确认，请重新读取状态。";
    try {
      const response = await fetch("/api/features/home", {
        method: update === undefined ? "GET" : "PUT",
        headers:
          update === undefined
            ? undefined
            : { "Content-Type": "application/json" },
        body:
          update === undefined
            ? undefined
            : JSON.stringify({ lucarioHeadache: update }),
        cache: "no-store",
        signal: controller.signal,
      });
      const data: unknown = await response.json();
      const loadedConfig = parseHomeFeatures(data);
      if (!response.ok || !loadedConfig) {
        if (
          data &&
          typeof data === "object" &&
          "error" in data &&
          data.error === "home_features_not_configured"
        )
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
  }, [refreshToken]);

  return (
    <section
      className="features-workspace"
      aria-label={embedded ? "首页功能" : "功能调整内容区"}
    >
      {!embedded && <RouteHeaderRefresh disabled={pending} onRefresh={() => void readOrSave()} />}
      {!embedded && <FeatureConnectionStatuses />}
      <section className="feature-module" aria-labelledby="home-features-title">
        <header>
          <h2 id="home-features-title">首页</h2>
        </header>
        <div className="feature-row" aria-busy={pending}>
          {pending && !config ? (
            <LoadingIndicator label="正在读取功能状态" />
          ) : (
            <>
              <div className="feature-description">
                <h3><HeadacheIcon />路卡雕像的头疼模式</h3>
                <p id="lucario-headache-description">
                  每次从关闭切换为开启记录一次，保存后刷新首页生效。
                </p>
                {config && config.headacheCount !== null && (
                  <p>累计头疼 {config.headacheCount} 次</p>
                )}
              </div>
              {error ? (
                <div className="feature-error" role="alert">
                  <span>{error}</span>
                  <button
                    type="button"
                    className="monitor-retry"
                    onClick={() => void readOrSave()}
                  >
                    重试
                  </button>
                </div>
              ) : (
                <div className="feature-control">
                  <span role="status">
                    {pending
                      ? "保存中…"
                      : config
                        ? config.lucarioHeadache
                          ? "已开启"
                          : "已关闭"
                        : "状态未知"}
                  </span>
                  <FeatureSwitch
                    checked={config?.lucarioHeadache ?? false}
                    disabled={pending || !config || !canEdit}
                    label="路卡雕像的头疼模式"
                    describedBy="lucario-headache-description"
                    onChange={(value) => void readOrSave(value)}
                  />
                </div>
              )}
            </>
          )}
        </div>
      </section>
      {!embedded && (
        <RelatedLinks label="功能调整相关链接" links={relatedLinks} />
      )}
    </section>
  );
}
