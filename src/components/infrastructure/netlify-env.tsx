"use client";

import { useId, useState, type FormEvent } from "react";
import { envContexts, envScopes, validateEnv, validateEnvValue, type EnvContext, type EnvInput, type EnvScope, type EnvValueInput, type EnvVariable } from "@/lib/infrastructure-contract";
import { ActionMessage, ManagementModal, ManagementSelect, ResourceState, managementRequest, useManagementResource } from "./ui";

const contextNames: Record<EnvContext, string> = { all: "全部环境", production: "生产环境", "deploy-preview": "部署预览", "branch-deploy": "分支部署", branch: "指定分支", dev: "本地开发", "dev-server": "开发服务器" };
const scopeNames: Record<EnvScope, string> = { builds: "构建", functions: "函数", runtime: "运行时", "post-processing": "后处理" };
type Editor = { mode: "create" | "value" | "replace"; variable?: EnvVariable; initial?: EnvVariable["values"][number] };

function EnvEditor({ editor, busy, closing, onClose, onSave }: { editor: Editor; busy: boolean; closing: boolean; onClose: () => void; onSave: (value: EnvInput | EnvValueInput) => void }) {
  const id = useId();
  const [key, setKey] = useState(editor.variable?.key ?? "");
  const [scopes, setScopes] = useState<EnvScope[]>(editor.variable?.scopes ?? [...envScopes]);
  const [secret, setSecret] = useState(editor.variable?.is_secret ?? true);
  const [values, setValues] = useState<EnvValueInput[]>([{ context: editor.initial?.context ?? "all", ...(editor.initial?.context_parameter ? { context_parameter: editor.initial.context_parameter } : {}), value: "" }]);
  const [error, setError] = useState("");
  function edit(index: number, patch: Partial<EnvValueInput>) { setValues(current => current.map((value, i) => i === index ? { ...value, ...patch } : value)); }
  function submit(event: FormEvent) {
    event.preventDefault();
    try {
      const input = editor.mode === "value" ? validateEnvValue(values[0]) : validateEnv({ key, scopes, is_secret: secret, values });
      setError(""); onSave(input);
    } catch { setError("请检查变量名称、作用域及上下文；同一个上下文只能出现一次，指定分支必须填写分支名。"); }
  }
  return <ManagementModal title={editor.mode === "create" ? "新增环境变量" : editor.mode === "value" ? "修改环境变量值" : "重设环境变量"} onClose={onClose} busy={busy} closeRequested={closing}
    description={editor.mode === "replace" ? "此次保存会替换该变量的全部上下文和值。请完整填写所有需要保留的值。" : "原值不会显示。修改后通常需要重新构建和部署才能生效。"}
    footer={<><button className="button-secondary" type="button" data-close-modal disabled={busy}>取消</button><button className="button-primary" type="submit" form={id} disabled={busy}>{busy ? "正在保存…" : "保存变量"}</button></>}>
    <form id={id} className="infra-form" onSubmit={submit}><fieldset disabled={busy}>
      <label>变量名称<input required value={key} onChange={event => setKey(event.target.value)} readOnly={editor.mode === "value"} autoComplete="off" pattern="[a-zA-Z_][a-zA-Z0-9_]*" maxLength={255} autoFocus={editor.mode === "create"} /></label>
      {editor.mode !== "value" && <><div className="infra-fieldset-label">作用域</div><div className="infra-actions">{envScopes.map(scope => <label className="infra-check" key={scope}><input type="checkbox" checked={scopes.includes(scope)} onChange={event => setScopes(current => event.target.checked ? [...current, scope] : current.filter(item => item !== scope))} />{scopeNames[scope]}</label>)}</div><label className="infra-check"><input type="checkbox" checked={secret} onChange={event => setSecret(event.target.checked)} />标记为 Netlify 密钥</label><small>细分作用域和密钥标记的可用性取决于 Netlify 套餐。</small></>}
      {values.map((value, index) => <div className="infra-env-value" key={index}><div className="infra-form-grid"><label>部署上下文<ManagementSelect label={`部署上下文 ${index + 1}`} value={value.context} disabled={busy} options={envContexts.map(context => ({ value: context, label: contextNames[context] }))} onChange={context => edit(index, { context: context as EnvContext, context_parameter: "" })} /></label>{value.context === "branch" && <label>分支名称<input required value={value.context_parameter ?? ""} onChange={event => edit(index, { context_parameter: event.target.value })} maxLength={255} /></label>}</div>
        <label>新变量值<textarea rows={3} value={value.value} onChange={event => edit(index, { value: event.target.value })} maxLength={32768} spellCheck={false} autoComplete="off" /></label>{values.length > 1 && <button type="button" className="infra-text-button infra-danger" onClick={() => setValues(current => current.filter((_, i) => i !== index))}>移除此上下文</button>}</div>)}
      {editor.mode !== "value" && <button type="button" className="button-secondary" onClick={() => setValues(current => [...current, { context: "production", value: "" }])}>添加上下文</button>}
    </fieldset>{error && <p className="infra-error" role="alert">{error}</p>}</form>
  </ManagementModal>;
}

