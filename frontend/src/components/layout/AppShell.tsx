"use client";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";
import { useRole } from "./RoleContext";
import { canAccess, permissionForPath } from "@/lib/permissions";
export function AppShell({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [sidebarTransitioning, setSidebarTransitioning] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const pathname = usePathname();
  const { currentUser, ready } = useRole();
  const transitionTimer = useRef<number | null>(null);
  useEffect(() => {
    const close = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, []);
  useEffect(() => {
    if (!ready || pathname === "/login") return;
    if (!sessionStorage.getItem("cims-user")) window.location.replace("/login");
  }, [ready, pathname]);
  useEffect(() => {
    const saved = window.localStorage.getItem("cims-theme");
    const dark = saved === "dark" || (!saved && window.matchMedia("(prefers-color-scheme: dark)").matches);
    setDarkMode(dark);
    document.documentElement.dataset.theme = dark ? "dark" : "light";
  }, []);
  const toggleTheme = () => setDarkMode(current => {
    const next = !current;
    document.documentElement.dataset.theme = next ? "dark" : "light";
    window.localStorage.setItem("cims-theme", next ? "dark" : "light");
    return next;
  });
  useEffect(() => () => {
    if (transitionTimer.current !== null) window.clearTimeout(transitionTimer.current);
  }, []);
  useEffect(() => {
    const media = window.matchMedia("(min-width: 1025px)");
    const closeDrawerOnDesktop = () => { if (media.matches) setOpen(false); };
    media.addEventListener("change", closeDrawerOnDesktop);
    return () => media.removeEventListener("change", closeDrawerOnDesktop);
  }, []);
  if (pathname === "/login") return <>{children}</>;
  const toggleSidebar = () => {
    if (!window.matchMedia("(min-width: 1025px)").matches || sidebarTransitioning) return;
    setSidebarTransitioning(true);
    setCollapsed(value => !value);
    if (transitionTimer.current !== null) window.clearTimeout(transitionTimer.current);
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    transitionTimer.current = window.setTimeout(() => {
      setSidebarTransitioning(false);
      transitionTimer.current = null;
    }, reduceMotion ? 0 : 300);
  };
  return <div className={"app-layout " + (collapsed ? "sidebar-collapsed " : "") + (sidebarTransitioning ? "sidebar-transitioning" : "")}>
    <a href="#page-content" className="skip-link">Skip to content</a>
    <Sidebar open={open} collapsed={collapsed} onToggleCollapse={toggleSidebar} onClose={() => setOpen(false)} />
    <div className="app-main">
      <Header onMenu={() => setOpen(value => !value)} menuOpen={open} darkMode={darkMode} onToggleTheme={toggleTheme} />
      <main id="page-content" className="page-content" tabIndex={-1}>{canAccess(currentUser.role, currentUser.permissions || [], permissionForPath(pathname)) ? children : <section className="access-denied"><h1>Access restricted</h1><p>Your account does not have permission to open this module. Contact a Super User if you need access.</p></section>}</main>
    </div>
  </div>;
}
