"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { projects, type ProjectId } from "@/lib/projects";

export function ProjectSwitcher({ current, mobile }: { current: ProjectId; mobile: boolean }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const menuId = useId();
  const project = projects.find(item => item.id === current)!;

  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [open]);

  return <div className="project-switcher" ref={root} onKeyDown={event => {
    if (event.key === "Escape" && open) {
      event.preventDefault();
      setOpen(false);
      trigger.current?.focus();
    }
  }}>
    <button ref={trigger} className="project-current" type="button" aria-label={`当前项目：${project.title}，切换项目`}
      aria-expanded={open} aria-controls={open ? menuId : undefined} onClick={() => setOpen(value => !value)}>
      <span>{project.title}</span>
      <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="m5 3 5 5-5 5" stroke="currentColor" strokeWidth="1.5" /></svg>
    </button>
    {open && <nav id={menuId} className="project-options" aria-label="切换项目">
      {projects.map(item => <Link key={item.id} href={`/${item.id}`} aria-current={item.id === current ? "page" : undefined}
        className="project-option" onClick={() => { if (mobile) setOpen(false); }}>
        {item.title}
      </Link>)}
    </nav>}
  </div>;
}
