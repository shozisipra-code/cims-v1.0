"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  Users,
  CalendarDays,
  Stethoscope,
  FlaskConical,
  Pill,
  CreditCard,
  ShieldCheck,
  HeartPulse,
} from "lucide-react";
import { useRole } from "./RoleContext";

interface NavItem {
  name: string;
  href: string;
  icon: React.ElementType;
  badge?: string;
  allowedRoles?: string[];
}

const navItems: NavItem[] = [
  {
    name: "Dashboard",
    href: "/",
    icon: Activity,
  },
  {
    name: "Patient Master Index",
    href: "/patients",
    icon: Users,
  },
  {
    name: "Appointments & Queue",
    href: "/appointments",
    icon: CalendarDays,
    badge: "3 Waiting",
  },
  {
    name: "Doctor Workspace",
    href: "/clinical",
    icon: Stethoscope,
    badge: "Live",
  },
  {
    name: "Diagnostic Lab (LIS)",
    href: "/lab",
    icon: FlaskConical,
    badge: "2 Orders",
  },
  {
    name: "Pharmacy & Meds",
    href: "/pharmacy",
    icon: Pill,
    badge: "1 Pending",
  },
  {
    name: "Billing & Invoices",
    href: "/billing",
    icon: CreditCard,
  },
  {
    name: "Admin & Audit Trail",
    href: "/admin",
    icon: ShieldCheck,
  },
];

export const Sidebar: React.FC = () => {
  const pathname = usePathname();
  const { currentUser } = useRole();

  return (
    <aside className="no-print w-64 border-r border-slate-200 bg-slate-900 text-slate-300 flex flex-col h-screen sticky top-0 z-40 select-none">
      {/* Brand Header */}
      <div className="h-16 flex items-center gap-3 px-6 border-b border-slate-800 bg-slate-950/60">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-teal-500 to-emerald-400 flex items-center justify-center text-white shadow-md shadow-teal-500/20">
          <HeartPulse className="w-5 h-5" />
        </div>
        <div>
          <h1 className="font-bold text-white text-base tracking-tight flex items-center gap-1.5">
            CIMS <span className="text-[10px] bg-teal-500/20 text-teal-300 border border-teal-500/30 px-1.5 py-0.2 rounded font-mono">v1.0</span>
          </h1>
          <p className="text-[11px] text-slate-400 font-medium leading-none">Clinical Integrated System</p>
        </div>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        <div className="px-3 pb-2 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
          Core Hospital Modules
        </div>

        {navItems.map((item) => {
          const isActive = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
          const Icon = item.icon;

          return (
            <Link
              key={item.name}
              href={item.href}
              className={`flex items-center justify-between px-3.5 py-2.5 rounded-lg text-xs font-medium transition-all group ${
                isActive
                  ? "bg-teal-500/15 text-teal-300 border border-teal-500/30 font-semibold shadow-sm"
                  : "text-slate-300 hover:bg-slate-800/80 hover:text-white"
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <Icon
                  className={`w-4 h-4 flex-shrink-0 transition-colors ${
                    isActive ? "text-teal-400" : "text-slate-400 group-hover:text-slate-200"
                  }`}
                />
                <span className="truncate">{item.name}</span>
              </div>
              {item.badge && (
                <span
                  className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                    isActive
                      ? "bg-teal-400/20 text-teal-300"
                      : "bg-slate-800 text-slate-400 group-hover:bg-slate-700 text-slate-300"
                  }`}
                >
                  {item.badge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Footer / System Status */}
      <div className="p-4 border-t border-slate-800/80 bg-slate-950/40 text-xs text-slate-400">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[11px] font-medium text-slate-400">HIPAA & EHR Status</span>
          <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400 font-semibold">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
            Compliant
          </span>
        </div>
        <p className="text-[10px] text-slate-400 truncate">
          Logged as: <strong className="text-slate-200">{currentUser.name}</strong>
        </p>
      </div>
    </aside>
  );
};
