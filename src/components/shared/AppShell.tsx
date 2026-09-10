"use client";

import React, { useEffect, useState } from "react";
import Sidebar from "@/components/shared/Sidebar";
import Topbar from "@/components/shared/Topbar";

interface AppShellProps {
  children: React.ReactNode;
}

export default function AppShell({ children }: AppShellProps) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [themeReady, setThemeReady] = useState(false);

  useEffect(() => {
    const savedTheme = (localStorage.getItem("cims-theme") as "light" | "dark") || "light";
    setTheme(savedTheme);
    document.documentElement.dataset.theme = savedTheme;
    setThemeReady(true);
  }, []);

  const toggleTheme = () => {
    const nextTheme = theme === "dark" ? "light" : "dark";
    setTheme(nextTheme);
    document.documentElement.dataset.theme = nextTheme;
    localStorage.setItem("cims-theme", nextTheme);
  };

  const toggleSidebarCollapse = () => {
    setSidebarCollapsed((prev) => !prev);
  };

  return (
    <div
      className={`layout ${mobileNavOpen ? "mobile-nav-open" : ""} ${
        sidebarCollapsed ? "sidebar-collapsed" : ""
      }`}
    >
      {/* Floating Sidebar */}
      <Sidebar
        mobileOpen={mobileNavOpen}
        onClose={() => setMobileNavOpen(false)}
        onToggleCollapse={toggleSidebarCollapse}
      />

      {/* Mobile Backdrop */}
      {mobileNavOpen && (
        <button
          type="button"
          className="mobile-backdrop"
          style={{ opacity: 1, pointerEvents: "auto" }}
          onClick={() => setMobileNavOpen(false)}
          aria-label="Close menu"
        />
      )}

      {/* Main Content Area */}
      <main className="main">
        <Topbar
          onMenuClick={() => setMobileNavOpen(true)}
          theme={theme}
          onToggleTheme={toggleTheme}
        />
        <div className="page-content">{children}</div>
      </main>
    </div>
  );
}
