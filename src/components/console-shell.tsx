"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { usePathname } from "next/navigation";
import { Brand, Arrow } from "./brand";
import { ThemeSwitch } from "./theme-provider";
import { MenuIcon } from "./menu-icon";
import { LogoutButton } from "./logout-button";
import { ProjectSwitcher } from "./project-switcher";
import { projectFromPath, type RouteItem } from "@/lib/projects";

export function ConsoleShell({ children, developmentMode = false }: { children: React.ReactNode; developmentMode?: boolean }) {
  const pathname = usePathname();
  const project = projectFromPath(pathname);
  const routes = project.routes;
  const [monitorOpen, setMonitorOpen] = useState(true);
  const [mobile, setMobile] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menu = useRef<HTMLDialogElement>(null);
  const menuMotion = useRef<Animation | null>(null);
  const menuClosing = useRef(false);
  useEffect(() => () => { menuMotion.current?.cancel(); }, []);

  function openMenu() {
    const element = menu.current;
    if (!element || element.open) return;
    menuMotion.current?.cancel();
    menuClosing.current = false;
    element.showModal();
    setMenuOpen(true);
    if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      menuMotion.current = element.animate([{ opacity: 0 }, { opacity: 1 }], {
        duration: 200, easing: "ease-out"
      });
    }
  }

  async function closeMenu() {
    const element = menu.current;
    if (!element?.open || menuClosing.current) return;
    menuClosing.current = true;
    const opacity = getComputedStyle(element).opacity;
    menuMotion.current?.cancel();
    // 保留原生菜单和焦点约束，退场完成后再关闭。
    if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      const animation = element.animate([{ opacity }, { opacity: 0 }], {
        duration: 160, easing: "ease-in", fill: "forwards"
      });
      menuMotion.current = animation;
      await animation.finished.catch(() => {});
    }
    element.close();
    menuMotion.current?.cancel();
    menuClosing.current = false;
    setMenuOpen(false);
  }
  useEffect(() => {
    const query = window.matchMedia("(max-width: 700px)");
    const sync = () => {
      setMobile(query.matches);
      if (!query.matches) { menu.current?.close(); setMenuOpen(false); }
    };
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);
  const group = routes.find(route => route.children?.some(child => child.href === pathname));
  const current = group?.children?.find(route => route.href === pathname) ?? routes.find(route => route.href === pathname) ?? routes[0];
  const renderLink = (route: RouteItem, child = false) => <Link key={route.href} href={route.href} onClick={() => { void closeMenu(); }} aria-current={pathname === route.href ? "page" : undefined} className={`nav-item${child ? " nav-child" : ""}${pathname === route.href ? " active" : ""}`}>
    <MenuIcon route={route.key} />
    <span className="nav-label">{route.label}</span>
  </Link>;
  const navigation = <nav aria-label="主导航">
          {routes.map(route => route.children ? <div className="nav-group" key={route.href}>
            <button className="nav-item nav-group-toggle" type="button" aria-expanded={monitorOpen} aria-controls="monitor-navigation" data-active={group?.href === route.href} onClick={() => setMonitorOpen(open => !open)}>
              <MenuIcon route={route.key} />
              <span className="nav-label">{route.label}</span>
              <svg className="nav-group-chevron" width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="m4 6 4 4 4-4" stroke="currentColor" strokeWidth="1.5" /></svg>
            </button>
            {monitorOpen && <div className="nav-group-list" id="monitor-navigation">{route.children.map(child => renderLink(child, true))}</div>}
          </div> : renderLink(route))}
        </nav>;
  return <div className="console" data-project={project.id} style={{ "--accent": project.accent, "--on-accent": project.onAccent } as CSSProperties}>
    <a href="#main-content" className="skip-link">跳转到内容</a>
    <header className="topbar">
      <div className="topbar-projects"><Brand href={`/${project.id}`} /><ProjectSwitcher current={project.id} mobile={mobile} /></div>
      <div className="topbar-right">
        {project.siteUrl && <a className="site-link" href={project.siteUrl} target="_blank" rel="noreferrer">访问 {project.title} <Arrow diagonal /></a>}
        {!mobile && <ThemeSwitch />}
        {!developmentMode && <span className="account"><span className="status-dot" />admin<span className="account-role">管理员</span></span>}
        <LogoutButton />
        <button className="mobile-menu-trigger" type="button" aria-label="打开菜单" aria-expanded={menuOpen} aria-controls="mobile-navigation" onClick={openMenu}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16" /></svg>
        </button>
      </div>
    </header>
    <dialog id="mobile-navigation" className="mobile-menu" aria-labelledby="mobile-navigation-title" ref={menu} onCancel={event => { event.preventDefault(); void closeMenu(); }} onClose={() => setMenuOpen(false)}>
      <div className="mobile-menu-header"><h2 id="mobile-navigation-title">菜单</h2><button className="mobile-menu-close" type="button" aria-label="关闭菜单" onClick={() => { void closeMenu(); }}><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="m5 5 14 14M19 5 5 19" /></svg></button></div>
      {mobile && navigation}
    </dialog>
    <div className="console-body">
      <aside className="sidebar">
        {!mobile && navigation}
      </aside>
      <main id="main-content" className="main-content">
        <div className="route-view" key={pathname}>
          <div className="route-header">
            <nav className="breadcrumb" aria-label="面包屑"><span>{project.title}</span><span aria-hidden="true">/</span>{group && <><span>{group.label}</span><span aria-hidden="true">/</span></>}<span aria-current="page">{current.label}</span></nav>
            <div className="page-heading">
              <h1>{current.label}</h1>
              <div id="route-heading-status" className="route-heading-status" />
            </div>
          </div>
          <div className="route-scroll" role="region" aria-label="页面内容" tabIndex={0}>
            <div className="route-content">{children}</div>
          </div>
        </div>
        <footer className="console-footer mono">{mobile && <ThemeSwitch />}<span>© {new Date().getFullYear()} ANUCONSOLE</span></footer>
      </main>
    </div>
  </div>;
}
