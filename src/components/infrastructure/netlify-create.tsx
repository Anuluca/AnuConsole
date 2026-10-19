"use client";

import { ManagementButton } from "./management-button";

import { useId, useState, type FormEvent } from "react";
import { validateNetlifyCreate, type GitHubRepository, type JsonObject, type NetlifyAccount, type NetlifyDetail } from "@/lib/infrastructure-contract";
import { ManagementModal, ManagementSelect, ResourceState, managementRequest, useManagementResource } from "./ui";
import { GitHubRepositoryPicker } from "./github-repository-picker";

export function NetlifyCreate({ onClose, onCreated, onFailed }: { onClose: () => void; onCreated: (siteId: string) => void; onFailed: (message: string) => void }) {
  const formId = useId();
  const teams = useManagementResource<{ accounts: NetlifyAccount[] }>("/api/infrastructure/netlify/accounts");
  const [account, setAccount] = useState("");
  const [name, setName] = useState("");
  const [domain, setDomain] = useState("");
  const [useGit, setUseGit] = useState(false);
  const [repository, setRepository] = useState<GitHubRepository | null>(null);
  const [branch, setBranch] = useState("main");
  const [command, setCommand] = useState("");
  const [directory, setDirectory] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [closing, setClosing] = useState(false);
  const [created, setCreated] = useState<string | null>(null);
  const selectedAccount = account || (teams.data?.accounts.length === 1 ? teams.data.accounts[0].slug : "");
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    let input;
    try {
      const settings: JsonObject = { name: name.trim(), ...(domain.trim() ? { custom_domain: domain.trim() } : {}) };
      if (useGit) {
        if (!repository) throw new Error("repository_required");
        settings.repo = { provider: "github", id: repository.id, repo_path: repository.path, repo_branch: branch.trim(), public_repo: !repository.private,
          ...(command.trim() ? { cmd: command.trim() } : {}), ...(directory.trim() ? { dir: directory.trim() } : {}) };
      }
      input = validateNetlifyCreate({ accountSlug: selectedAccount, settings });
    } catch { setError("请选择团队，并检查项目名称、域名和仓库配置。项目名称只允许小写字母、数字和连字符。"); return; }
    setBusy(true); setError("");
    try {
      // 创建不自动重试；响应丢失时先关闭表单、刷新列表，让用户核对是否已经创建。
      const result = await managementRequest<{ site: NetlifyDetail }>("/api/infrastructure/netlify", "POST", input);
      setCreated(result.site.id);
    } catch (error) { onFailed(`${(error as Error).message} 请先核对项目列表，再决定是否重新创建。`); }
    finally { setBusy(false); setClosing(true); }
  }
  function dismiss() { if (created) onCreated(created); else onClose(); }
  return <ManagementModal title="新增 Netlify 项目" description="选择项目所属团队。空项目创建后可继续配置环境变量和部署；关联 Git 仓库可能触发首次构建。" busy={busy} closeRequested={closing} onClose={dismiss}
    footer={<><ManagementButton icon="close" type="button" className="button-secondary" data-close-modal disabled={busy}>取消</ManagementButton><ManagementButton icon="add" type="submit" className="button-primary" form={formId} disabled={busy || !selectedAccount || !teams.data?.accounts.length || (useGit && !repository)}>{busy ? "正在创建…" : "创建项目"}</ManagementButton></>}>
    <ResourceState {...teams} retry={teams.reload} />
    {teams.data && !teams.data.accounts.length && <p className="infra-notice">当前令牌未关联可用团队，请检查 Netlify 账号权限。</p>}
    <form className="infra-form" id={formId} onSubmit={event => { void submit(event); }}><fieldset disabled={busy || teams.loading || !teams.data?.accounts.length}>
      <label>所属团队<ManagementSelect label="所属团队" value={selectedAccount} onChange={setAccount} disabled={busy || teams.loading} options={[{ value: "", label: "请选择团队" }, ...(teams.data?.accounts.map(team => ({ value: team.slug, label: `${team.name} (${team.slug})` })) ?? [])]} /></label>
      <label>项目名称<input value={name} onChange={event => setName(event.target.value)} required maxLength={63} pattern="[a-z0-9]([a-z0-9-]*[a-z0-9])?" autoComplete="off" placeholder="my-project" /><small>默认访问地址为 {name.trim() || "项目名称"}.netlify.app。</small></label>
      <label>自定义域名（可选）<input value={domain} onChange={event => setDomain(event.target.value)} maxLength={253} placeholder="example.com" /><small>只绑定项目域名，DNS 记录可在域名解析页面单独配置。</small></label>
      <label className="infra-check"><input type="checkbox" checked={useGit} onChange={event => setUseGit(event.target.checked)} />关联 Git 仓库</label>
      {useGit && <><GitHubRepositoryPicker value={repository} disabled={busy} onChange={next => {
        setRepository(next); if (!next) return;
        setBranch(next.defaultBranch); setCommand(next.buildCommand ?? ""); setDirectory(next.publishDirectory ?? "");
        if (!name.trim()) setName(next.path.split("/").at(-1)!.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/^-+|-+$/g, "").slice(0, 63).replace(/-+$/g, ""));
      }} /><div className="infra-form-grid">
        <label>生产分支<input required value={branch} onChange={event => setBranch(event.target.value)} maxLength={255} /></label>
        <label>构建命令<input value={command} onChange={event => setCommand(event.target.value)} placeholder="npm run build" maxLength={4096} /></label>
        <label>发布目录<input value={directory} onChange={event => setDirectory(event.target.value)} placeholder="dist" maxLength={4096} /></label>
      </div></>}
    </fieldset>{error && <p className="infra-error" role="alert">{error}</p>}</form>
  </ManagementModal>;
}
