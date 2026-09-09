"use client";

import React, { useState, useEffect } from "react";
import {
  Pill,
  Search,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Package,
  Plus,
  ArrowRight,
  TrendingDown,
  X,
} from "lucide-react";
import { formatDate, formatDateTime, formatCurrency } from "@/lib/utils";
import { useRole } from "@/components/layout/RoleContext";

export default function PharmacyPage() {
  const { currentUser } = useRole();
  const [prescriptions, setPrescriptions] = useState<any[]>([]);
  const [medications, setMedications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"prescriptions" | "inventory">("prescriptions");

  // Dispensing state
  const [dispensingId, setDispensingId] = useState<string | null>(null);

  const fetchPharmacyData = () => {
    setLoading(true);
    Promise.all([
      fetch("/api/prescriptions").then((r) => r.json()),
      fetch("/api/admin/audit").then((r) => r.json()),
    ])
      .then(([rxData]) => {
        if (rxData.success) setPrescriptions(rxData.prescriptions);
      })
      .catch((e) => console.error(e))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchPharmacyData();
  }, []);

  const handleDispense = async (prescriptionId: string) => {
    setDispensingId(prescriptionId);
    try {
      const res = await fetch("/api/prescriptions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: prescriptionId,
          dispensedBy: currentUser.name,
        }),
      });
      const data = await res.json();
      if (data.success) {
        fetchPharmacyData();
      } else {
        alert(data.error || "Failed to dispense prescription");
      }
    } catch (e) {
      console.error(e);
      alert("Error dispensing prescription.");
    } finally {
      setDispensingId(null);
    }
  };

  const pendingCount = prescriptions.filter((p) => p.status === "PENDING").length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight flex items-center gap-2.5">
            <Pill className="w-6 h-6 text-emerald-600" />
            Pharmacy & Medication Dispensing
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Real-time electronic prescription queue fulfillment, drug formulary, and automated stock deduction.
          </p>
        </div>

        {/* Counter Badge */}
        <div className="flex items-center gap-3">
          <div className="px-4 py-2 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-bold text-emerald-800 flex items-center gap-2">
            <Clock className="w-4 h-4 text-emerald-600" />
            <span>{pendingCount} Prescriptions Awaiting Dispensing</span>
          </div>
        </div>
      </div>

      {/* Prescriptions List */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/50">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700">
            Outpatient Prescription Dispensing Worklist
          </h2>
          <span className="text-[11px] text-slate-400">Linked to Doctor Clinical Consultation Pad</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200 uppercase tracking-wider text-[10px]">
              <tr>
                <th className="px-5 py-3">Prescription Date</th>
                <th className="px-4 py-3">Patient Name / MRN</th>
                <th className="px-4 py-3">Prescribing Physician</th>
                <th className="px-4 py-3">Medications & Regimen</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-400">
                    Loading prescription queue...
                  </td>
                </tr>
              ) : prescriptions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-400">
                    No active prescriptions.
                  </td>
                </tr>
              ) : (
                prescriptions.map((rx) => (
                  <tr key={rx.id} className="hover:bg-slate-50/80 transition">
                    <td className="px-5 py-3.5 whitespace-nowrap">
                      <p className="font-semibold text-slate-800">{formatDateTime(rx.createdAt)}</p>
                      {rx.dispensedAt && (
                        <p className="text-[10px] text-emerald-600">
                          Dispensed: {formatDateTime(rx.dispensedAt)}
                        </p>
                      )}
                    </td>

                    <td className="px-4 py-3.5">
                      <p className="font-bold text-slate-900">
                        {rx.patient.firstName} {rx.patient.lastName}
                      </p>
                      <p className="text-[11px] font-mono text-teal-700">{rx.patient.mrn}</p>
                    </td>

                    <td className="px-4 py-3.5">
                      <p className="font-semibold text-slate-800">{rx.doctor.name}</p>
                      <p className="text-[11px] text-slate-500">{rx.doctor.department}</p>
                    </td>

                    {/* Medications Items */}
                    <td className="px-4 py-3.5">
                      <div className="space-y-1.5 max-w-md">
                        {rx.items?.map((item: any) => (
                          <div
                            key={item.id}
                            className="p-1.5 bg-slate-50 rounded border border-slate-200 text-[11px]"
                          >
                            <div className="flex items-center justify-between font-bold text-slate-800">
                              <span>{item.medicationName}</span>
                              <span className="text-teal-700">Qty: {item.quantity}</span>
                            </div>
                            <p className="text-slate-500 text-[10px]">
                              {item.dosage} • {item.frequency} • {item.duration}
                            </p>
                            {item.instructions && (
                              <p className="text-slate-400 text-[9px] italic">{item.instructions}</p>
                            )}
                          </div>
                        ))}
                      </div>
                    </td>

                    {/* Status */}
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <span
                        className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${
                          rx.status === "DISPENSED"
                            ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                            : "bg-amber-100 text-amber-800 border border-amber-200"
                        }`}
                      >
                        {rx.status}
                      </span>
                    </td>

                    {/* Action */}
                    <td className="px-5 py-3.5 text-right whitespace-nowrap">
                      {rx.status === "PENDING" ? (
                        <button
                          onClick={() => handleDispense(rx.id)}
                          disabled={dispensingId === rx.id}
                          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-xs transition shadow-sm disabled:opacity-50 flex items-center gap-1.5 ml-auto"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          {dispensingId === rx.id ? "Dispensing..." : "Fulfill & Dispense"}
                        </button>
                      ) : (
                        <span className="text-[11px] text-slate-400 italic">
                          Dispensed by {rx.dispensedBy || "Pharmacy"}
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
