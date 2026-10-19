"use client";
import { ConnectionStatus } from "./connection-status";

import { ActionIcon, ManagementButton } from "./management-button";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { JsonObject, NetlifyDeploy, NetlifyDetail, NetlifySite } from "@/lib/infrastructure-contract";
import type { ProjectId } from "@/lib/projects";
import { NetlifyEnv } from "./netlify-env";
import { NetlifySettings } from "./netlify-settings";
import { NetlifyCreate } from "./netlify-create";
import { ActionMessage, ManagementModal, Pagination, ReadOnly, ResourceState, displayDate, managementRequest, useManagementResource } from "./ui";

function SitePreview({ site }: { site: NetlifySite }) {
  const [failed, setFailed] = useState(false);
  // 平台未提供截图或图片加载失败时隐藏，避免展示破损图片。
  return site.screenshot_url && !failed ? <img className="infra-site-preview" src={site.screenshot_url} alt={`${site.name} 网站预览`} loading="lazy" referrerPolicy="no-referrer" onError={() => setFailed(true)} /> : null;
}
function NetlifyLinks() {
  return <footer className="infra-related-links" aria-label="Netlify 相关链接"><a href="https://app.netlify.com/" target="_blank" rel="noreferrer">Netlify 控制台 ↗</a><a href="https://docs.netlify.com/" target="_blank" rel="noreferrer">Netlify 文档 ↗</a><a href="https://www.netlifystatus.com/" target="_blank" rel="noreferrer">服务状态 ↗</a></footer>;
}
const stateNames: Record<string, string> = { ready: "部署成功", current: "已发布", building: "正在构建", enqueued: "排队中", new: "已创建", pending_review: "待审核", error: "部署失败", canceled: "已取消", preparing: "准备中", uploading: "上传中", uploaded: "正在处理", processing: "正在处理" };

