"use client";

import React, { useState, useEffect } from "react";
import {
  ShieldCheck,
  Users,
  Search,
  Activity,
  Server,
  Lock,
  Calendar,
  Filter,
} from "lucide-react";
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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight flex items-center gap-2.5">
            <ShieldCheck className="w-6 h-6 text-teal-600" />
            System Administration & HIPAA Audit Trail
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Role-Based Access Control (RBAC), user directory, and immutable clinical activity auditing.
          </p>
        </div>

        <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 px-3.5 py-1.5 rounded-xl text-xs font-bold text-emerald-800">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          <span>HIPAA Audit Engine Active</span>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <span className="text-xs font-semibold text-slate-500 block">Total Clinical Encounters</span>
          <p className="text-2xl font-bold text-slate-900 mt-1">{loading ? "..." : metrics.totalEncounters}</p>
          <p className="text-[11px] text-teal-700 mt-0.5">Physician visits recorded</p>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <span className="text-xs font-semibold text-slate-500 block">Electronic Prescriptions</span>
          <p className="text-2xl font-bold text-slate-900 mt-1">{loading ? "..." : metrics.totalPrescriptions}</p>
          <p className="text-[11px] text-emerald-700 mt-0.5">Formulary orders generated</p>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <span className="text-xs font-semibold text-slate-500 block">Diagnostic Lab Orders</span>
          <p className="text-2xl font-bold text-slate-900 mt-1">{loading ? "..." : metrics.totalLabOrders}</p>
          <p className="text-[11px] text-indigo-700 mt-0.5">Accessioned in pathology</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 bg-white rounded-xl px-2 shadow-sm">
        <button
          onClick={() => setActiveTab("audit")}
          className={`px-4 py-3 text-xs font-bold border-b-2 flex items-center gap-2 transition ${
            activeTab === "audit"
              ? "border-teal-600 text-teal-700"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <ShieldCheck className="w-4 h-4" />
          Audit Trail Logs ({auditLogs.length})
        </button>

        <button
          onClick={() => setActiveTab("staff")}
          className={`px-4 py-3 text-xs font-bold border-b-2 flex items-center gap-2 transition ${
            activeTab === "staff"
              ? "border-teal-600 text-teal-700"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <Users className="w-4 h-4" />
          Staff Directory & RBAC ({users.length})
        </button>
      </div>

      {/* Tab 1: Audit Logs */}
      {activeTab === "audit" && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden space-y-4">
          <div className="p-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 bg-slate-50/50">
            <div className="flex items-center gap-2 text-xs">
              <span className="font-semibold text-slate-500">Filter Action:</span>
              <select
                value={actionFilter}
                onChange={(e) => setActionFilter(e.target.value)}
                className="px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-xs font-semibold"
              >
                <option value="ALL">All Actions</option>
                <option value="CREATE">CREATE</option>
                <option value="FINALIZE">FINALIZE</option>
                <option value="DISPENSE">DISPENSE</option>
                <option value="UPDATE">UPDATE</option>
              </select>
            </div>

            <span className="text-[11px] text-slate-400">
              Immutable logs generated according to Healthcare Privacy regulations
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200 uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="px-5 py-3">Timestamp</th>
                  <th className="px-4 py-3">Staff Actor / Role</th>
                  <th className="px-4 py-3">Action</th>
                  <th className="px-4 py-3">Resource</th>
                  <th className="px-4 py-3">Details</th>
                  <th className="px-4 py-3">IP Address</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-slate-400">
                      Loading audit logs...
                    </td>
                  </tr>
                ) : filteredLogs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-slate-400">
                      No logs matching selected action.
                    </td>
                  </tr>
                ) : (
                  filteredLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50/80 transition">
                      <td className="px-5 py-3 font-mono text-[11px] text-slate-500 whitespace-nowrap">
                        {formatDateTime(log.timestamp)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <p className="font-bold text-slate-900">{log.userName || "System"}</p>
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-100 font-semibold text-slate-600">
                          {log.userRole || "SERVICE"}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            log.action === "FINALIZE"
                              ? "bg-purple-100 text-purple-800"
                              : log.action === "CREATE"
                              ? "bg-teal-100 text-teal-800"
                              : log.action === "DISPENSE"
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-slate-100 text-slate-700"
                          }`}
                        >
                          {log.action}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="font-semibold text-slate-700">{log.resource}</span>
                      </td>
                      <td className="px-4 py-3 max-w-md">
                        <p className="text-slate-700">{log.details}</p>
                      </td>
                      <td className="px-4 py-3 font-mono text-[11px] text-slate-400 whitespace-nowrap">
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

      {/* Tab 2: Staff Directory */}
      {activeTab === "staff" && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200 uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="px-5 py-3">Staff Member</th>
                  <th className="px-4 py-3">Role & Permissions</th>
                  <th className="px-4 py-3">Department</th>
                  <th className="px-4 py-3">License / Registration #</th>
                  <th className="px-4 py-3">Contact</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50/80 transition">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-slate-200 overflow-hidden flex-shrink-0">
                          {u.avatar ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={u.avatar} alt={u.name} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full bg-teal-600 text-white font-bold flex items-center justify-center text-xs">
                              {u.name[0]}
                            </div>
                          )}
                        </div>
                        <div>
                          <p className="font-bold text-slate-900">{u.name}</p>
                          <p className="text-[11px] text-slate-400">{u.email}</p>
                        </div>
                      </div>
                    </td>

                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-teal-50 text-teal-800 border border-teal-200">
                        {u.role}
                      </span>
                    </td>

                    <td className="px-4 py-3.5">
                      <span className="text-slate-700 font-medium">{u.department || "Hospital Wide"}</span>
                    </td>

                    <td className="px-4 py-3.5 font-mono text-slate-600">
                      {u.licenseNumber || "N/A"}
                    </td>

                    <td className="px-4 py-3.5 text-slate-500">
                      {u.phone || "--"}
                    </td>
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
