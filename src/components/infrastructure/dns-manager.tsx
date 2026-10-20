"use client";

import { ManagementButton } from "./management-button";
import { ConnectionStatus } from "../connection-status";
import { RouteHeaderRefresh } from "../route-header-refresh";

import { useId, useState, type FormEvent } from "react";
import {
  DNS_ZONE,
  dnsTypes,
  validateDns,
  type DnsInput,
  type DnsPage,
  type DnsRecord,
} from "@/lib/infrastructure-contract";
import {
  ActionMessage,
  ManagementModal,
  ManagementSelect,
  Pagination,
  ResourceState,
  managementRequest,
  useManagementResource,
} from "./ui";

const simpleTypes = ["A", "AAAA", "CNAME", "TXT", "MX", "NS", "PTR"];

function DnsEditor({
  record,
  busy,
  closeRequested,
  onClose,
  onSave,
}: {
  record: DnsRecord | null;
  busy: boolean;
  closeRequested: boolean;
  onClose: () => void;
  onSave: (input: DnsInput) => void;
}) {
  const formId = useId();
  const [type, setType] = useState<DnsInput["type"]>(record?.type ?? "A");
  const [name, setName] = useState(record?.name ?? "@");
  const [content, setContent] = useState(record?.content ?? "");
  const [ttl, setTtl] = useState(String(record?.ttl ?? 1));
  const [proxied, setProxied] = useState(record?.proxied ?? false);
  const [priority, setPriority] = useState(String(record?.priority ?? 10));
  const [comment, setComment] = useState(record?.comment ?? "");
  const [tags, setTags] = useState(record?.tags?.join("\n") ?? "");
  const [advanced, setAdvanced] = useState(
    JSON.stringify(
      {
        ...(record?.data ? { data: record.data } : {}),
        ...(record?.settings ? { settings: record.settings } : {}),
      },
      null,
      2,
    ),
  );
  const [error, setError] = useState("");
  function submit(event: FormEvent) {
    event.preventDefault();
    try {
      const extra: unknown = JSON.parse(advanced);
      if (
        !extra ||
        typeof extra !== "object" ||
        Array.isArray(extra) ||
        Object.keys(extra).some((key) => !["data", "settings"].includes(key))
      )
        throw new Error();
      const input = validateDns({
        type,
        name,
        ttl: Number(ttl),
        ...(simpleTypes.includes(type) || !Object.hasOwn(extra, "data")
          ? { content }
          : {}),
        ...(["A", "AAAA", "CNAME"].includes(type) ? { proxied } : {}),
        ...(type === "MX" ? { priority: Number(priority) } : {}),
        comment,
        tags: tags
          .split("\n")
          .map((tag) => tag.trim())
          .filter(Boolean),
        ...extra,
      });
      setError("");
      onSave(input);
    } catch {
      setError(
        "记录内容无效，请检查名称、TTL 和高级字段。高级字段使用合法 JSON，只包含 data、settings。",
      );
    }
  }
  return (
    <ManagementModal
      title={record ? "编辑 DNS 记录" : "新增 DNS 记录"}
      busy={busy}
      onClose={onClose}
      closeRequested={closeRequested}
      footer={
        <>
          <ManagementButton
            icon="close"
            type="button"
            className="button-secondary"
            data-close-modal
            disabled={busy}
          >
            取消
          </ManagementButton>
          <ManagementButton
            icon="check"
            className="button-primary"
            type="submit"
            form={formId}
            disabled={busy}
          >
            {busy ? "正在保存…" : "保存记录"}
          </ManagementButton>
        </>
      }
    >
      <form id={formId} className="infra-form" onSubmit={submit}>
        <fieldset disabled={busy}>
          <div className="infra-form-grid">
            <label>
              记录类型
              <ManagementSelect
                label="记录类型"
                value={type}
                options={dnsTypes.map((value) => ({ value, label: value }))}
                onChange={(value) => setType(value as DnsInput["type"])}
                disabled={busy}
              />
            </label>
            <label>
              记录名称
              <input
                required
                value={name}
                onChange={(event) => setName(event.target.value)}
                maxLength={253}
              />
              <small>@ 代表 {DNS_ZONE}；子域名可填写完整名称。</small>
            </label>
            <label className="infra-span">
              {simpleTypes.includes(type)
                ? "记录内容"
                : "记录内容（也可通过高级字段填写 data）"}
              <textarea
                value={content}
                onChange={(event) => setContent(event.target.value)}
                rows={type === "TXT" ? 4 : 2}
                maxLength={65535}
                required={simpleTypes.includes(type)}
                spellCheck={false}
              />
            </label>
            <label>
              TTL（秒）
              <input
                type="number"
                required
                min={1}
                max={86400}
                value={ttl}
                onChange={(event) => setTtl(event.target.value)}
              />
              <small>1 为自动；其他值通常为 60–86400。</small>
            </label>
            {type === "MX" && (
              <label>
                优先级
                <input
                  type="number"
                  required
                  min={0}
                  max={65535}
                  value={priority}
                  onChange={(event) => setPriority(event.target.value)}
                />
              </label>
            )}
            {["A", "AAAA", "CNAME"].includes(type) && (
              <label className="infra-check">
                <input
                  type="checkbox"
                  checked={proxied}
                  onChange={(event) => setProxied(event.target.checked)}
                />
                启用 Cloudflare 代理
              </label>
            )}
            <label className="infra-span">
              备注
              <input
                value={comment}
                onChange={(event) => setComment(event.target.value)}
                maxLength={500}
              />
            </label>
            <label className="infra-span">
              标签
              <textarea
                value={tags}
                onChange={(event) => setTags(event.target.value)}
                rows={2}
              />
              <small>每行一个标签。</small>
            </label>
          </div>
          <details className="infra-details" open={!simpleTypes.includes(type)}>
            <summary>高级记录字段</summary>
            <label>
              data / settings
              <textarea
                className="infra-code"
                value={advanced}
                onChange={(event) => setAdvanced(event.target.value)}
                rows={8}
                spellCheck={false}
              />
            </label>
            <p className="infra-muted">
              SRV、CAA、HTTPS 等结构化记录可通过 data 对象填写字段，具体规则由
              Cloudflare 校验。
            </p>
            <a
              className="infra-text-link"
              href="https://developers.cloudflare.com/api/resources/dns/subresources/records/methods/create/"
              target="_blank"
              rel="noreferrer"
            >
              查看记录字段文档 ↗
            </a>
          </details>
        </fieldset>
        {error && (
          <p className="infra-error" role="alert">
            {error}
          </p>
        )}
      </form>
    </ManagementModal>
  );
}

