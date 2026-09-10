"use client";

import React, { useState, useEffect } from "react";
import { formatDateTime } from "@/lib/utils";
import { useRole } from "@/components/layout/RoleContext";

export default function AdminPage() {
  const { currentUser } = useRole();
  const [data, setData] = useState<{
    auditLogs: any[];
    users: any[];
    metrics: any;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"audit" | "staff">("audit");
  const [actionFilter, setActionFilter] = useState<string>("ALL");

  useEffect(() => {
    fetch("/api/admin/audit")
      .then((res) => res.json())
      .then((d) => {
        if (d.success) setData(d);
      })
      .catch((e) => console.error(e))
      .finally(() => setLoading(false));
  }, []);

  const auditLogs = data?.auditLogs || [];
  const users = data?.users || [];
  const metrics = data?.metrics || { totalEncounters: 0, totalPrescriptions: 0, totalLabOrders: 0 };

  const filteredLogs = auditLogs.filter((log) => {
    if (actionFilter === "ALL") return true;
    return log.action === actionFilter;
  });

  return (
    <div className="admin-page">
      {/* Page Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">User Management & Audit Log</h1>
          <p className="page-subtitle">
            Role-Based Access Control (RBAC), user directory, and immutable HIPAA compliance logging.
          </p>
        </div>

        <span className="badge badge-green" style={{ fontSize: 11.5, padding: "6px 12px" }}>
          Audit Engine Active
        </span>
      </div>

      {/* Metrics Row (LIMS grid-3 style) */}
      <div className="grid-3" style={{ marginBottom: 16 }}>
        <div className="stat-card blue">
          <div className="stat-label">Total Clinical Encounters</div>
          <div className="stat-value">{loading ? "..." : metrics.totalEncounters}</div>
          <div className="stat-sub">Physician visits recorded</div>
        </div>

        <div className="stat-card teal">
          <div className="stat-label">Electronic Prescriptions</div>
          <div className="stat-value">{loading ? "..." : metrics.totalPrescriptions}</div>
          <div className="stat-sub">Formulary orders generated</div>
        </div>

        <div className="stat-card green">
          <div className="stat-label">Diagnostic Lab Orders</div>
          <div className="stat-value">{loading ? "..." : metrics.totalLabOrders}</div>
          <div className="stat-sub">Accessioned in pathology</div>
        </div>
      </div>

      {/* Tabs Row */}
      <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
        <button
          type="button"
          onClick={() => setActiveTab("audit")}
          className={`btn ${activeTab === "audit" ? "btn-primary" : "btn-secondary"} btn-sm`}
        >
          Compliance Audit Log ({auditLogs.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("staff")}
          className={`btn ${activeTab === "staff" ? "btn-primary" : "btn-secondary"} btn-sm`}
        >
          Staff Accounts & Roles ({users.length})
        </button>
      </div>

      {/* Tab 1: Audit Log */}
      {activeTab === "audit" && (
        <div className="card">
          <div className="card-header">
            <span className="card-title">Immutable Healthcare Activity Trail</span>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 11.5, color: "var(--text-muted)", fontWeight: 600 }}>Action Filter:</span>
              <select
                value={actionFilter}
                onChange={(e) => setActionFilter(e.target.value)}
                className="form-select"
                style={{ width: "auto", padding: "4px 8px", fontSize: 11.5 }}
              >
                <option value="ALL">All Actions</option>
                <option value="CREATE">CREATE</option>
                <option value="FINALIZE">FINALIZE</option>
                <option value="DISPENSE">DISPENSE</option>
                <option value="UPDATE">UPDATE</option>
              </select>
            </div>
          </div>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Staff Actor</th>
                  <th>Action</th>
                  <th>Resource</th>
                  <th>Details</th>
                  <th>IP Address</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: "center", padding: "30px", color: "var(--text-muted)" }}>
                      Loading audit records...
                    </td>
                  </tr>
                ) : filteredLogs.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: "center", padding: "30px", color: "var(--text-muted)" }}>
                      No logs matching selected action.
                    </td>
                  </tr>
                ) : (
                  filteredLogs.map((log) => (
                    <tr key={log.id}>
                      <td style={{ fontFamily: "var(--font-mono)", fontSize: 11.5 }}>
                        {formatDateTime(log.timestamp)}
                      </td>

                      <td>
                        <strong>{log.userName || "System"}</strong>
                        <div style={{ fontSize: 10.5, color: "var(--text-muted)" }}>{log.userRole}</div>
                      </td>

                      <td>
                        <span
                          className={`badge ${
                            log.action === "FINALIZE"
                              ? "badge-blue"
                              : log.action === "CREATE"
                              ? "badge-teal"
                              : log.action === "DISPENSE"
                              ? "badge-green"
                              : "badge-gray"
                          }`}
                        >
                          {log.action}
                        </span>
                      </td>

                      <td>
                        <strong style={{ fontSize: 11.5, color: "var(--text-secondary)" }}>
                          {log.resource}
                        </strong>
                      </td>

                      <td style={{ maxWidth: 400 }}>
                        <span style={{ fontSize: 12 }}>{log.details}</span>
                      </td>

                      <td style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-muted)" }}>
                        {log.ipAddress || "127.0.0.1"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 2: Staff Accounts */}
      {activeTab === "staff" && (
        <div className="card">
          <div className="card-header">
            <span className="card-title">Staff Members & Permissions ({users.length})</span>
          </div>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Staff Member</th>
                  <th>Assigned Role</th>
                  <th>Department</th>
                  <th>License / Registration</th>
                  <th>Contact</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id}>
                    <td>
                      <strong>{u.name}</strong>
                      <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{u.email}</div>
                    </td>

                    <td>
                      <span className="badge badge-blue">{u.role}</span>
                    </td>

                    <td>{u.department || "Hospital Wide"}</td>

                    <td style={{ fontFamily: "var(--font-mono)", fontSize: 11.5 }}>
                      {u.licenseNumber || "N/A"}
                    </td>

                    <td>{u.phone || "--"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
