"use client";
import { ConnectionStatus } from "../connection-status";

import { ActionIcon, ManagementButton } from "./management-button";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type {
  JsonObject,
  NetlifyDetail,
  NetlifySite,
} from "@/lib/infrastructure-contract";
import type { ProjectId } from "@/lib/projects";
import { NetlifyEnv } from "./netlify-env";
import { NetlifySettings } from "./netlify-settings";
import { NetlifyCreate } from "./netlify-create";
import { NetlifyDeploys } from "./netlify-deploys";
import {
  ActionMessage,
  Pagination,
  ResourceState,
  managementRequest,
  useManagementResource,
} from "./ui";

function SitePreview({ site }: { site: NetlifySite }) {
  const [failed, setFailed] = useState(false);
  // 平台未提供截图或图片加载失败时隐藏，避免展示破损图片。
  return site.screenshot_url && !failed ? (
    <img
      className="infra-site-preview"
      src={site.screenshot_url}
      alt={`${site.name} 网站预览`}
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
    />
  ) : null;
}
function NetlifyLinks() {
  return (
    <footer className="infra-related-links" aria-label="Netlify 相关链接">
      <a href="https://app.netlify.com/" target="_blank" rel="noreferrer">
        Netlify 控制台 ↗
      </a>
      <a href="https://docs.netlify.com/" target="_blank" rel="noreferrer">
        Netlify 文档 ↗
      </a>
      <a href="https://www.netlifystatus.com/" target="_blank" rel="noreferrer">
        服务状态 ↗
      </a>
    </footer>
  );
}

