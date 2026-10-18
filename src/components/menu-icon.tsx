import type { RouteKey } from "@/lib/projects";

export function MenuIcon({ route }: { route: RouteKey }) {
  return <svg className="menu-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {route === "home" ? <><path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1Z" /><path d="M9 21v-8h6v8" /></>
      : route === "monitor" ? <><rect x="3" y="4" width="18" height="13" rx="2" /><path d="M8 21h8m-4-4v4M6 11h3l2-4 2 7 2-3h3" /></>
      : route === "ga4" ? <><path d="M4 3v17h17M8 15v-4m5 4V7m5 8V4" /></>
      : route === "features" ? <><path d="M4 7h8m6 0h2M4 17h2m6 0h8" /><circle cx="15" cy="7" r="3" /><circle cx="9" cy="17" r="3" /></>
      : route === "about" ? <><circle cx="12" cy="12" r="9" /><path d="M12 11v6m0-10v1" /></>
      : <><ellipse cx="12" cy="5" rx="8" ry="3" /><path d="M4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3" /></>}
  </svg>;
}
