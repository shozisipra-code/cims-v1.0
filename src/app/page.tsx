"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import { useRole } from "@/components/layout/RoleContext";

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
    <div className="dashboard-page">
      {/* Page Header (LIMS style) */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Hospital Dashboard</h1>
          <p className="page-subtitle">
            Welcome back, <strong>{currentUser.name}</strong> • {currentUser.department || "Clinical Command"}
          </p>
        </div>
        <div className="page-actions">
          <Link href="/appointments" className="btn btn-secondary btn-sm">
            OPD Queue
          </Link>
          <Link href="/patients" className="btn btn-primary btn-sm">
            + Register Patient
          </Link>
        </div>
      </div>

      {/* Top 3 Metric Stat Cards (LIMS grid-3 style) */}
      <div className="grid-3" style={{ marginBottom: 16 }}>
        <div className="stat-card blue">
          <div className="stat-label">Total Registered Patients</div>
          <div className="stat-value">{loading ? "..." : stats?.totalPatients ?? 0}</div>
          <div className="stat-sub">Master Patient Index (PMI)</div>
        </div>

        <div className="stat-card teal">
          <div className="stat-label">Total Invoiced Amount</div>
          <div className="stat-value">
            {loading ? "..." : formatCurrency(stats?.financials.totalBilled ?? 0)}
          </div>
          <div className="stat-sub">Consults, diagnostic labs & pharmacy</div>
        </div>

        <div className="stat-card green">
          <div className="stat-label">Active Consultations</div>
          <div className="stat-value">{loading ? "..." : stats?.inConsultation ?? 0}</div>
          <div className="stat-sub">Patients currently with doctors</div>
        </div>
      </div>

      {/* Secondary 2-Column Stat Cards (LIMS grid-2 style) */}
      <div className="grid-2" style={{ marginBottom: 16 }}>
        <div className="stat-card amber">
          <div className="stat-label">Waiting in OPD Queue</div>
          <div className="stat-value">{loading ? "..." : stats?.waitingQueue ?? 0}</div>
          <div className="stat-sub">Patients seated in triage waiting lobby</div>
        </div>

        <div className="stat-card red">
          <div className="stat-label">Pending Clinical Orders</div>
          <div className="stat-value">
            {(stats?.pendingLabOrders ?? 0) + (stats?.pendingPrescriptions ?? 0)}
          </div>
          <div className="stat-sub">
            {stats?.pendingLabOrders ?? 0} lab tests & {stats?.pendingPrescriptions ?? 0} prescriptions
          </div>
        </div>
      </div>

      {/* Main Content Split Cards (LIMS Card Layout) */}
      <div className="grid-2">
        {/* Quick Launch Clinical Modules */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">Core Clinical Portals</span>
          </div>
          <div className="card-body" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <Link
              href="/clinical"
              className="btn btn-secondary"
              style={{ justifyContent: "space-between", padding: "12px 16px" }}
            >
              <div style={{ textAlign: "left" }}>
                <strong style={{ display: "block", color: "var(--primary)" }}>Doctor Clinical Desk</strong>
                <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                  SOAP notes, ICD-10 coding, vital signs & e-prescribing
                </span>
              </div>
              <span className="badge badge-teal">Launch &rarr;</span>
            </Link>

            <Link
              href="/appointments"
              className="btn btn-secondary"
              style={{ justifyContent: "space-between", padding: "12px 16px" }}
            >
              <div style={{ textAlign: "left" }}>
                <strong style={{ display: "block", color: "var(--primary)" }}>Patient Booking & OPD Queue</strong>
                <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                  Token generation, waitlist management & doctor assignment
                </span>
              </div>
              <span className="badge badge-amber">{stats?.waitingQueue ?? 0} Waiting</span>
            </Link>

            <Link
              href="/lab"
              className="btn btn-secondary"
              style={{ justifyContent: "space-between", padding: "12px 16px" }}
            >
              <div style={{ textAlign: "left" }}>
                <strong style={{ display: "block", color: "var(--primary)" }}>Diagnostic Laboratory (LIS)</strong>
                <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                  Specimen tracking, result entry, reference ranges & verification
                </span>
              </div>
              <span className="badge badge-blue">{stats?.pendingLabOrders ?? 0} Orders</span>
            </Link>

            <Link
              href="/pharmacy"
              className="btn btn-secondary"
              style={{ justifyContent: "space-between", padding: "12px 16px" }}
            >
              <div style={{ textAlign: "left" }}>
                <strong style={{ display: "block", color: "var(--primary)" }}>Pharmacy & Medication Dispensing</strong>
                <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                  e-Rx queue fulfillment and automated inventory deduction
                </span>
              </div>
              <span className="badge badge-green">{stats?.pendingPrescriptions ?? 0} Pending</span>
            </Link>
          </div>
        </div>

        {/* HIPAA Audit Trail & Activity Feed */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">Live Clinical Audit Log</span>
            <Link href="/admin" className="badge badge-blue" style={{ textDecoration: "none" }}>
              View All
            </Link>
          </div>
          <div className="card-body" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {loading ? (
              <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Loading activity stream...</span>
            ) : data?.recentAuditLogs?.length ? (
              data.recentAuditLogs.map((log: any) => (
                <div
                  key={log.id}
                  style={{
                    padding: "9px 12px",
                    background: "var(--surface-2)",
                    border: "1px solid var(--border)",
                    borderRadius: 6,
                    fontSize: 12,
                    display: "flex",
                    flexDirection: "column",
                    gap: 3,
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <strong style={{ color: "var(--text-primary)" }}>{log.userName || "System User"}</strong>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, color: "var(--text-muted)" }}>
                      {formatDateTime(log.timestamp)}
                    </span>
                  </div>
                  <p style={{ color: "var(--text-muted)", fontSize: 11.5 }}>{log.details}</p>
                  <div style={{ display: "flex", gap: 6, marginTop: 2 }}>
                    <span className="badge badge-teal" style={{ fontSize: 9.5 }}>
                      {log.action}
                    </span>
                    <span style={{ fontSize: 10.5, color: "var(--text-muted)" }}>• {log.resource}</span>
                  </div>
                </div>
              ))
            ) : (
              <span style={{ fontSize: 12, color: "var(--text-muted)" }}>No recent audit activity recorded.</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
