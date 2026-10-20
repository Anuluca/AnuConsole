"use client";

import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { openDialog, closeDialog } from "@/lib/dialog";
import { infrastructureMessages } from "@/lib/infrastructure-contract";
import { ManagementButton } from "./management-button";
import { LoadingIndicator } from "../loading-indicator";

export async function managementRequest<T>(url: string, method = "GET", body?: unknown, signal?: AbortSignal): Promise<T> {
  try {
    const response = await fetch(url, { method, cache: "no-store", headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined, signal });
    if (response.redirected && new URL(response.url).pathname === "/login") {
      window.location.assign("/login");
      throw new Error("请重新登录。");
    }
    const data = await response.json();
    if (!response.ok) throw new Error(infrastructureMessages[data.error] ?? "操作未完成，请刷新后重试。");
    return data as T;
  } catch (error) {
    if (signal?.aborted) throw error;
    if (error instanceof Error && !["TypeError", "SyntaxError"].includes(error.name)) throw error;
    throw new Error(infrastructureMessages.request_failed);
  }
}

export function useManagementResource<T>(url: string | null) {
  const [revision, setRevision] = useState(0);
  const [state, setState] = useState<{ url: string | null; revision: number; data?: T; error?: string }>({ url: null, revision: -1 });
  const reload = useCallback(() => setRevision(value => value + 1), []);
  const replaceData = useCallback((data: T) => setState({ url, revision, data }), [url, revision]);
  useEffect(() => {
    if (!url) return;
    const controller = new AbortController();
    managementRequest<T>(url, "GET", undefined, controller.signal).then(data => {
      if (!controller.signal.aborted) setState({ url, revision, data });
    }).catch(error => {
      if (!controller.signal.aborted) setState({ url, revision, error: (error as Error).message });
    });
    return () => controller.abort();
  }, [url, revision]);
  // URL 或请求代数变化后立即丢弃旧结果，避免项目切换时显示、操作上一个项目的数据。
  const current = state.url === url && state.revision === revision;
  return { data: current ? state.data : undefined, error: current ? state.error : undefined, loading: !!url && (!current || (!state.data && !state.error)), reload, replaceData };
}

export function ResourceState({ loading, error, retry }: { loading?: boolean; error?: string; retry: () => void }) {
  if (error) return <div className="infra-notice infra-error" role="alert"><span>{error}</span><ManagementButton icon="refresh" type="button" onClick={retry}>重试</ManagementButton></div>;
  if (loading) return <LoadingIndicator label="正在读取数据" />;
  return null;
}
export function ActionMessage({ message }: { message: { text: string; error?: boolean } | null }) {
  return message && <p className={`infra-notice${message.error ? " infra-error" : ""}`} role={message.error ? "alert" : "status"}>{message.text}</p>;
}

export function ManagementSelect({ label, value, options, onChange, disabled = false }: {
  label: string; value: string; options: { value: string; label: string }[]; onChange: (value: string) => void; disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const listId = useId();
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false); };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [open]);
  useEffect(() => { if (open) root.current?.querySelector<HTMLElement>(`[data-index="${index}"]`)?.scrollIntoView({ block: "nearest" }); }, [index, open]);
  function choose(next: string) { onChange(next); setOpen(false); }
  return <div className="infra-select" ref={root} onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false); }} onKeyDown={event => {
    if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
      event.preventDefault();
      setOpen(true);
      setIndex(current => event.key === "Home" ? 0 : event.key === "End" ? options.length - 1 : !open ? Math.max(0, options.findIndex(option => option.value === value)) : (current + (event.key === "ArrowDown" ? 1 : -1) + options.length) % options.length);
    } else if (open && ["Enter", " "].includes(event.key)) { event.preventDefault(); choose(options[index].value); }
    else if (event.key === "Escape" && open) { event.preventDefault(); event.stopPropagation(); setOpen(false); }
  }}>
    <button type="button" className="infra-select-trigger" disabled={disabled} aria-label={label} aria-haspopup="listbox" aria-expanded={open} aria-controls={listId} aria-activedescendant={open ? `${listId}-${index}` : undefined}
      onClick={() => { setIndex(Math.max(0, options.findIndex(option => option.value === value))); setOpen(current => !current); }}><span>{options.find(option => option.value === value)?.label ?? value}</span><svg className="infra-select-chevron" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg></button>
    {open && <div className="infra-select-options" id={listId} role="listbox" tabIndex={-1} aria-activedescendant={`${listId}-${index}`} aria-label={label}>{options.map((option, optionIndex) =>
      <button key={option.value} type="button" role="option" tabIndex={-1} id={`${listId}-${optionIndex}`} data-index={optionIndex} aria-selected={value === option.value} data-highlighted={index === optionIndex}
        onPointerMove={() => setIndex(optionIndex)} onClick={() => choose(option.value)}>{option.label}</button>)}</div>}
  </div>;
}

