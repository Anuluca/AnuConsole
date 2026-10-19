"use client";

import { type ButtonHTMLAttributes } from "react";

const paths = {"refresh": "M20 7v5h-5M4 17v-5h5M6 7a7 7 0 0 1 12-2l2 2M4 17l2 2a7 7 0 0 0 12-2", "add": "M12 5v14M5 12h14", "edit": "m16 3 5 5-12 12-6 1 1-6ZM14 5l5 5", "delete": "M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7", "close": "m6 6 12 12M18 6 6 18", "check": "m5 12 4 4L19 6", "search": "M21 21l-5-5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0", "settings": "M4 7h16M4 17h16M8 4v6M16 14v6", "deploy": "m5 12 7-9 7 9-7-3ZM12 9v12", "left": "m14 5-7 7 7 7", "right": "m10 5 7 7-7 7", "details": "M4 5h16v14H4ZM8 9h8M8 13h8"} as const;
export type ActionIconName = keyof typeof paths;
export function ActionIcon({ name }: { name: ActionIconName }) {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name]} /></svg>;
}

// 运维操作统一使用此组件，后续新增按钮自动继承字号、字重及左侧图标。
export function ManagementButton({ icon = "settings", children, className = "button-secondary", ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { icon?: ActionIconName }) {
  return <button {...props} className={`infra-action-button ${className}`}><ActionIcon name={icon} />{children}</button>;
}