function Deploys({ site, writable }: { site: NetlifyDetail; writable: boolean }) {
  const [page, setPage] = useState(1);
  const [busy, setBusy] = useState(false);
  const [building, setBuilding] = useState(false);
  const [branch, setBranch] = useState("");
  const [clearCache, setClearCache] = useState(false);
  const [restore, setRestore] = useState<NetlifyDeploy | null>(null);
  const [publishedId, setPublishedId] = useState(site.published_deploy);
  const [closing, setClosing] = useState(false);
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);
  const endpoint = `/api/infrastructure/netlify/${encodeURIComponent(site.id)}/deploys`;
  const resource = useManagementResource<{ deploys: NetlifyDeploy[]; page: number; hasMore: boolean }>(`${endpoint}?page=${page}`);
  const active = resource.data?.deploys.some(deploy => ["new", "building", "enqueued", "preparing", "uploading", "uploaded", "processing"].includes(deploy.state));
  useEffect(() => {
    if (!active) return;
    const timer = window.setInterval(resource.reload, 15000);
    return () => clearInterval(timer);
  }, [active, resource.reload]);
  async function mutate(input: { action: "build"; branch: string; clear_cache: boolean } | { action: "restore"; deployId: string }) {
    if (busy) return;
    setBusy(true); setMessage(null);
    try {
      await managementRequest(endpoint, "POST", input);
      setMessage({ text: input.action === "build" ? "构建请求已提交，可刷新查看部署状态。" : "已将所选部署恢复为线上版本。" });
      if (input.action === "restore") setPublishedId(input.deployId);
    } catch (error) { setMessage({ text: `${(error as Error).message} 已重新读取部署记录，请核对结果。`, error: true }); }
    finally { setBusy(false); setClosing(true); resource.reload(); }
  }
  return <div className="infra-section"><div className="infra-toolbar"><div><h3>部署记录</h3><p className="infra-muted">恢复部署会立即替换当前线上版本；构建中的状态每 15 秒刷新。</p></div><div className="infra-actions"><ManagementButton icon="refresh" className="button-secondary" type="button" onClick={resource.reload} disabled={busy || resource.loading}>刷新</ManagementButton>{writable && <ManagementButton icon="deploy" className="button-primary" type="button" onClick={() => { setBuilding(true); setClosing(false); }}>重新部署</ManagementButton>}</div></div>
    <ActionMessage message={message} /><ResourceState {...resource} retry={resource.reload} />
    {resource.data && <><div className="infra-deploy-list">{resource.data.deploys.map(deploy => <article className="infra-deploy" key={deploy.id}><div><div className="infra-actions"><span className={`infra-badge${deploy.state === "error" ? " infra-danger" : ""}`}>{publishedId === deploy.id ? "当前线上版本" : stateNames[deploy.state] ?? deploy.state}</span><span className="infra-muted">{deploy.context}</span></div><h4>{deploy.title || deploy.commit_ref?.slice(0, 8) || deploy.id}</h4><p className="infra-muted infra-break">{deploy.branch || "未指定分支"} · {displayDate(deploy.created_at)}</p><small className="infra-muted infra-break">{deploy.id}</small></div><div className="infra-actions">{deploy.url && <a className="infra-text-link" href={deploy.url} target="_blank" rel="noreferrer">打开部署 ↗</a>}{writable && ["ready", "current"].includes(deploy.state) && publishedId !== deploy.id && <ManagementButton icon="settings" className="button-secondary" type="button" onClick={() => { setRestore(deploy); setClosing(false); }}>恢复此部署</ManagementButton>}</div></article>)}{!resource.data.deploys.length && <p className="infra-empty">此项目尚无部署记录。</p>}</div><Pagination page={page} hasNext={resource.data.hasMore} onChange={setPage} disabled={busy} /></>}
    {building && <ManagementModal title="触发 Netlify 构建？" description="构建可能产生平台用量。默认构建生产分支，其他分支将按项目配置部署。" busy={busy} closeRequested={closing} onClose={() => { if (!busy) setBuilding(false); }}
      footer={<><ManagementButton icon="close" className="button-secondary" type="button" data-close-modal disabled={busy}>取消</ManagementButton><ManagementButton icon="deploy" className="button-primary" type="button" disabled={busy} onClick={() => { void mutate({ action: "build", branch: branch.trim(), clear_cache: clearCache }); }}>{busy ? "正在提交…" : "确认构建"}</ManagementButton></>}>
      <div className="infra-form"><label>构建分支<input value={branch} onChange={event => setBranch(event.target.value)} maxLength={255} placeholder="留空使用生产分支" disabled={busy} /></label><label className="infra-check"><input type="checkbox" checked={clearCache} onChange={event => setClearCache(event.target.checked)} disabled={busy} />清除构建缓存</label></div>
    </ManagementModal>}
    {restore && <ManagementModal title="恢复此部署到线上？" description="此操作立即更改线上版本，不会回滚环境变量、数据库或其他外部资源。" busy={busy} closeRequested={closing} onClose={() => { if (!busy) setRestore(null); }}
      footer={<><ManagementButton icon="close" className="button-secondary" type="button" data-close-modal disabled={busy}>取消</ManagementButton><ManagementButton icon="check" className="button-primary" type="button" disabled={busy} onClick={() => { void mutate({ action: "restore", deployId: restore.id }); }}>{busy ? "正在恢复…" : "确认恢复"}</ManagementButton></>}><p className="infra-break">{site.name} · {restore.title || restore.id}</p><p className="infra-muted">{displayDate(restore.created_at)}</p></ManagementModal>}
  </div>;
}

