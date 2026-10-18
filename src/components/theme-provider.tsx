"use client";

import { createContext, useContext, useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { isThemeMode, nextThemeBoundary, THEME_STORAGE_KEY, timeTheme, type ThemeMode } from "@/lib/theme";

const ThemeContext = createContext<{ mode: ThemeMode | null; changeMode: (mode: ThemeMode) => void }>({ mode: null, changeMode: () => {} });

function savedMode(): ThemeMode {
  try {
    const value = localStorage.getItem(THEME_STORAGE_KEY);
    if (isThemeMode(value)) return value;
  } catch { /* 禁用本地存储时，仍支持当前页面内切换。 */ }
  return "auto";
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setMode] = useState<ThemeMode | null>(null);

  useEffect(() => {
    setMode(savedMode());
    const sync = (event: StorageEvent) => {
      if (event.key === THEME_STORAGE_KEY || event.key === null) setMode(savedMode());
    };
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);

  useEffect(() => {
    if (!mode) return;
    let timer: ReturnType<typeof setTimeout>;
    const apply = () => {
      clearTimeout(timer);
      document.documentElement.dataset.themeMode = mode;
      document.documentElement.dataset.theme = mode === "auto" ? timeTheme() : mode;
      // 精确安排下一次昼夜边界；恢复后台页面时也重新校准时间。
      if (mode === "auto") timer = setTimeout(apply, nextThemeBoundary());
    };
    apply();
    window.addEventListener("focus", apply);
    document.addEventListener("visibilitychange", apply);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("focus", apply);
      document.removeEventListener("visibilitychange", apply);
    };
  }, [mode]);

  const changeMode = (value: ThemeMode) => {
    setMode(value);
    try { localStorage.setItem(THEME_STORAGE_KEY, value); } catch { /* 当前页面继续使用所选主题。 */ }
  };

  return <ThemeContext.Provider value={{ mode, changeMode }}>{children}</ThemeContext.Provider>;
}

const themeOptions: { value: ThemeMode; label: string }[] = [
  { value: "auto", label: "自动" }, { value: "light", label: "浅色" }, { value: "dark", label: "深色" }
];

function ThemeIcon({ mode }: { mode: ThemeMode }) {
  // 三种模式共用固定图标尺寸，保证下拉项和触发按钮的文字起点一致。
  return <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
    {mode === "light" ? <><circle cx="10" cy="10" r="3.3" /><path d="M10 1.5v2m0 13v2M1.5 10h2m13 0h2M4 4l1.4 1.4m9.2 9.2L16 16M4 16l1.4-1.4m9.2-9.2L16 4" /></>
      : mode === "dark" ? <path d="M17.3 12.6A7.4 7.4 0 0 1 7.4 2.7a7.4 7.4 0 1 0 9.9 9.9Z" />
      : <><circle cx="10" cy="10" r="6.5" /><path d="M10 3.5a6.5 6.5 0 0 1 0 13Z" fill="currentColor" stroke="none" /></>}
  </svg>;
}

export function ThemeSwitch() {
  const { mode, changeMode } = useContext(ThemeContext);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const options = useRef<(HTMLButtonElement | null)[]>([]);
  const menuId = useId();
  const selected = themeOptions.findIndex(option => option.value === (mode ?? "auto"));

  useEffect(() => {
    if (!open) return;
    const dismiss = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", dismiss);
    return () => document.removeEventListener("pointerdown", dismiss);
  }, [open]);

  useEffect(() => { if (open) options.current[active]?.focus(); }, [open, active]);

  function keyboard(event: KeyboardEvent) {
    if (event.key === "Escape" && open) {
      event.preventDefault();
      setOpen(false);
      trigger.current?.focus();
    } else if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
      event.preventDefault();
      setActive(event.key === "Home" ? 0 : event.key === "End" ? 2 : !open ? selected : (active + (event.key === "ArrowDown" ? 1 : 2)) % 3);
      setOpen(true);
    }
  }

  return <div className="theme-switch" ref={root} onKeyDown={keyboard} onBlurCapture={event => {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false);
  }}>
    <button ref={trigger} className="theme-trigger" type="button" aria-label="显示主题" aria-haspopup="listbox" aria-expanded={open} aria-controls={open ? menuId : undefined}
      disabled={mode === null} title="自动模式：本地时间 07:00–19:00 为浅色，其余时间为深色"
      onClick={() => { setActive(selected); setOpen(!open); }}>
      <ThemeIcon mode={mode ?? "auto"} /><span>{themeOptions[selected].label}</span>
      <svg className="theme-chevron" width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="m4 6 4 4 4-4" stroke="currentColor" strokeWidth="1.5" /></svg>
    </button>
    {open && <div id={menuId} role="listbox" aria-label="主题选项" className="theme-menu">
      {themeOptions.map((option, index) => <button key={option.value} ref={element => { options.current[index] = element; }} type="button" role="option" aria-selected={option.value === mode}
        tabIndex={active === index ? 0 : -1} className="theme-option" onClick={() => { changeMode(option.value); setOpen(false); trigger.current?.focus(); }}>
        <ThemeIcon mode={option.value} /><span>{option.label}</span>
        {mode === option.value && <svg className="theme-check" width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="m3 8 3 3 7-7" stroke="currentColor" strokeWidth="1.5" /></svg>}
      </button>)}
    </div>}
  </div>;
}