export function NetlifyEnv({ siteId, writable }: { siteId: string; writable: boolean }) {
  const endpoint = `/api/infrastructure/netlify/${encodeURIComponent(siteId)}/env`;
  const resource = useManagementResource<{ variables: EnvVariable[] }>(endpoint);
  const [editor, setEditor] = useState<Editor | null>(null);
  const [deleting, setDeleting] = useState<{ variable: EnvVariable; valueId?: string; context?: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [closing, setClosing] = useState(false);
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);
  function openEditor(next: Editor) { setClosing(false); setEditor(next); }
  async function mutate(method: string, key?: string, input?: EnvInput | EnvValueInput, valueId?: string) {
    if (busy) return;
    setBusy(true); setMessage(null);
    try {
      await managementRequest(`${endpoint}${key ? `/${encodeURIComponent(key)}` : ""}${valueId ? `?valueId=${encodeURIComponent(valueId)}` : ""}`, method, input);
      setMessage({ text: method === "DELETE" ? "环境变量已删除。重新部署后生效。" : "环境变量已保存。重新构建和部署后生效。" });
    } catch (error) { setMessage({ text: `${(error as Error).message} 已重新读取变量配置，请核对结果。`, error: true }); }
    finally { setBusy(false); setClosing(true); resource.reload(); }
  }
  return <div className="infra-section"><div className="infra-toolbar"><div><h3>环境变量</h3><p className="infra-muted">仅显示名称和配置，所有已保存的值均隐藏。修改单个上下文会保留其他上下文。</p></div><div className="infra-actions"><button className="button-secondary" type="button" onClick={resource.reload} disabled={busy || resource.loading}>刷新变量</button>{writable && <button className="button-primary" type="button" onClick={() => openEditor({ mode: "create" })}>新增变量</button>}</div></div>
    <ActionMessage message={message} /><ResourceState {...resource} retry={resource.reload} />
    {resource.data && <div className="infra-env-list">{resource.data.variables.map(variable => <article className="infra-env-card" key={variable.key}><div className="infra-toolbar"><div><h4 className="infra-break">{variable.key}</h4><p className="infra-muted">{variable.is_secret ? "密钥" : "普通变量"} · {variable.scopes.map(scope => scopeNames[scope] ?? scope).join(" / ")}</p></div>{writable && <div className="infra-actions"><button className="infra-text-button" type="button" onClick={() => openEditor({ mode: "value", variable })}>添加或修改值</button><button className="infra-text-button" type="button" onClick={() => openEditor({ mode: "replace", variable })}>重设配置</button><button className="infra-text-button infra-danger" type="button" onClick={() => { setClosing(false); setDeleting({ variable }); }}>删除变量</button></div>}</div>
      {variable.values.map(value => <div className="infra-env-context" key={value.id}><span>{contextNames[value.context] ?? value.context}{value.context_parameter ? ` · ${value.context_parameter}` : ""}</span><span className="infra-hidden-value" aria-label="变量值已隐藏">••••••••</span>{writable && <div className="infra-actions"><button className="infra-text-button" type="button" onClick={() => openEditor({ mode: "value", variable, initial: value })}>修改值</button><button className="infra-text-button infra-danger" type="button" onClick={() => { setClosing(false); setDeleting({ variable, valueId: value.id, context: `${contextNames[value.context]} ${value.context_parameter ?? ""}` }); }}>删除上下文</button></div>}</div>)}
    </article>)}{!resource.data.variables.length && <p className="infra-empty">此项目尚未设置环境变量。</p>}</div>}
    {editor && <EnvEditor editor={editor} busy={busy} closing={closing} onClose={() => { if (!busy) setEditor(null); }} onSave={input => { void mutate(editor.mode === "create" ? "POST" : editor.mode === "value" ? "PATCH" : "PUT", editor.variable?.key, input); }} />}
    {deleting && <ManagementModal title={deleting.valueId ? "删除变量上下文？" : "删除环境变量？"} description="删除将在后续部署中生效。" busy={busy} closeRequested={closing} onClose={() => { if (!busy) setDeleting(null); }}
      footer={<><button className="button-secondary" type="button" data-close-modal disabled={busy}>取消</button><button className="button-primary" type="button" disabled={busy} onClick={() => { void mutate("DELETE", deleting.variable.key, undefined, deleting.valueId); }}>{busy ? "正在删除…" : "确认删除"}</button></>}><p className="infra-break">{deleting.variable.key}{deleting.context ? ` · ${deleting.context}` : "（全部上下文）"}</p></ManagementModal>}
  </div>;
}
