export type ThemeMode = "auto" | "light" | "dark";
export const THEME_STORAGE_KEY = "anuconsole-theme";

export function isThemeMode(value: unknown): value is ThemeMode {
  return value === "auto" || value === "light" || value === "dark";
}

export function timeTheme(date = new Date()): "light" | "dark" {
  const hour = date.getHours();
  return hour >= 7 && hour < 19 ? "light" : "dark";
}

export function nextThemeBoundary(date = new Date()): number {
  const next = new Date(date);
  const hour = date.getHours();
  next.setHours(hour < 7 ? 7 : hour < 19 ? 19 : 31, 0, 0, 0);
  return next.getTime() - date.getTime();
}

// 在浏览器绘制页面前设置主题，避免夜间刷新时先闪出浅色背景。
// 与客户端共用判断函数，确保时间边界及无效配置的处理保持一致。
export const THEME_INIT_SCRIPT = `(()=>{let mode="auto";try{const saved=localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});if((${isThemeMode.toString()})(saved))mode=saved}catch{}const root=document.documentElement;root.dataset.themeMode=mode;root.dataset.theme=mode==="auto"?(${timeTheme.toString()})():mode})()`;
