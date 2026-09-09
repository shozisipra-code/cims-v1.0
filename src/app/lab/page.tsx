"use client";

import React, { useState, useEffect } from "react";
import {
  FlaskConical,
  Search,
  CheckCircle2,
  Clock,
  AlertTriangle,
  FileCheck,
  X,
  User,
  Activity,
  Plus,
} from "lucide-react";
import { formatDate, formatDateTime } from "@/lib/utils";
import { STANDARD_LAB_TESTS } from "@/lib/constants/labTests";
import { useRole } from "@/components/layout/RoleContext";

export default function LaboratoryPage() {
  const { currentUser } = useRole();
  const [labOrders, setLabOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("ALL");

  // Result Entry Modal
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null);
  const [resultItems, setResultItems] = useState<any[]>([]);
  const [savingResults, setSavingResults] = useState(false);

  const fetchLabOrders = () => {
    setLoading(true);
    fetch("/api/lab-orders")
      .then((res) => res.json())
      .then((data) => {
        if (data.success) setLabOrders(data.labOrders);
      })
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchLabOrders();
  }, []);

  const openResultModal = (order: any) => {
    setSelectedOrder(order);
    setResultItems(
      order.items.map((i: any) => ({
        id: i.id,
        testName: i.testName,
        category: i.category,
        referenceRange: i.referenceRange || "Standard Reference",
        unit: i.unit || "",
        resultValue: i.resultValue || "",
        isAbnormal: i.isAbnormal || false,
        notes: i.notes || "",
      }))
    );
  };

  const handleSaveResults = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrder) return;
    setSavingResults(true);
    try {
      const res = await fetch("/api/lab-orders", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: selectedOrder.id,
          itemsResults: resultItems,
          status: "COMPLETED",
        }),
      });
      const data = await res.json();
      if (data.success) {
        setSelectedOrder(null);
        fetchLabOrders();
      } else {
        alert(data.error || "Failed to save results");
      }
    } catch (e) {
      console.error(e);
      alert("Error saving laboratory results.");
    } finally {
      setSavingResults(false);
    }
  };

  const filteredOrders = labOrders.filter((o) => {
    if (statusFilter === "ALL") return true;
    return o.status === statusFilter;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight flex items-center gap-2.5">
            <FlaskConical className="w-6 h-6 text-indigo-600" />
            Laboratory Information System (LIS)
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Diagnostic test orders accessioning, specimen processing, and electronic clinical verification.
          </p>
        </div>

        {/* Status Filters */}
        <div className="flex items-center gap-2 bg-white p-1 rounded-xl border border-slate-200 shadow-sm text-xs">
          <button
            onClick={() => setStatusFilter("ALL")}
            className={`px-3 py-1.5 rounded-lg font-bold transition ${
              statusFilter === "ALL" ? "bg-indigo-600 text-white" : "text-slate-600 hover:text-slate-900"
            }`}
          >
            All Orders ({labOrders.length})
          </button>
          <button
            onClick={() => setStatusFilter("ORDERED")}
            className={`px-3 py-1.5 rounded-lg font-bold transition ${
              statusFilter === "ORDERED" ? "bg-amber-500 text-white" : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Pending
          </button>
          <button
            onClick={() => setStatusFilter("COMPLETED")}
            className={`px-3 py-1.5 rounded-lg font-bold transition ${
              statusFilter === "COMPLETED" ? "bg-emerald-600 text-white" : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Completed
          </button>
        </div>
      </div>

      {/* Orders Grid / Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200 uppercase tracking-wider text-[10px]">
              <tr>
                <th className="px-5 py-3">Order Number</th>
                <th className="px-4 py-3">Patient</th>
                <th className="px-4 py-3">Ordering Doctor</th>
                <th className="px-4 py-3">Tests Ordered</th>
                <th className="px-4 py-3">Priority</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-slate-400">
                    Loading laboratory work orders...
                  </td>
                </tr>
              ) : filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-slate-400">
                    No laboratory orders found.
                  </td>
                </tr>
              ) : (
                filteredOrders.map((order) => (
                  <tr key={order.id} className="hover:bg-slate-50/80 transition">
                    {/* Order # */}
                    <td className="px-5 py-3.5">
                      <span className="font-mono font-bold text-indigo-700">{order.orderNumber}</span>
                      <p className="text-[10px] text-slate-400">{formatDateTime(order.orderedAt)}</p>
                    </td>

                    {/* Patient */}
                    <td className="px-4 py-3.5">
                      <p className="font-bold text-slate-900">
                        {order.patient.firstName} {order.patient.lastName}
                      </p>
                      <p className="text-[11px] font-mono text-teal-700">{order.patient.mrn}</p>
                    </td>

                    {/* Doctor */}
                    <td className="px-4 py-3.5">
                      <p className="font-semibold text-slate-800">{order.doctor.name}</p>
                      <p className="text-[11px] text-slate-500">{order.doctor.department}</p>
                    </td>

                    {/* Tests */}
                    <td className="px-4 py-3.5">
                      <div className="flex flex-wrap gap-1.5">
                        {order.items?.map((item: any) => (
                          <span
                            key={item.id}
                            className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                              item.isAbnormal
                                ? "bg-red-100 text-red-800 border border-red-200 font-bold"
                                : item.status === "COMPLETED"
                                ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                                : "bg-slate-100 text-slate-700"
                            }`}
                          >
                            {item.testName}
                            {item.isAbnormal && " ⚠️"}
                          </span>
                        ))}
                      </div>
                    </td>

                    {/* Priority */}
                    <td className="px-4 py-3.5">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          order.priority === "STAT"
                            ? "bg-red-600 text-white animate-pulse"
                            : order.priority === "URGENT"
                            ? "bg-amber-100 text-amber-800"
                            : "bg-slate-100 text-slate-700"
                        }`}
                      >
                        {order.priority}
                      </span>
                    </td>

                    {/* Status */}
                    <td className="px-4 py-3.5">
                      <span
                        className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${
                          order.status === "COMPLETED"
                            ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                            : "bg-amber-100 text-amber-800 border border-amber-200"
                        }`}
                      >
                        {order.status}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="px-5 py-3.5 text-right">
                      <button
                        onClick={() => openResultModal(order)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition shadow-sm ${
                          order.status === "COMPLETED"
                            ? "bg-slate-100 hover:bg-slate-200 text-slate-700"
                            : "bg-indigo-600 hover:bg-indigo-700 text-white"
                        }`}
                      >
                        {order.status === "COMPLETED" ? "View / Edit Results" : "Enter Results"}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Enter / Verify Results Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 shadow-2xl border border-slate-200 animate-in fade-in">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3 mb-4">
              <div>
                <h2 className="text-base font-bold text-slate-800">
                  Diagnostic Result Entry & Clinical Verification
                </h2>
                <p className="text-xs text-slate-500">
                  Order: <strong className="text-indigo-600">{selectedOrder.orderNumber}</strong> • Patient:{" "}
                  <strong>{selectedOrder.patient.firstName} {selectedOrder.patient.lastName}</strong>
                </p>
              </div>
              <button onClick={() => setSelectedOrder(null)} className="text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveResults} className="space-y-4 text-xs">
              <div className="space-y-4 divide-y divide-slate-100">
                {resultItems.map((item, index) => (
                  <div key={item.id} className="pt-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <h4 className="font-bold text-sm text-slate-900">{item.testName}</h4>
                      <span className="text-[10px] text-slate-400">{item.category}</span>
                    </div>

                    <p className="text-[11px] text-slate-500 italic">
                      Expected Normal Reference Range: {item.referenceRange}
                    </p>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="sm:col-span-2">
                        <label className="font-semibold text-slate-700 mb-1 block">
                          Reported Test Result Value *
                        </label>
                        <input
                          type="text"
                          required
                          value={item.resultValue}
                          onChange={(e) => {
                            const updated = [...resultItems];
                            updated[index].resultValue = e.target.value;
                            setResultItems(updated);
                          }}
                          placeholder="e.g. 14.2 (or normal / negative)"
                          className="w-full px-3 py-1.5 border border-slate-200 rounded-lg bg-slate-50"
                        />
                      </div>

                      <div>
                        <label className="font-semibold text-slate-700 mb-1 block">Units (e.g. g/dL)</label>
                        <input
                          type="text"
                          value={item.unit}
                          onChange={(e) => {
                            const updated = [...resultItems];
                            updated[index].unit = e.target.value;
                            setResultItems(updated);
                          }}
                          placeholder="g/dL, U/L, %"
                          className="w-full px-3 py-1.5 border border-slate-200 rounded-lg bg-slate-50"
                        />
                      </div>
                    </div>

                    {/* Abnormal Flag Checkbox */}
                    <div className="flex items-center gap-2 pt-1">
                      <input
                        type="checkbox"
                        id={`abnormal-${item.id}`}
                        checked={item.isAbnormal}
                        onChange={(e) => {
                          const updated = [...resultItems];
                          updated[index].isAbnormal = e.target.checked;
                          setResultItems(updated);
                        }}
                        className="rounded text-red-600 focus:ring-red-500 w-4 h-4"
                      />
                      <label htmlFor={`abnormal-${item.id}`} className="font-bold text-red-700 cursor-pointer">
                        Flag as Abnormal Value (Alerts Clinician)
                      </label>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setSelectedOrder(null)}
                  className="px-4 py-2 font-semibold text-slate-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingResults}
                  className="px-5 py-2 font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl transition shadow-sm disabled:opacity-50"
                >
                  {savingResults ? "Verifying..." : "Verify & Sign Lab Report"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
