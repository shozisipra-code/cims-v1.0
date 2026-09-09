"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  Users,
  CalendarDays,
  Stethoscope,
  FlaskConical,
  Pill,
  CreditCard,
  TrendingUp,
  Clock,
  CheckCircle2,
  AlertCircle,
  Plus,
  ArrowRight,
  Activity,
  ShieldCheck,
} from "lucide-react";
import { useRole } from "@/components/layout/RoleContext";
import { formatCurrency, formatDateTime } from "@/lib/utils";

interface DashboardData {
  stats: {
    totalPatients: number;
    todayAppointments: number;
    waitingQueue: number;
    inConsultation: number;
    pendingPrescriptions: number;
    pendingLabOrders: number;
    financials: {
      totalBilled: number;
      totalCollected: number;
      outstandingBalance: number;
    };
  };
  recentAuditLogs: any[];
}

export default function DashboardPage() {
  const { currentUser } = useRole();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/dashboard/stats")
      .then((res) => res.json())
      .then((json) => {
        if (json.success) setData(json);
      })
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  const stats = data?.stats;

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-teal-800 via-teal-700 to-slate-900 rounded-2xl p-6 text-white shadow-lg relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-teal-500/30 text-teal-200 border border-teal-400/30">
                {currentUser.department || "Clinical Command"}
              </span>
              <span className="text-xs text-teal-200">• Active Session</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
              Welcome back, {currentUser.name}
            </h1>
            <p className="text-sm text-teal-100/80 mt-1 max-w-xl">
              CIMS Clinical Integrated Management System is running normally. 
              {stats?.waitingQueue ? ` There are currently ${stats.waitingQueue} patients waiting in the OPD queue.` : " No patients waiting in the queue."}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/patients"
              className="inline-flex items-center gap-2 bg-white text-teal-900 px-4 py-2 rounded-xl text-xs font-bold hover:bg-teal-50 transition shadow-sm"
            >
              <Plus className="w-4 h-4" />
              Register Patient
            </Link>
            <Link
              href="/appointments"
              className="inline-flex items-center gap-2 bg-teal-600/80 hover:bg-teal-600 text-white px-4 py-2 rounded-xl text-xs font-bold transition border border-teal-400/30"
            >
              <CalendarDays className="w-4 h-4" />
              Queue Board
            </Link>
          </div>
        </div>

        {/* Subtle decorative circles */}
        <div className="absolute -right-8 -bottom-10 w-48 h-48 rounded-full bg-teal-500/10 pointer-events-none blur-xl"></div>
        <div className="absolute right-32 -top-12 w-40 h-40 rounded-full bg-emerald-500/10 pointer-events-none blur-xl"></div>
      </div>

      {/* KPI Metrics Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {/* Total Patients */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm hover:border-teal-300 transition group">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold text-slate-500">Total Patients</span>
            <Users className="w-4 h-4 text-teal-600" />
          </div>
          <p className="text-2xl font-bold text-slate-800">
            {loading ? "..." : stats?.totalPatients ?? 0}
          </p>
          <p className="text-[11px] text-slate-400 mt-1">Master Patient Index</p>
        </div>

        {/* OPD Queue Waiting */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm hover:border-amber-300 transition group">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold text-slate-500">Waiting in OPD</span>
            <Clock className="w-4 h-4 text-amber-500" />
          </div>
          <div className="flex items-baseline gap-2">
            <p className="text-2xl font-bold text-amber-600">
              {loading ? "..." : stats?.waitingQueue ?? 0}
            </p>
            <span className="text-xs text-slate-400">patients</span>
          </div>
          <p className="text-[11px] text-amber-600/90 mt-1 font-medium">Ready for doctor triage</p>
        </div>

        {/* In Consultation */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm hover:border-teal-300 transition group">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold text-slate-500">In Consult</span>
            <Stethoscope className="w-4 h-4 text-teal-600" />
          </div>
          <p className="text-2xl font-bold text-teal-700">
            {loading ? "..." : stats?.inConsultation ?? 0}
          </p>
          <p className="text-[11px] text-slate-400 mt-1">Active doctor visits</p>
        </div>

        {/* Pending Lab Orders */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm hover:border-indigo-300 transition group">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold text-slate-500">Lab Orders</span>
            <FlaskConical className="w-4 h-4 text-indigo-500" />
          </div>
          <p className="text-2xl font-bold text-indigo-600">
            {loading ? "..." : stats?.pendingLabOrders ?? 0}
          </p>
          <p className="text-[11px] text-slate-400 mt-1">Pending lab results</p>
        </div>

        {/* Pending Pharmacy */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm hover:border-emerald-300 transition group">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold text-slate-500">Prescriptions</span>
            <Pill className="w-4 h-4 text-emerald-500" />
          </div>
          <p className="text-2xl font-bold text-emerald-600">
            {loading ? "..." : stats?.pendingPrescriptions ?? 0}
          </p>
          <p className="text-[11px] text-slate-400 mt-1">Awaiting dispensing</p>
        </div>

        {/* Total Billed */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm hover:border-blue-300 transition group">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold text-slate-500">Billed Revenue</span>
            <CreditCard className="w-4 h-4 text-blue-500" />
          </div>
          <p className="text-xl font-bold text-slate-800">
            {loading ? "..." : formatCurrency(stats?.financials.totalBilled ?? 0)}
          </p>
          <p className="text-[11px] text-emerald-600 mt-1 font-medium">
            {loading ? "..." : formatCurrency(stats?.financials.totalCollected ?? 0)} collected
          </p>
        </div>
      </div>

      {/* Main Content Grid: Quick Workspaces + Activity Trail */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Clinical Module Launchpads */}
        <div className="lg:col-span-2 space-y-6">
          {/* Module Workspaces */}
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
            <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-4 flex items-center gap-2">
              <Activity className="w-4 h-4 text-teal-600" />
              Integrated Clinical Portals
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Doctor Workspace */}
              <Link
                href="/clinical"
                className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-teal-50/40 hover:border-teal-300 transition flex items-start gap-4 group"
              >
                <div className="p-2.5 rounded-lg bg-teal-100 text-teal-700 group-hover:bg-teal-600 group-hover:text-white transition">
                  <Stethoscope className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-slate-800 group-hover:text-teal-700 transition">
                      Doctor Clinical Desk
                    </h3>
                    <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-teal-600 group-hover:translate-x-0.5 transition-all" />
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    Conduct visits, write SOAP notes, ICD-10 diagnoses, and issue e-prescriptions.
                  </p>
                </div>
              </Link>

              {/* OPD Queue & Scheduling */}
              <Link
                href="/appointments"
                className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-amber-50/40 hover:border-amber-300 transition flex items-start gap-4 group"
              >
                <div className="p-2.5 rounded-lg bg-amber-100 text-amber-700 group-hover:bg-amber-500 group-hover:text-white transition">
                  <CalendarDays className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-slate-800 group-hover:text-amber-700 transition">
                      OPD Queue & Triage
                    </h3>
                    <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-amber-600 group-hover:translate-x-0.5 transition-all" />
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    Patient check-in, token management, vital signs recording, and waiting status.
                  </p>
                </div>
              </Link>

              {/* Diagnostic Lab (LIS) */}
              <Link
                href="/lab"
                className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-indigo-50/40 hover:border-indigo-300 transition flex items-start gap-4 group"
              >
                <div className="p-2.5 rounded-lg bg-indigo-100 text-indigo-700 group-hover:bg-indigo-600 group-hover:text-white transition">
                  <FlaskConical className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-slate-800 group-hover:text-indigo-700 transition">
                      Diagnostic Laboratory
                    </h3>
                    <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-indigo-600 group-hover:translate-x-0.5 transition-all" />
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    Specimen accessioning, test result entry, reference ranges, and abnormal flags.
                  </p>
                </div>
              </Link>

              {/* Pharmacy */}
              <Link
                href="/pharmacy"
                className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-emerald-50/40 hover:border-emerald-300 transition flex items-start gap-4 group"
              >
                <div className="p-2.5 rounded-lg bg-emerald-100 text-emerald-700 group-hover:bg-emerald-600 group-hover:text-white transition">
                  <Pill className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-slate-800 group-hover:text-emerald-700 transition">
                      Pharmacy Dispensing
                    </h3>
                    <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-emerald-600 group-hover:translate-x-0.5 transition-all" />
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    Fulfill pending prescriptions, track stock inventory, and batch expiry alerts.
                  </p>
                </div>
              </Link>

              {/* Billing */}
              <Link
                href="/billing"
                className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-blue-50/40 hover:border-blue-300 transition flex items-start gap-4 group"
              >
                <div className="p-2.5 rounded-lg bg-blue-100 text-blue-700 group-hover:bg-blue-600 group-hover:text-white transition">
                  <CreditCard className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-slate-800 group-hover:text-blue-700 transition">
                      Point-of-Care Billing
                    </h3>
                    <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-blue-600 group-hover:translate-x-0.5 transition-all" />
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    Itemized invoices for consults, labs, pharmacy, payment processing, and receipts.
                  </p>
                </div>
              </Link>

              {/* Master Patient Index */}
              <Link
                href="/patients"
                className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-purple-50/40 hover:border-purple-300 transition flex items-start gap-4 group"
              >
                <div className="p-2.5 rounded-lg bg-purple-100 text-purple-700 group-hover:bg-purple-600 group-hover:text-white transition">
                  <Users className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-slate-800 group-hover:text-purple-700 transition">
                      Patient 360 & Demographics
                    </h3>
                    <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-purple-600 group-hover:translate-x-0.5 transition-all" />
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    MRN lookup, allergy tags, chronic medical conditions, and clinical visit history.
                  </p>
                </div>
              </Link>
            </div>
          </div>
        </div>

        {/* Right 1 Col: Audit & Security Trail */}
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-teal-600" />
                HIPAA Audit Trail
              </h2>
              <Link href="/admin" className="text-xs text-teal-600 hover:underline font-semibold">
                View All
              </Link>
            </div>

            <div className="space-y-3">
              {loading ? (
                <p className="text-xs text-slate-400 py-4 text-center">Loading audit log...</p>
              ) : data?.recentAuditLogs?.length ? (
                data.recentAuditLogs.map((log: any) => (
                  <div
                    key={log.id}
                    className="p-2.5 rounded-lg border border-slate-100 bg-slate-50/70 text-xs space-y-1"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-800">{log.userName || "System"}</span>
                      <span className="text-[10px] text-slate-400">{formatDateTime(log.timestamp)}</span>
                    </div>
                    <p className="text-slate-600 text-[11px]">{log.details}</p>
                    <div className="flex items-center gap-1.5 pt-0.5">
                      <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-slate-200 text-slate-700">
                        {log.action}
                      </span>
                      <span className="text-[10px] text-slate-400">• {log.resource}</span>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-xs text-slate-400 py-4 text-center">No recent audit logs.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
