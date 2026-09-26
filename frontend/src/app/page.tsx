"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { CalendarDays, Clock, CreditCard, Stethoscope, Users, ArrowRight } from "lucide-react";
import { useRole } from "@/components/layout/RoleContext";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/utils";

interface DashboardData {
  stats: {
    totalPatients: number;
    todayAppointments: number;
    waitingQueue: number;
    inConsultation: number;
    financials: { totalBilled: number; totalCollected: number; outstandingBalance: number };
  };
  recentAuditLogs: { id: string; action: string; resource: string; details: string; timestamp: string; userName: string | null }[];
}

const workspaces = [
  { href: "/patients", title: "Patient records", text: "Register and review patient history", icon: Users },
  { href: "/booking", title: "Patient Booking", text: "Register a visit and issue a clinic token", icon: CalendarDays },
  { href: "/clinical", title: "Consultation", text: "Doctor vitals, clinical notes and prescriptions", icon: Stethoscope },
  { href: "/billing", title: "Billing & receipts", text: "Completed patient payment receipts", icon: CreditCard },
];

export default function DashboardPage() {
  const { currentUser } = useRole();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const reload = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const response = await fetch("/api/dashboard/stats");
      const json = await response.json();
      if (!response.ok || !json.success) throw new Error("Unable to load the dashboard. Please try again.");
      setData(json);
    } catch (err) { setError(err instanceof Error ? err.message : "Unable to load dashboard"); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { reload(); }, [reload]);

  const stats = data?.stats;
  const number = (value?: number) => loading ? "…" : error || value === undefined ? "—" : value.toLocaleString("en-PK");
  const money = (value?: number) => loading ? "…" : error || value === undefined ? "—" : formatCurrency(value);
  const metrics = [
    { title: "Patients", value: number(stats?.totalPatients), sub: "Registered records", icon: Users, href: "/patients" },
    { title: "Appointments today", value: number(stats?.todayAppointments), sub: "Pakistan Standard Time", icon: CalendarDays, href: "/appointments" },
    { title: "Waiting now", value: number(stats?.waitingQueue), sub: "Ready for consultation", icon: Clock, href: "/appointments", tone: "warning" },
    { title: "In consultation", value: number(stats?.inConsultation), sub: "Current patient visit", icon: Stethoscope, href: "/clinical" },
  ];

  return <div className="space-y-6">
    <div className="page-header">
      <div><h1 className="page-title">Clinic dashboard</h1><p className="page-subtitle">{formatDate(new Date())} - {currentUser.name}</p></div>
    </div>
    {error && <div role="alert" className="rounded-xl bg-red-50 border border-red-200 p-4 text-sm text-red-800">{error}</div>}
    <div className="stat-grid">{metrics.map(({ title, value, sub, icon: Icon, href, tone }) => <Link key={title} href={href} className={`stat-card ${tone || ""}`}><div className="stat-label">{title}<Icon size={17} /></div><div className="stat-value">{value}</div><div className="stat-sub">{sub}</div></Link>)}</div>
    <div className="stat-grid">
      <Link href="/payments" className="stat-card"><div className="stat-label">Collected <CreditCard size={16} /></div><div className="stat-value">{money(stats?.financials.totalCollected)}</div><p className="stat-sub">Recorded payments</p></Link>
      <Link href="/booking" className="stat-card"><div className="stat-label">Patient booking</div><div className="stat-value">Open</div><p className="stat-sub">Record customizable payments at booking</p></Link>
    </div>
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
      <section className="card"><div className="card-header"><h2>Clinic workspace</h2><span className="text-xs">Daily essentials</span></div><div className="card-body">{workspaces.map(({ href, title, text, icon: Icon }) => <Link href={href} className="workspace-link" key={href}><span className="workspace-icon"><Icon size={18} /></span><span className="flex-1"><strong>{title}</strong><small>{text}</small></span><ArrowRight size={15} className="text-slate-400" /></Link>)}</div></section>
      <section className="card"><div className="card-header"><h2>Recent activity</h2></div><div className="card-body">
        {loading ? <p className="text-sm text-slate-500">Loading activity…</p> : data?.recentAuditLogs.length ? data.recentAuditLogs.map(log => <div className="py-3 border-b border-slate-100 last:border-0" key={log.id}><div className="flex justify-between gap-2 mb-1"><span className="text-[10px] font-bold text-teal-800 bg-teal-50 rounded px-2 py-1">{log.action}</span><span className="text-[10px] text-slate-500">{formatDateTime(log.timestamp)}</span></div><p className="text-xs leading-relaxed text-slate-700">{log.details || log.resource}</p></div>) : <p className="text-sm text-slate-500">No activity recorded yet.</p>}
      </div></section>
    </div>
  </div>;
}
