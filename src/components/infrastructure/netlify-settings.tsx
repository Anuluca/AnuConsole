"use client";

import { useId, useState, type FormEvent } from "react";
import { buildFields, object, siteFields, validateSiteSettings, type JsonObject, type SettingField } from "@/lib/infrastructure-contract";
import { ManagementModal } from "./ui";

export function NetlifySettings({ settings, writable, busy, onSave }: { settings: JsonObject; writable: boolean; busy: boolean; onSave: (patch: JsonObject) => Promise<boolean> }) {
  const [patch, setPatch] = useState<JsonObject>({});
  const [advanced, setAdvanced] = useState(false);
  const [source, setSource] = useState("{}");
  const [error, setError] = useState("");
  const [confirm, setConfirm] = useState<JsonObject | null>(null);
  const [closing, setClosing] = useState(false);
  const formId = useId();
  function change(key: string, value: unknown, group?: string) {
    if (!group && siteFields[key]?.secret && value === "") {
      setPatch(current => { const next = { ...current }; delete next[key]; return next; });
      return;
    }
    setPatch(current => group ? { ...current, [group]: { ...(object(current[group]) ? current[group] : {}), [key]: value } } : { ...current, [key]: value });
  }
  function field(key: string, definition: SettingField, group?: string) {
    const base = group ? (object(settings[group]) ? settings[group] : {}) : settings;
    const changes = group ? (object(patch[group]) ? patch[group] : {}) : patch;
    const value = Object.hasOwn(changes, key) ? changes[key] : base[key];
    const label = `${group ? "构建设置：" : ""}${definition.label}`;
    return <label key={key} className={definition.kind === "boolean" ? "infra-check" : undefined}>
      {definition.kind === "boolean" ? <><input type="checkbox" checked={value === true} onChange={event => change(key, event.target.checked, group)} />{definition.label}</> : <>{definition.label}
        {definition.kind === "strings" ? <textarea aria-label={label} rows={3} value={Array.isArray(value) ? value.join("\n") : ""} onChange={event => change(key, event.target.value.split("\n").map(item => item.trim()).filter(Boolean), group)} />
          : <input aria-label={label} type={definition.secret ? "password" : definition.kind === "integer" ? "number" : "text"} autoComplete="off" min={definition.kind === "integer" ? 0 : undefined}
            value={typeof value === "string" || typeof value === "number" ? value : ""}
            onChange={event => change(key, definition.kind === "integer" ? Number(event.target.value) : event.target.value, group)} />}
        {(definition.help || definition.kind === "strings") && <small>{definition.help ?? "每行一项。"}</small>}</>}
    </label>;
  }
  function submit(event: FormEvent) {
    event.preventDefault();
    try {
      const candidate = validateSiteSettings(advanced ? JSON.parse(source) : patch);
      setConfirm(candidate); setClosing(false); setError("");
    } catch { setError("请至少修改一项，并检查字段格式。高级模式只接受文档列出的配置字段。"); }
  }
  async function save() {
    if (!confirm || busy) return;
    try { if (await onSave(confirm)) { setPatch({}); setSource("{}"); } }
    finally { setClosing(true); }
  }
  const pretty = object(patch.processing_settings) ? patch.processing_settings : object(settings.processing_settings) ? settings.processing_settings : {};
  return <>
    <form className="infra-form" id={formId} onSubmit={submit}>
      <div className="infra-toolbar"><div><h3>项目设置</h3><p className="infra-muted">字段是否可用由 Netlify 权限和套餐决定。仓库中的 netlify.toml 会覆盖对应构建设置。</p></div><div className="infra-actions"><button type="button" className="button-secondary" onClick={() => { setAdvanced(value => !value); setSource(JSON.stringify(patch, null, 2)); }}>{advanced ? "返回表单" : "高级编辑"}</button></div></div>
      <fieldset disabled={!writable || busy}>
        {advanced ? <label>配置变更 JSON<textarea className="infra-code" rows={18} spellCheck={false} value={source} onChange={event => setSource(event.target.value)} /><small>只提交需要修改的字段。支持 siteSetup 中的项目配置、build_settings、repo 和 processing_settings。</small></label>
          : <><h4>基本配置与域名</h4><div className="infra-form-grid">{Object.entries(siteFields).map(([key, definition]) => field(key, definition))}</div>
            <h4>构建与部署</h4><div className="infra-form-grid">{Object.entries(buildFields).slice(0, 8).map(([key, definition]) => field(key, definition, "build_settings"))}
              <label className="infra-check"><input type="checkbox" checked={object(pretty.html) && pretty.html.pretty_urls === true} onChange={event => setPatch(current => ({ ...current, processing_settings: { html: { pretty_urls: event.target.checked } } }))} />HTML 美化 URL</label></div>
            <details className="infra-details"><summary>Git 仓库连接配置</summary><p className="infra-muted">更换仓库前需在 Netlify 授权对应 Git 提供方；仅填写此处字段不会授予仓库访问权限。</p><div className="infra-form-grid">{Object.entries(buildFields).slice(8).map(([key, definition]) => field(key, definition, "build_settings"))}</div></details></>}
      </fieldset>
      {error && <p className="infra-error" role="alert">{error}</p>}
      <div className="infra-actions"><a className="infra-text-link" href="https://open-api.netlify.com/#tag/site/operation/updateSite" target="_blank" rel="noreferrer">查看可用配置字段 ↗</a>{writable && <button className="button-primary" type="submit" disabled={busy}>保存设置</button>}</div>
    </form>
    {confirm && <ManagementModal title="保存项目设置？" busy={busy} closeRequested={closing} onClose={() => setConfirm(null)} description="修改域名、仓库或构建配置可能影响后续部署。"
      footer={<><button className="button-secondary" type="button" data-close-modal disabled={busy}>取消</button><button className="button-primary" type="button" disabled={busy} onClick={() => { void save(); }}>{busy ? "正在保存…" : "确认保存"}</button></>}>
      <p>此次修改：{Object.keys(confirm).map(key => siteFields[key]?.label ?? (key === "build_settings" ? "构建设置" : key === "repo" ? "仓库连接" : "HTML 处理设置")).join("、")}。</p>
    </ManagementModal>}
  </>;
}
