"use client";

import React, { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { useRole, PRESET_STAFF_MEMBERS } from "@/components/layout/RoleContext";
import { UserRole } from "@/types";

const ROUTE_LABELS: Record<string, string> = {
  "/": "Dashboard",
  "/appointments": "Patient Booking & OPD Queue",
  "/patients": "Patient Records (PMI)",
  "/clinical": "Doctor Clinical Workspace",
  "/lab": "Diagnostic Laboratory (LIS)",
  "/pharmacy": "Pharmacy & Dispensing",
  "/billing": "Statement & Invoicing",
  "/admin": "Audit Log & System Admin",
};

interface TopbarProps {
  onMenuClick?: () => void;
  theme?: "light" | "dark";
  onToggleTheme?: () => void;
}

export default function Topbar({
  onMenuClick,
  theme = "light",
  onToggleTheme,
}: TopbarProps) {
  const pathname = usePathname();
  const { currentUser, switchRole } = useRole();

  const label =
    ROUTE_LABELS[pathname] ??
    (pathname.startsWith("/patients/") ? "Patient 360 Record" : "CIMS Clinical Care");

  const [actionsOpen, setActionsOpen] = useState(false);
  const [roleDropdownOpen, setRoleDropdownOpen] = useState(false);

  useEffect(() => {
    setActionsOpen(false);
    setRoleDropdownOpen(false);
  }, [pathname]);

  return (
    <header className="topbar">
      {/* Mobile Hamburger */}
      <button
        type="button"
        className="topbar-menu"
        onClick={onMenuClick}
        aria-label="Open navigation menu"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M3 6h18M3 12h18M3 18h18" />
        </svg>
      </button>

      {/* Page Title */}
      <div style={{ flex: 1 }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: "var(--text-on-primary)" }}>
          {label}
        </span>
      </div>

      {/* Right Side Actions */}
      <div className="topbar-actions">
        {/* Live Date in DM Mono */}
        <TopbarDate />

        {/* Staff Persona / Role Switcher Pill */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setRoleDropdownOpen(!roleDropdownOpen)}
            className="flex items-center gap-2 px-2.5 py-1 rounded-lg text-xs font-bold text-white bg-white/10 hover:bg-white/20 border border-white/20 transition cursor-pointer"
            title="Switch Staff Role"
          >
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span className="hidden sm:inline">{currentUser.name}</span>
            <span className="px-1.5 py-0.2 rounded bg-white/20 text-[10px] font-mono">
              {currentUser.role}
            </span>
          </button>

          {roleDropdownOpen && (
            <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-800 py-2 z-50 animate-in fade-in">
              <div className="px-3 py-1.5 border-b border-slate-100 dark:border-slate-800">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Switch Clinical Persona
                </p>
              </div>
              <div className="max-h-64 overflow-y-auto py-1">
                {(Object.keys(PRESET_STAFF_MEMBERS) as UserRole[]).map((role) => {
                  const staff = PRESET_STAFF_MEMBERS[role];
                  const isSelected = currentUser.role === role;
                  return (
                    <button
                      key={role}
                      onClick={() => {
                        switchRole(role);
                        setRoleDropdownOpen(false);
                      }}
                      className={`w-full px-3 py-2 text-left flex items-center justify-between text-xs transition hover:bg-slate-50 dark:hover:bg-slate-800 ${
                        isSelected
                          ? "bg-teal-50 dark:bg-slate-800/80 font-bold text-teal-800 dark:text-teal-300"
                          : "text-slate-700 dark:text-slate-300"
                      }`}
                    >
                      <span className="truncate">{staff.name}</span>
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 font-mono">
                        {role}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Dark / Light Theme Toggle */}
        <button
          type="button"
          className="topbar-icon-button"
          onClick={onToggleTheme}
          title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          aria-label="Toggle theme mode"
        >
          {theme === "dark" ? (
            <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="4" />
              <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
            </svg>
          ) : (
            <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
              <path d="M21 12.8A8.5 8.5 0 1 1 11.2 3a6.8 6.8 0 0 0 9.8 9.8z" />
            </svg>
          )}
        </button>
      </div>
    </header>
  );
}

function TopbarDate() {
  const [date, setDate] = useState("");

  useEffect(() => {
    setDate(
      new Date().toLocaleDateString("en-PK", {
        weekday: "short",
        day: "numeric",
        month: "short",
        year: "numeric",
        timeZone: "Asia/Karachi",
      })
    );
  }, []);

  return (
    <span
      className="topbar-date hidden sm:inline-block"
      style={{
        fontFamily: "var(--font-mono)",
        fontSize: 12,
        color: "rgba(255, 255, 255, 0.85)",
      }}
    >
      {date || "Loading..."}
    </span>
  );
}
