"use client";

import { useActionState, useState, type KeyboardEvent } from "react";
import { guestLogin, login } from "@/app/actions";
import { Arrow } from "./brand";

export function LoginForm({ configured }: { configured: boolean }) {
  const [mode, setMode] = useState<"guest" | "admin">("guest");
  function tabKeyboard(event: KeyboardEvent) {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const next = event.key === "Home" ? 0 : event.key === "End" ? 1 : mode === "guest" ? 1 : 0;
    setMode(next === 0 ? "guest" : "admin");
  }
  return <div className="login-access" data-mode={mode}>
    <div className="login-tabs" role="tablist" aria-label="登录方式">
      {(["guest", "admin"] as const).map(tab => <button key={tab}
        id={`login-tab-${tab}`} type="button" role="tab" aria-selected={mode === tab} aria-controls={`login-panel-${tab}`}
        tabIndex={mode === tab ? 0 : -1} onClick={() => setMode(tab)} onKeyDown={tabKeyboard}>
        {tab === "guest" ? "游客" : "管理员"}
      </button>)}
    </div>
    {/* 两个面板共用网格单元，隐藏面板仍参与高度计算，避免切换时布局移动。 */}
    <div className="login-panels">
      {(["guest", "admin"] as const).map(tab => <div key={tab} id={`login-panel-${tab}`} role="tabpanel" aria-labelledby={`login-tab-${tab}`} hidden={mode !== tab} inert={mode !== tab}>
        <AccessForm key={`${tab}-${mode === tab}`} configured={configured} guest={tab === "guest"} />
      </div>)}
    </div>
  </div>;
}

function AccessForm({ configured, guest }: { configured: boolean; guest: boolean }) {
  // 按入口独立保存提交状态，切换标签时清除密码与上一次错误。
  const [state, action, pending] = useActionState(guest ? guestLogin : login, { error: "" });
  const [visible, setVisible] = useState(false);
  const errorId = guest ? "guest-login-error" : "login-error";
  return <form action={action} className="login-form">
    {!guest && <>
    <label htmlFor="username">登录账号</label>
    <input id="username" name="username" autoComplete="username" defaultValue="admin" required maxLength={64} spellCheck={false} autoCapitalize="none" />
    <label htmlFor="password">登录密码</label>
    <div className="password-field"><input id="password" name="password" type={visible ? "text" : "password"} placeholder="请输入密码" autoComplete="current-password" required maxLength={256} aria-describedby="login-error" />
      <button className="password-toggle" type="button" aria-label={visible ? "隐藏密码" : "显示密码"} aria-pressed={visible} onClick={() => setVisible(!visible)}>
        <svg width="19" height="19" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" stroke="currentColor" strokeWidth="1.5" /><circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.5" />{visible && <path d="m3 3 18 18" stroke="currentColor" strokeWidth="1.5" />}</svg>
      </button>
    </div>
    </>}
    <div id={errorId} className="login-message" aria-live="polite" role="status">{state.error || (!configured ? "管理员尚未配置，请运行 npm run setup:admin。" : "")}</div>
    <button className="login-submit" type="submit" disabled={pending || !configured}><span>{pending ? (guest ? "正在进入…" : "正在验证…") : guest ? "游客访问" : "登录"}</span><Arrow /></button>
  </form>;
}
