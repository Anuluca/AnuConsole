"use client";

import { useActionState, useState } from "react";
import { login } from "@/app/actions";
import { Arrow } from "./brand";

export function LoginForm({ configured }: { configured: boolean }) {
  const [state, action, pending] = useActionState(login, { error: "" });
  const [visible, setVisible] = useState(false);
  return <form action={action} className="login-form">
    <label htmlFor="username">登录账号</label>
    <input id="username" name="username" autoComplete="username" defaultValue="admin" required maxLength={64} spellCheck={false} autoCapitalize="none" />
    <label htmlFor="password">登录密码</label>
    <div className="password-field"><input id="password" name="password" type={visible ? "text" : "password"} placeholder="请输入密码" autoComplete="current-password" required maxLength={256} aria-describedby="login-error" />
      <button className="password-toggle" type="button" aria-label={visible ? "隐藏密码" : "显示密码"} aria-pressed={visible} onClick={() => setVisible(!visible)}>
        <svg width="19" height="19" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" stroke="currentColor" strokeWidth="1.5" /><circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.5" />{visible && <path d="m3 3 18 18" stroke="currentColor" strokeWidth="1.5" />}</svg>
      </button>
    </div>
    <div id="login-error" className="login-message" aria-live="polite" role="status">{state.error || (!configured ? "管理员尚未配置，请运行 npm run setup:admin。" : "")}</div>
    <button className="login-submit" type="submit" disabled={pending || !configured}><span>{pending ? "正在验证…" : "登录"}</span><Arrow /></button>
  </form>;
}
