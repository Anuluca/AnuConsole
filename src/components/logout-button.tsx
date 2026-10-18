"use client";

import { useActionState, useEffect, useId, useRef, useState } from "react";
import { logout } from "@/app/actions";

type Phase = "closed" | "entering" | "open" | "leaving";

export function LogoutButton() {
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState<Phase>("closed");
  const dialog = useRef<HTMLDialogElement>(null);
  const motion = useRef<Animation | null>(null);
  const closing = useRef(false);
  const headingId = useId();
  const descriptionId = useId();

  async function dismiss() {
    const element = dialog.current;
    if (!element?.open || closing.current) return;
    closing.current = true;
    setPhase("leaving");
    const style = getComputedStyle(element);
    const from = { opacity: style.opacity, transform: style.transform };
    motion.current?.cancel();
    // 先播放退场，再关闭原生 dialog，保留焦点约束且不移动背景页面。
    if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      const animation = element.animate([from, { opacity: 0, transform: "translateY(7px) scale(.985)" }], {
        duration: 160, easing: "ease-in", fill: "forwards"
      });
      motion.current = animation;
      await animation.finished.catch(() => {});
    }
    element.close();
    setOpen(false);
    setPhase("closed");
    closing.current = false;
  }

  const [, action, pending] = useActionState(async () => { await dismiss(); await logout(); }, undefined);
  const busy = pending || phase === "leaving";

  useEffect(() => {
    const element = dialog.current;
    if (!open || !element) return;
    if (!element.open) element.showModal();
    closing.current = false;
    setPhase("entering");
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setPhase("open");
      return;
    }
    const animation = element.animate([
      { opacity: 0, transform: "translateY(10px) scale(.985)" },
      { opacity: 1, transform: "none" }
    ], { duration: 200, easing: "cubic-bezier(.2,.7,.2,1)" });
    motion.current = animation;
    animation.finished.then(() => { if (!closing.current) setPhase("open"); }).catch(() => {});
    return () => { motion.current?.cancel(); };
  }, [open]);

  return <>
    <button className="logout" type="button" onClick={() => setOpen(true)}>退出 <span aria-hidden="true">↗</span></button>
    <dialog ref={dialog} data-phase={phase} className="confirm-dialog" role="alertdialog" aria-labelledby={headingId} aria-describedby={descriptionId}
      onCancel={event => { event.preventDefault(); if (!busy) void dismiss(); }}
      onClose={() => { setOpen(false); setPhase("closed"); closing.current = false; }}>
      <h2 id={headingId}>退出登录？</h2>
      <p id={descriptionId}>退出后将返回登录页。</p>
      <form action={action} className="confirm-actions">
        <button className="button-secondary" type="button" autoFocus disabled={busy} onClick={() => { void dismiss(); }}>取消</button>
        <button className="button-primary" type="submit" disabled={busy}>{pending ? "正在退出…" : "确认退出"}</button>
      </form>
    </dialog>
  </>;
}
