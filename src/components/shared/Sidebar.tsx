"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRole } from "@/components/layout/RoleContext";

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType;
}

interface NavSection {
  section: string;
  items: NavItem[];
}

const NAV_SECTIONS: NavSection[] = [
  {
    section: "Overview",
    items: [
      { label: "Dashboard", href: "/", icon: IconDashboard },
    ],
  },
  {
    section: "Outpatient & EMR",
    items: [
      { label: "Patient Booking", href: "/appointments", icon: IconBooking },
      { label: "Patient Records", href: "/patients", icon: IconPatients },
      { label: "Doctor Workspace", href: "/clinical", icon: IconDoctor },
    ],
  },
  {
    section: "Diagnostics & Meds",
    items: [
      { label: "Diagnostic Lab (LIS)", href: "/lab", icon: IconLab },
      { label: "Pharmacy & Stocks", href: "/pharmacy", icon: IconPharmacy },
    ],
  },
  {
    section: "Finances",
    items: [
      { label: "Billing & Statement", href: "/billing", icon: IconFinance },
    ],
  },
  {
    section: "Administration",
    items: [
      { label: "Audit Log & Users", href: "/admin", icon: IconAdmin },
    ],
  },
];

interface SidebarProps {
  mobileOpen?: boolean;
  onClose?: () => void;
  onToggleCollapse?: () => void;
}

export default function Sidebar({
  mobileOpen = false,
  onClose,
  onToggleCollapse,
}: SidebarProps) {
  const pathname = usePathname();
  const { currentUser } = useRole();

  const getInitials = (name: string) => {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    const first = parts[0]?.[0] ?? "C";
    const second = parts.length > 1 ? parts[parts.length - 1]?.[0] : "";
    return `${first}${second}`.toUpperCase();
  };

  return (
    <aside className={`sidebar ${mobileOpen ? "open" : ""}`}>
      {/* Brand / Logo */}
      <div className="sidebar-logo">
        <button
          type="button"
          className="flex items-center gap-3 w-full border-0 bg-transparent text-left cursor-pointer p-0 select-none"
          onClick={onToggleCollapse}
          aria-label="Toggle sidebar collapse"
        >
          <div className="sidebar-logo-icon">
            <span className="font-mono font-bold tracking-tight">C+</span>
          </div>
          <div className="sidebar-brand-copy">
            <span className="sidebar-logo-text">CIMS Clinical Care</span>
            <span className="sidebar-logo-sub">Integrated Health System</span>
          </div>
        </button>

        <button
          type="button"
          className="sidebar-close"
          onClick={onClose}
          aria-label="Close menu"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Navigation Sections */}
      <nav className="sidebar-nav">
        {NAV_SECTIONS.map((group) => (
          <div className="sidebar-nav-group" key={group.section}>
            <div className="sidebar-section-label">
              <span className="sidebar-section-capsule">{group.section}</span>
            </div>

            {group.items.map((item) => {
              const Icon = item.icon;
              const active =
                item.href === "/"
                  ? pathname === "/"
                  : pathname === item.href || pathname.startsWith(item.href + "/");

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`nav-item ${active ? "active" : ""}`}
                  onClick={() => onClose?.()}
                >
                  <Icon />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {/* User Footer */}
      <div className="sidebar-footer">
        <div className="sidebar-user">
          <div className="sidebar-avatar">{getInitials(currentUser.name)}</div>
          <div className="sidebar-user-copy">
            <div className="sidebar-user-name">{currentUser.name}</div>
            <div className="sidebar-user-role">{currentUser.role}</div>
          </div>
        </div>
      </div>
    </aside>
  );
}

/* ── Inline SVG Icons in LIMS style ── */
function IconDashboard() {
  return (
    <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.7" viewBox="0 0 24 24">
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  );
}

function IconBooking() {
  return (
    <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.7" viewBox="0 0 24 24">
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}

function IconPatients() {
  return (
    <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.7" viewBox="0 0 24 24">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function IconDoctor() {
  return (
    <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.7" viewBox="0 0 24 24">
      <path d="M4.8 2.3A.3.3 0 1 0 5 2H4a2 2 0 0 0-2 2v5a6 6 0 0 0 6 6v0a6 6 0 0 0 6-6V4a2 2 0 0 0-2-2h-1a.2.2 0 1 0 .3.3" />
      <path d="M8 15v1a6 6 0 0 0 6 6v0a6 6 0 0 0 6-6v-4" />
      <circle cx="20" cy="10" r="2" />
    </svg>
  );
}

function IconLab() {
  return (
    <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.7" viewBox="0 0 24 24">
      <path d="M10 2v7.31L4.15 19.34a2 2 0 0 0 1.71 3h12.28a2 2 0 0 0 1.71-3L14 9.31V2" />
      <path d="M8.5 2h7" />
      <path d="M14 9.3h-4" />
    </svg>
  );
}

function IconPharmacy() {
  return (
    <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.7" viewBox="0 0 24 24">
      <path d="m10.5 20.5 10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7Z" />
      <path d="m8.5 8.5 7 7" />
    </svg>
  );
}

function IconFinance() {
  return (
    <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.7" viewBox="0 0 24 24">
      <rect x="2" y="5" width="20" height="14" rx="2" />
      <line x1="2" y1="10" x2="22" y2="10" />
    </svg>
  );
}

function IconAdmin() {
  return (
    <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.7" viewBox="0 0 24 24">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}
