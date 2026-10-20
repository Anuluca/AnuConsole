"use client";

import { useEffect, useState } from "react";
import type {
  NetlifyDeploy,
  NetlifyDetail,
} from "@/lib/infrastructure-contract";
import { ManagementButton } from "./management-button";
import {
  ActionMessage,
  ManagementModal,
  Pagination,
  ResourceState,
  displayDate,
  managementRequest,
  useManagementResource,
} from "./ui";

const stateNames: Record<string, string> = {
  ready: "部署成功",
  current: "已发布",
  building: "正在构建",
  enqueued: "排队中",
  new: "已创建",
  pending_review: "待审核",
  error: "部署失败",
  canceled: "已取消",
  preparing: "准备中",
  uploading: "上传中",
  uploaded: "正在处理",
  processing: "正在处理",
};

export function NetlifyDeploys({
  site,
  writable,
}: {
  site: NetlifyDetail;
  writable: boolean;
}) {
  const [page, setPage] = useState(1);
  const [busy, setBusy] = useState(false);
  const [building, setBuilding] = useState(false);
  const [branch, setBranch] = useState("");
  const [clearCache, setClearCache] = useState(false);
  const [restore, setRestore] = useState<NetlifyDeploy | null>(null);
  const [publishedId, setPublishedId] = useState(site.published_deploy);
  const [closing, setClosing] = useState(false);
  const [message, setMessage] = useState<{
    text: string;
    error?: boolean;
  } | null>(null);
  const endpoint = `/api/infrastructure/netlify/${encodeURIComponent(site.id)}/deploys`;
  const resource = useManagementResource<{
    deploys: NetlifyDeploy[];
    page: number;
    hasMore: boolean;
  }>(`${endpoint}?page=${page}`);
  const active = resource.data?.deploys.some((deploy) =>
    [
      "new",
      "building",
      "enqueued",
      "preparing",
      "uploading",
      "uploaded",
      "processing",
    ].includes(deploy.state),
  );
  useEffect(() => {
    if (!active) return;
    // 隐藏标签页不再读取部署列表；重新可见时立即校准，不积累后台请求。
    let timer: ReturnType<typeof setInterval> | undefined;
    function sync() {
      clearInterval(timer);
      if (!document.hidden) timer = setInterval(resource.reload, 15000);
    }
    function visibility() {
      sync();
      if (!document.hidden) resource.reload();
    }
    sync();
    document.addEventListener("visibilitychange", visibility);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, [active, resource.reload]);
  async function mutate(
    input:
      | { action: "build"; branch: string; clear_cache: boolean }
      | { action: "restore"; deployId: string },
  ) {
    if (busy) return;
    setBusy(true);
    setMessage(null);
    try {
      await managementRequest(endpoint, "POST", input);
      setMessage({
        text:
          input.action === "build"
            ? "构建请求已提交，可刷新查看部署状态。"
            : "已将所选部署恢复为线上版本。",
      });
      if (input.action === "restore") setPublishedId(input.deployId);
    } catch (error) {
      setMessage({
        text: `${(error as Error).message} 已重新读取部署记录，请核对结果。`,
        error: true,
      });
    } finally {
      setBusy(false);
      setClosing(true);
      resource.reload();
    }
  }
  return (
    <div className="infra-section">
      <div className="infra-toolbar">
        <div>
          <h3>部署记录</h3>
          <p className="infra-muted">
            恢复部署会立即替换当前线上版本；构建中的状态每 15 秒刷新。
          </p>
        </div>
        <div className="infra-actions">
          <ManagementButton
            icon="refresh"
            className="button-secondary"
            type="button"
            onClick={resource.reload}
            disabled={busy || resource.loading}
          >
            刷新
          </ManagementButton>
          {writable && (
            <ManagementButton
              icon="deploy"
              className="button-primary"
              type="button"
              onClick={() => {
                setBuilding(true);
                setClosing(false);
              }}
            >
              重新部署
            </ManagementButton>
          )}
        </div>
      </div>
      <ActionMessage message={message} />
      <ResourceState {...resource} retry={resource.reload} />
      {resource.data && (
        <>
          <div className="infra-deploy-list">
            {resource.data.deploys.map((deploy) => (
              <article className="infra-deploy" key={deploy.id}>
                <div>
                  <div className="infra-actions">
                    <span
                      className={`infra-badge${deploy.state === "error" ? " infra-danger" : ""}`}
                    >
                      {publishedId === deploy.id
                        ? "当前线上版本"
                        : (stateNames[deploy.state] ?? deploy.state)}
                    </span>
                    <span className="infra-muted">{deploy.context}</span>
                  </div>
                  <h4>
                    {deploy.title ||
                      deploy.commit_ref?.slice(0, 8) ||
                      deploy.id}
                  </h4>
                  <p className="infra-muted infra-break">
                    {deploy.branch || "未指定分支"} ·{" "}
                    {displayDate(deploy.created_at)}
                  </p>
                  <small className="infra-muted infra-break">{deploy.id}</small>
                </div>
                <div className="infra-actions">
                  {deploy.url && (
                    <a
                      className="infra-text-link"
                      href={deploy.url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      打开部署 ↗
                    </a>
                  )}
                  {writable &&
                    ["ready", "current"].includes(deploy.state) &&
                    publishedId !== deploy.id && (
                      <ManagementButton
                        icon="settings"
                        className="button-secondary"
                        type="button"
                        onClick={() => {
                          setRestore(deploy);
                          setClosing(false);
                        }}
                      >
                        恢复此部署
                      </ManagementButton>
                    )}
                </div>
              </article>
            ))}
            {!resource.data.deploys.length && (
              <p className="infra-empty">此项目尚无部署记录。</p>
            )}
          </div>
          <Pagination
            page={page}
            hasNext={resource.data.hasMore}
            onChange={setPage}
            disabled={busy}
          />
        </>
      )}
      {building && (
        <ManagementModal
          title="触发 Netlify 构建？"
          description="构建可能产生平台用量。默认构建生产分支，其他分支将按项目配置部署。"
          busy={busy}
          closeRequested={closing}
          onClose={() => {
            if (!busy) setBuilding(false);
          }}
          footer={
            <>
              <ManagementButton
                icon="close"
                className="button-secondary"
                type="button"
                data-close-modal
                disabled={busy}
              >
                取消
              </ManagementButton>
              <ManagementButton
                icon="deploy"
                className="button-primary"
                type="button"
                disabled={busy}
                onClick={() => {
                  void mutate({
                    action: "build",
                    branch: branch.trim(),
                    clear_cache: clearCache,
                  });
                }}
              >
                {busy ? "正在提交…" : "确认构建"}
              </ManagementButton>
            </>
          }
        >
          <div className="infra-form">
            <label>
              构建分支
              <input
                value={branch}
                onChange={(event) => setBranch(event.target.value)}
                maxLength={255}
                placeholder="留空使用生产分支"
                disabled={busy}
              />
            </label>
            <label className="infra-check">
              <input
                type="checkbox"
                checked={clearCache}
                onChange={(event) => setClearCache(event.target.checked)}
                disabled={busy}
              />
              清除构建缓存
            </label>
          </div>
        </ManagementModal>
      )}
      {restore && (
        <ManagementModal
          title="恢复此部署到线上？"
          description="此操作立即更改线上版本，不会回滚环境变量、数据库或其他外部资源。"
          busy={busy}
          closeRequested={closing}
          onClose={() => {
            if (!busy) setRestore(null);
          }}
          footer={
            <>
              <ManagementButton
                icon="close"
                className="button-secondary"
                type="button"
                data-close-modal
                disabled={busy}
              >
                取消
              </ManagementButton>
              <ManagementButton
                icon="check"
                className="button-primary"
                type="button"
                disabled={busy}
                onClick={() => {
                  void mutate({ action: "restore", deployId: restore.id });
                }}
              >
                {busy ? "正在恢复…" : "确认恢复"}
              </ManagementButton>
            </>
          }
        >
          <p className="infra-break">
            {site.name} · {restore.title || restore.id}
          </p>
          <p className="infra-muted">{displayDate(restore.created_at)}</p>
        </ManagementModal>
      )}
    </div>
  );
}