function NetlifyProject({
  siteId,
  writable,
  root,
}: {
  siteId: string;
  writable: boolean;
  root: string;
}) {
  const endpoint = `/api/infrastructure/netlify/${encodeURIComponent(siteId)}`;
  const resource = useManagementResource<NetlifyDetail>(endpoint);
  const [tab, setTab] = useState("deploys");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{
    text: string;
    error?: boolean;
  } | null>(null);
  async function saveSettings(patch: JsonObject) {
    setBusy(true);
    setMessage(null);
    try {
      const updated = await managementRequest<NetlifyDetail>(
        endpoint,
        "PATCH",
        patch,
      );
      resource.replaceData(updated);
      setMessage({
        text: "项目设置已保存。部分配置需要重新构建和部署后生效。",
      });
      return true;
    } catch (error) {
      setMessage({
        text: `${(error as Error).message} 请刷新核对当前设置。`,
        error: true,
      });
      return false;
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="infra-workspace" aria-label="Netlify项目详情">
      <ConnectionStatus
        service="Netlify"
        connected={!!resource.data && !resource.error}
      />
      <div className="infra-toolbar">
        <Link className="infra-text-link" href={root}>
          ← 项目列表
        </Link>
        <ManagementButton
          icon="refresh"
          className="button-secondary"
          type="button"
          disabled={busy || resource.loading}
          onClick={resource.reload}
        >
          刷新
        </ManagementButton>
      </div>
      <ActionMessage message={message} />
      <ResourceState {...resource} retry={resource.reload} />
      {resource.data && (
        <>
          <div className="infra-project-heading">
            <SitePreview site={resource.data} />
            <div>
              <h2>{resource.data.name}</h2>
              <p className="infra-muted infra-break">{resource.data.id}</p>
            </div>
            <div className="infra-actions">
              {resource.data.url && (
                <a
                  className="infra-text-link"
                  href={resource.data.url}
                  target="_blank"
                  rel="noreferrer"
                >
                  打开网站 ↗
                </a>
              )}
              <a
                className="infra-text-link"
                href={resource.data.admin_url}
                target="_blank"
                rel="noreferrer"
              >
                Netlify 控制台 ↗
              </a>
            </div>
          </div>
          <nav className="infra-tabs" aria-label="项目管理栏目">
            {[
              ["deploys", "部署"],
              ["env", "环境变量"],
              ["settings", "项目设置"],
            ].map(([value, label]) => (
              <button
                key={value}
                type="button"
                aria-current={tab === value ? "page" : undefined}
                onClick={() => setTab(value)}
              >
                {label}
              </button>
            ))}
          </nav>
          {tab === "deploys" && (
            <NetlifyDeploys site={resource.data} writable={writable} />
          )}
          {tab === "env" && <NetlifyEnv siteId={siteId} writable={writable} />}
          {tab === "settings" && (
            <NetlifySettings
              settings={resource.data.settings}
              writable={writable}
              busy={busy}
              onSave={saveSettings}
            />
          )}
        </>
      )}
      <NetlifyLinks />
    </section>
  );
}

export function NetlifyManager({
  writable,
  siteId,
  projectId,
}: {
  writable: boolean;
  siteId?: string;
  projectId: ProjectId;
}) {
  const router = useRouter();
  const root = `/${projectId}/infrastructure/netlify`;
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);
  const [message, setMessage] = useState<{
    text: string;
    error?: boolean;
  } | null>(null);
  const resource = useManagementResource<{
    sites: NetlifySite[];
    page: number;
    hasMore: boolean;
    restricted: boolean;
  }>(siteId ? null : `/api/infrastructure/netlify?page=${page}`);
  if (siteId)
    return (
      <NetlifyProject
        key={`${projectId}:${siteId}`}
        siteId={siteId}
        writable={writable}
        root={root}
      />
    );
  const query = search.toLowerCase();
  const sites = resource.data?.sites.filter((site) =>
    `${site.name} ${site.url} ${site.account}`.toLowerCase().includes(query),
  );
  return (
    <section className="infra-workspace" aria-label="Netlify部署管理">
      <div className="infra-toolbar">
        <input
          className="infra-search"
          aria-label="搜索当前页的项目"
          placeholder="搜索当前页的项目名称或域名"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <div className="infra-actions">
          <ManagementButton
            icon="refresh"
            className="button-secondary"
            type="button"
            onClick={resource.reload}
            disabled={resource.loading}
          >
            刷新
          </ManagementButton>
          {writable && (
            <ManagementButton
              icon="add"
              className="button-primary"
              type="button"
              disabled={
                resource.loading || !resource.data || resource.data.restricted
              }
              onClick={() => {
                setMessage(null);
                setCreating(true);
              }}
            >
              新增项目
            </ManagementButton>
          )}
        </div>
      </div>
      <ConnectionStatus
        service="Netlify"
        connected={!!resource.data && !resource.error}
      />
      <ActionMessage message={message} />
      {writable && resource.data?.restricted && (
        <p className="infra-notice">
          当前已启用项目 ID 允许列表，新增项目需先调整服务端管理范围。
        </p>
      )}
      <ResourceState {...resource} retry={resource.reload} />
      {resource.data && (
        <>
          <div className="infra-project-grid">
            {sites?.map((site) => (
              <Link
                className="infra-project-card"
                key={site.id}
                href={`${root}?site=${encodeURIComponent(site.id)}`}
              >
                <SitePreview site={site} />
                <div className="infra-project-card-content">
                  <h3>{site.name}</h3>
                  <p className="infra-muted infra-break">
                    {site.url || "尚无访问地址"}
                  </p>
                  <span className="infra-text-link">
                    <ActionIcon name="settings" />
                    管理项目
                  </span>
                </div>
              </Link>
            ))}
          </div>
          {!sites?.length && (
            <p className="infra-empty">当前页没有符合条件的项目。</p>
          )}
          <Pagination
            page={page}
            hasNext={resource.data.hasMore}
            onChange={setPage}
          />
        </>
      )}
      {creating && (
        <NetlifyCreate
          onClose={() => setCreating(false)}
          onCreated={(id) => {
            setCreating(false);
            router.push(`${root}?site=${encodeURIComponent(id)}`);
          }}
          onFailed={(text) => {
            setMessage({ text, error: true });
            resource.reload();
          }}
        />
      )}
      <NetlifyLinks />
    </section>
  );
}