export function DnsManager({ writable }: { writable: boolean }) {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [type, setType] = useState("");
  const [editor, setEditor] = useState<{ record: DnsRecord | null } | null>(
    null,
  );
  const [deleting, setDeleting] = useState<DnsRecord | null>(null);
  const [busy, setBusy] = useState(false);
  const [closeRequested, setCloseRequested] = useState(false);
  const [message, setMessage] = useState<{
    text: string;
    error?: boolean;
  } | null>(null);
  const resource = useManagementResource<DnsPage>(
    `/api/infrastructure/dns?${new URLSearchParams({ page: String(page), search: query, type })}`,
  );
  function close() {
    if (!busy) {
      setEditor(null);
      setDeleting(null);
      setCloseRequested(false);
    }
  }
  async function mutate(method: string, id?: string, input?: DnsInput) {
    if (busy) return;
    setBusy(true);
    setMessage(null);
    try {
      await managementRequest(
        `/api/infrastructure/dns${id ? `/${encodeURIComponent(id)}` : ""}`,
        method,
        input,
      );
      setMessage({
        text:
          method === "DELETE"
            ? "DNS 记录已删除。"
            : "DNS 记录已保存。解析更新需要等待 DNS 缓存刷新。",
      });
    } catch (error) {
      setMessage({
        text: `${(error as Error).message} 已重新读取记录，请核对结果。`,
        error: true,
      });
    } finally {
      setBusy(false);
      setCloseRequested(true);
      resource.reload();
    }
  }
  return (
    <section className="infra-workspace" aria-label="DNS记录管理">
      <RouteHeaderRefresh onRefresh={resource.reload} disabled={busy || resource.loading} />
      <ConnectionStatus
        service="Cloudflare"
        connected={!!resource.data && !resource.error}
      />
      <div className="infra-toolbar dns-toolbar">
        <div>
          <h2>{DNS_ZONE}</h2>
          <p className="infra-muted">
            Cloudflare DNS{" "}
            {resource.data ? `· ${resource.data.total} 条记录` : ""}
          </p>
        </div>
        <div className="infra-actions">
          {writable && (
            <ManagementButton
              icon="add"
              type="button"
              className="button-primary"
              onClick={() => {
                setCloseRequested(false);
                setEditor({ record: null });
              }}
            >
              新增记录
            </ManagementButton>
          )}
        </div>
      </div>
      <ActionMessage message={message} />
      <form
        className="infra-filters"
        onSubmit={(event) => {
          event.preventDefault();
          setPage(1);
          setQuery(search.trim());
        }}
      >
        <input
          aria-label="搜索 DNS 记录"
          placeholder="搜索名称或内容"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          maxLength={253}
        />
        <ManagementSelect
          label="筛选记录类型"
          value={type}
          options={[
            { value: "", label: "全部类型" },
            ...dnsTypes.map((value) => ({ value, label: value })),
          ]}
          onChange={(value) => {
            setType(value);
            setPage(1);
          }}
        />
        <ManagementButton
          icon="search"
          className="button-secondary"
          type="submit"
        >
          搜索
        </ManagementButton>
      </form>
      <ResourceState {...resource} retry={resource.reload} />
      {resource.data && (
        <>
          <div className="infra-table-wrap">
            <table className="infra-table dns-table">
              <thead>
                <tr>
                  <th scope="col">类型</th>
                  <th scope="col">名称</th>
                  <th scope="col">内容</th>
                  <th scope="col">代理 / TTL</th>
                  <th scope="col">备注</th>
                  {writable && <th scope="col">操作</th>}
                </tr>
              </thead>
              <tbody>
                {resource.data.records.map((record) => (
                  <tr key={record.id}>
                    <td data-label="类型">
                      <span className="infra-badge">{record.type}</span>
                    </td>
                    <td data-label="名称" className="dns-record-name">
                      <strong>{record.name}</strong>
                    </td>
                    <td data-label="内容" className="infra-record-value">
                      {record.content || JSON.stringify(record.data ?? {})}
                    </td>
                    <td data-label="代理 / TTL">
                      <span className="dns-record-routing">
                        {record.proxied ? "已代理" : "仅 DNS"} /{" "}
                        {record.ttl === 1 ? "自动 TTL" : `${record.ttl} 秒`}
                      </span>
                    </td>
                    <td data-label="备注">{record.comment || "—"}</td>
                    {writable && (
                      <td data-label="操作">
                        <div className="infra-actions">
                          <ManagementButton
                            icon="edit"
                            className="infra-text-button"
                            type="button"
                            onClick={() => {
                              setCloseRequested(false);
                              setEditor({ record });
                            }}
                          >
                            编辑
                          </ManagementButton>
                          <ManagementButton
                            icon="delete"
                            className="infra-text-button infra-danger"
                            type="button"
                            onClick={() => {
                              setCloseRequested(false);
                              setDeleting(record);
                            }}
                          >
                            删除
                          </ManagementButton>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
            {!resource.data.records.length && (
              <p className="infra-empty">没有符合条件的 DNS 记录。</p>
            )}
          </div>
          <Pagination
            page={page}
            hasNext={page < resource.data.pages}
            onChange={setPage}
          />
        </>
      )}
      {editor && (
        <DnsEditor
          record={editor.record}
          busy={busy}
          closeRequested={closeRequested}
          onClose={close}
          onSave={(input) => {
            void mutate(
              editor.record ? "PATCH" : "POST",
              editor.record?.id,
              input,
            );
          }}
        />
      )}
      {deleting && (
        <ManagementModal
          danger
          title="删除 DNS 记录？"
          description="删除后，该记录将不再参与域名解析。"
          busy={busy}
          closeRequested={closeRequested}
          onClose={close}
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
                icon="delete"
                className="button-primary button-danger"
                type="button"
                disabled={busy}
                onClick={() => {
                  void mutate("DELETE", deleting.id);
                }}
              >
                {busy ? "正在删除…" : "确认删除"}
              </ManagementButton>
            </>
          }
        >
          <p className="infra-break">
            {deleting.type} · {deleting.name}
          </p>
          <p className="infra-muted infra-break">{deleting.content}</p>
        </ManagementModal>
      )}
      <footer className="infra-related-links" aria-label="DNS 相关链接">
        <a href="https://dash.cloudflare.com/" target="_blank" rel="noreferrer">
          Cloudflare 控制台 ↗
        </a>
        <a
          href="https://developers.cloudflare.com/dns/"
          target="_blank"
          rel="noreferrer"
        >
          DNS 文档 ↗
        </a>
        <a
          href="https://www.cloudflarestatus.com/"
          target="_blank"
          rel="noreferrer"
        >
          服务状态 ↗
        </a>
      </footer>
    </section>
  );
}