function NetlifyProject({ siteId, writable, root }: { siteId: string; writable: boolean; root: string }) {
  const endpoint = `/api/infrastructure/netlify/${encodeURIComponent(siteId)}`;
  const resource = useManagementResource<NetlifyDetail>(endpoint);
  const [tab, setTab] = useState("deploys");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);
  async function saveSettings(patch: JsonObject) {
    setBusy(true); setMessage(null);
    try {
      const updated = await managementRequest<NetlifyDetail>(endpoint, "PATCH", patch);
      resource.replaceData(updated);
      setMessage({ text: "项目设置已保存。部分配置需要重新构建和部署后生效。" });
      return true;
    } catch (error) { setMessage({ text: `${(error as Error).message} 请刷新核对当前设置。`, error: true }); return false; }
    finally { setBusy(false); }
  }
  return <section className="infra-workspace" aria-label="Netlify项目详情">
    <ConnectionStatus service="Netlify" connected={!!resource.data && !resource.error} />
    <div className="infra-toolbar"><Link className="infra-text-link" href={root}>← 项目列表</Link><ManagementButton icon="refresh" className="button-secondary" type="button" disabled={busy || resource.loading} onClick={resource.reload}>刷新</ManagementButton></div>
    <ReadOnly writable={writable} /><ActionMessage message={message} /><ResourceState {...resource} retry={resource.reload} />
    {resource.data && <><div className="infra-project-heading"><SitePreview site={resource.data} /><div><h2>{resource.data.name}</h2><p className="infra-muted infra-break">{resource.data.id}</p></div><div className="infra-actions">{resource.data.url && <a className="infra-text-link" href={resource.data.url} target="_blank" rel="noreferrer">打开网站 ↗</a>}<a className="infra-text-link" href={resource.data.admin_url} target="_blank" rel="noreferrer">Netlify 控制台 ↗</a></div></div>
      <nav className="infra-tabs" aria-label="项目管理栏目">{[["deploys", "部署"], ["env", "环境变量"], ["settings", "项目设置"]].map(([value, label]) => <button key={value} type="button" aria-current={tab === value ? "page" : undefined} onClick={() => setTab(value)}>{label}</button>)}</nav>
      {tab === "deploys" && <Deploys site={resource.data} writable={writable} />}
      {tab === "env" && <NetlifyEnv siteId={siteId} writable={writable} />}
      {tab === "settings" && <NetlifySettings settings={resource.data.settings} writable={writable} busy={busy} onSave={saveSettings} />}
    </>}
    <NetlifyLinks />
  </section>;
}

export function NetlifyManager({ writable, siteId, projectId }: { writable: boolean; siteId?: string; projectId: ProjectId }) {
  const router = useRouter();
  const root = `/${projectId}/infrastructure/netlify`;
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);
  const resource = useManagementResource<{ sites: NetlifySite[]; page: number; hasMore: boolean; restricted: boolean }>(siteId ? null : `/api/infrastructure/netlify?page=${page}`);
  if (siteId) return <NetlifyProject key={`${projectId}:${siteId}`} siteId={siteId} writable={writable} root={root} />;
  const sites = resource.data?.sites.filter(site => `${site.name} ${site.url} ${site.account}`.toLowerCase().includes(search.toLowerCase()));
  return <section className="infra-workspace" aria-label="Netlify项目管理"><div className="infra-toolbar"><div><h2>Netlify 项目</h2><p className="infra-muted">{resource.data?.restricted ? "显示配置允许管理的项目。" : "显示当前令牌可访问的项目。"}</p></div><div className="infra-actions"><ManagementButton icon="refresh" className="button-secondary" type="button" onClick={resource.reload} disabled={resource.loading}>刷新</ManagementButton>{writable && <ManagementButton icon="add" className="button-primary" type="button" disabled={resource.loading || !resource.data || resource.data.restricted} onClick={() => { setMessage(null); setCreating(true); }}>新增项目</ManagementButton>}</div></div>
    <ConnectionStatus service="Netlify" connected={!!resource.data && !resource.error} />
    <ReadOnly writable={writable} /><ActionMessage message={message} />{writable && resource.data?.restricted && <p className="infra-notice">当前已启用项目 ID 允许列表，新增项目需先调整服务端管理范围。</p>}<input className="infra-search" aria-label="搜索当前页的项目" placeholder="搜索当前页的项目名称或域名" value={search} onChange={event => setSearch(event.target.value)} />
    <ResourceState {...resource} retry={resource.reload} />
    {resource.data && <><div className="infra-project-grid">{sites?.map(site => <Link className="infra-project-card" key={site.id} href={`${root}?site=${encodeURIComponent(site.id)}`}><SitePreview site={site} /><div className="infra-project-card-content"><h3>{site.name}</h3><p className="infra-muted infra-break">{site.url || "尚无访问地址"}</p><span className="infra-text-link"><ActionIcon name="settings" />管理项目</span></div></Link>)}</div>{!sites?.length && <p className="infra-empty">当前页没有符合条件的项目。</p>}<Pagination page={page} hasNext={resource.data.hasMore} onChange={setPage} /></>}
    {creating && <NetlifyCreate onClose={() => setCreating(false)} onCreated={id => { setCreating(false); router.push(`${root}?site=${encodeURIComponent(id)}`); }} onFailed={text => { setMessage({ text, error: true }); resource.reload(); }} />}
    <NetlifyLinks />
  </section>;
}
