"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, Users, CalendarDays, CalendarPlus, Stethoscope, CreditCard, Banknote, UserCog, Pill, ScrollText, History, Megaphone, X } from "lucide-react";
import { useRole } from "./RoleContext";
import { canAccess, roleLabels } from "@/lib/permissions";
import { PermissionKey } from "@/types";
const groups = [
  { title: "Overview", items: [{ name: "Dashboard", href: "/", icon: Activity, permission: "dashboard" }] },
  { title: "Clinic", items: [
    { name: "Patient Booking", href: "/booking", icon: CalendarPlus, permission: "booking" },
    { name: "Appointments & Queue", href: "/appointments", icon: CalendarDays, permission: "appointments" },
    { name: "Patient Calling", href: "/patient-calling", icon: Megaphone, permission: "patient_calling" },
    { name: "Patient Records", href: "/patients", icon: Users, permission: "patients" },
    { name: "Consultation", href: "/clinical", icon: Stethoscope, permission: "clinical" },
  ] },
  { title: "Finances", items: [
    { name: "Invoices & Payments", href: "/billing", icon: CreditCard, permission: "billing" },
    { name: "Payment Records", href: "/payments", icon: Banknote, permission: "payments" },
    { name: "Daily Statement", href: "/daily-statement", icon: ScrollText, permission: "daily_statement" },
  ] },
  { title: "Operations", items: [{ name: "Pharmacy", href: "/pharmacy", icon: Pill, permission: "pharmacy" }, { name: "Users & Permissions", href: "/users", icon: UserCog, permission: "users" }, { name: "Audit Log", href: "/audit-log", icon: History, permission: "audit_log" }] },
];
export function Sidebar({ open, collapsed, onClose, onToggleCollapse }: { open: boolean; collapsed: boolean; onClose: () => void; onToggleCollapse: () => void }) {
  const pathname = usePathname();
  const { currentUser } = useRole();
  return <>
    {open && <button className="sidebar-backdrop no-print" onClick={onClose} aria-label="Close navigation" />}
    <aside id="main-navigation" className={"sidebar no-print " + (open ? "is-open" : "")}>
      <button className="sidebar-brand" type="button" onClick={onToggleCollapse} aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"} aria-pressed={collapsed}>
        <span className="brand-symbol brand-symbol-clade">
          <img src="/clade-analytics-badge.png" alt="Clade Analytics" />
        </span>
        <span className="sidebar-brand-copy"><strong>Clade Analytics</strong><small>CIMS Clinical Management</small></span>
      </button>
      <button className="sidebar-close" onClick={onClose} aria-label="Close navigation"><X size={18} /></button>
      <nav aria-label="Main navigation" className="sidebar-nav">
        {groups.map(group => ({ ...group, items: group.items.filter(item => canAccess(currentUser.role, currentUser.permissions || [], item.permission as PermissionKey)) })).filter(group => group.items.length).map(group => <div key={group.title}>
          <p className="sidebar-section">{group.title}</p>
          {group.items.map(({ name, href, icon: Icon }) => {
            const active = pathname === href || (href !== "/" && pathname.startsWith(href + "/"));
            return <Link key={href} href={href} onClick={onClose} aria-current={active ? "page" : undefined} className={"nav-item " + (active ? "active" : "")}><Icon size={17} /><span>{name}</span></Link>;
          })}
        </div>)}
      </nav>
      <div className="sidebar-footer">
        <div className="sidebar-user">
          <span className="staff-avatar">{currentUser.name.replace(/^Dr\. /, "").split(" ").slice(0, 2).map(n => n[0]).join("")}</span>
          <div className="sidebar-user-copy"><strong>{currentUser.name}</strong><small>{roleLabels[currentUser.role] || currentUser.role}</small></div>
        </div>
      </div>
    </aside>
  </>;
}