export function ManagementModal({ title, children, footer, onClose, busy = false, description, closeRequested = false, danger = false }: {
  title: string; children: ReactNode; footer?: ReactNode; onClose: () => void; busy?: boolean; description?: string; closeRequested?: boolean; danger?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const motion = useRef<Animation | null>(null);
  const closing = useRef(false);
  const titleId = useId();
  const descriptionId = useId();
  useEffect(() => {
    const dialog = ref.current!;
    if (!dialog.open) openDialog(dialog);
    if (!matchMedia("(prefers-reduced-motion: reduce)").matches) motion.current = dialog.animate([{ opacity: 0, transform: "translateY(8px)" }, { opacity: 1, transform: "none" }], { duration: 180, easing: "ease-out" });
    return () => { motion.current?.cancel(); if (dialog.open) closeDialog(dialog); };
  }, []);
  async function dismiss() {
    const dialog = ref.current;
    if (!dialog || busy || closing.current) return;
    closing.current = true;
    motion.current?.cancel();
    if (!matchMedia("(prefers-reduced-motion: reduce)").matches) {
      const animation = dialog.animate([{ opacity: 1 }, { opacity: 0, transform: "translateY(6px)" }], { duration: 140, fill: "forwards" });
      motion.current = animation;
      await animation.finished.catch(() => {});
    }
    closeDialog(dialog);
    onClose();
  }
  useEffect(() => { if (closeRequested && !busy) void dismiss(); });
  return <dialog ref={ref} className={`infra-modal${danger ? " infra-modal-danger" : ""}`} aria-labelledby={titleId} aria-describedby={description ? descriptionId : undefined} onCancel={event => { event.preventDefault(); void dismiss(); }}>
    <header className="infra-modal-header"><h2 id={titleId}>{title}</h2><button type="button" className="infra-icon-button" disabled={busy} aria-label="关闭弹窗" onClick={() => { void dismiss(); }}>×</button></header>
    <div className="infra-modal-content">{description && <p className="infra-muted" id={descriptionId}>{description}</p>}{children}</div>
    {footer && <footer className="infra-modal-footer" onClickCapture={event => {
      if ((event.target as Element).closest("[data-close-modal]")) { event.preventDefault(); event.stopPropagation(); void dismiss(); }
    }}>{footer}</footer>}
  </dialog>;
}

export function Pagination({ page, hasNext, onChange, disabled = false }: { page: number; hasNext: boolean; onChange: (page: number) => void; disabled?: boolean }) {
  return <nav className="infra-pagination" aria-label="数据分页"><ManagementButton icon="left" type="button" disabled={disabled || page <= 1} onClick={() => onChange(page - 1)}>上一页</ManagementButton><span>第 {page} 页</span><ManagementButton icon="right" type="button" disabled={disabled || !hasNext} onClick={() => onChange(page + 1)}>下一页</ManagementButton></nav>;
}
export function displayDate(value?: string) {
  return value && Number.isFinite(Date.parse(value)) ? new Date(value).toLocaleString("zh-CN", { hour12: false }) : "—";
}
