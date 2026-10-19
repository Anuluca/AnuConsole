"use client";

import { ManagementButton } from "./management-button";

import { useState } from "react";
import type { GitHubRepository, GitHubRepositoryPage } from "@/lib/infrastructure-contract";
import { ManagementSelect, Pagination, ResourceState, useManagementResource } from "./ui";

export function GitHubRepositoryPicker({ value, onChange, disabled }: { value: GitHubRepository | null; onChange: (repository: GitHubRepository | null) => void; disabled: boolean }) {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const resource = useManagementResource<GitHubRepositoryPage>(`/api/infrastructure/netlify/repositories?page=${page}`);
  const filtered = resource.data?.repositories.filter(repository => repository.path.toLowerCase().includes(search.trim().toLowerCase())) ?? [];
  const choices = value && !filtered.some(repository => repository.id === value.id) ? [value, ...filtered] : filtered;
  return <div className="infra-section">
    <div className="infra-toolbar"><h4>选择 GitHub 仓库</h4><ManagementButton icon="refresh" type="button" className="button-secondary" disabled={disabled || resource.loading} onClick={resource.reload}>刷新仓库</ManagementButton></div>
    <ResourceState {...resource} retry={resource.reload} />
    {resource.data && <>
      <label>搜索当前页仓库<input value={search} onChange={event => setSearch(event.target.value)} placeholder="输入仓库名称或所有者" disabled={disabled} maxLength={255} /></label>
      <label>GitHub 仓库<ManagementSelect label="GitHub 仓库" value={value?.path ?? ""} disabled={disabled} options={[{ value: "", label: "请选择仓库" }, ...choices.map(repository => ({ value: repository.path, label: `${repository.path} · ${repository.private ? "私有" : "公开"}` }))]}
        onChange={path => { if (!path) onChange(null); else { const repository = choices.find(item => item.path === path); if (repository) onChange(repository); } }} /></label>
      {!filtered.length && <p className="infra-muted">当前页没有符合条件的仓库。私有仓库需包含在 GitHub 令牌的访问范围内。</p>}
      {(resource.data.hasMore || page > 1) && <Pagination page={page} hasNext={resource.data.hasMore} onChange={setPage} disabled={disabled || resource.loading} />}
    </>}
    {value && <p className="infra-muted">{value.private ? "私有仓库" : "公开仓库"} · 默认分支 {value.defaultBranch}{value.linked ? " · 已有关联的 Netlify 项目" : " · 创建时由 Netlify 检查仓库授权"}</p>}
    <a className="infra-text-link" href="https://github.com/settings/installations" target="_blank" rel="noreferrer">管理 Netlify 的 GitHub 仓库授权 ↗</a>
  </div>;
}
