"use client";

import React, { useState, useEffect } from "react";
import { formatDateTime } from "@/lib/utils";
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
        referenceRange: i.referenceRange || "Normal Reference",
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
    <div className="laboratory-page">
      {/* Page Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Diagnostic Laboratory (LIS)</h1>
          <p className="page-subtitle">
            Specimen accessioning, test result entry, reference ranges, and clinical verification.
          </p>
        </div>

        <div style={{ display: "flex", gap: 6 }}>
          <button
            type="button"
            onClick={() => setStatusFilter("ALL")}
            className={`btn ${statusFilter === "ALL" ? "btn-primary" : "btn-secondary"} btn-sm`}
          >
            All ({labOrders.length})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter("ORDERED")}
            className={`btn ${statusFilter === "ORDERED" ? "btn-primary" : "btn-secondary"} btn-sm`}
          >
            Pending
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter("COMPLETED")}
            className={`btn ${statusFilter === "COMPLETED" ? "btn-primary" : "btn-secondary"} btn-sm`}
          >
            Completed
          </button>
        </div>
      </div>

      {/* Lab Orders Card */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">Laboratory Worklist & Registers</span>
          <span style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
            Real-time accessioning
          </span>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Order #</th>
                <th>Patient Details</th>
                <th>Ordering Physician</th>
                <th>Diagnostic Tests Ordered</th>
                <th>Priority</th>
                <th>Status</th>
                <th style={{ textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: "center", padding: "30px", color: "var(--text-muted)" }}>
                    Loading laboratory worklist...
                  </td>
                </tr>
              ) : filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: "center", padding: "30px", color: "var(--text-muted)" }}>
                    No diagnostic lab orders found.
                  </td>
                </tr>
              ) : (
                filteredOrders.map((order) => (
                  <tr key={order.id}>
                    <td>
                      <strong style={{ fontFamily: "var(--font-mono)", color: "var(--primary)" }}>
                        {order.orderNumber}
                      </strong>
                      <div style={{ fontSize: 10.5, color: "var(--text-muted)" }}>
                        {formatDateTime(order.orderedAt)}
                      </div>
                    </td>

                    <td>
                      <strong>{order.patient.firstName} {order.patient.lastName}</strong>
                      <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-muted)" }}>
                        {order.patient.mrn}
                      </div>
                    </td>

                    <td>
                      <div>{order.doctor.name}</div>
                      <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{order.doctor.department}</span>
                    </td>

                    <td>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                        {order.items?.map((item: any) => (
                          <span
                            key={item.id}
                            className={`badge ${item.isAbnormal ? "badge-red" : item.status === "COMPLETED" ? "badge-green" : "badge-gray"}`}
                          >
                            {item.testName} {item.isAbnormal && "(!)"}
                          </span>
                        ))}
                      </div>
                    </td>

                    <td>
                      <span className={`badge ${order.priority === "STAT" ? "badge-red" : "badge-blue"}`}>
                        {order.priority}
                      </span>
                    </td>

                    <td>
                      <span className={`badge ${order.status === "COMPLETED" ? "badge-green" : "badge-amber"}`}>
                        {order.status}
                      </span>
                    </td>

                    <td style={{ textAlign: "right" }}>
                      <button
                        type="button"
                        onClick={() => openResultModal(order)}
                        className={`btn ${order.status === "COMPLETED" ? "btn-secondary" : "btn-primary"} btn-sm`}
                      >
                        {order.status === "COMPLETED" ? "Edit Results" : "Enter Results"}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Result Entry Modal (LIMS card style) */}
      {selectedOrder && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(11, 25, 42, 0.65)",
            backdropFilter: "blur(4px)",
            zIndex: 1000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
        >
          <div
            className="card"
            style={{
              maxWidth: 680,
              width: "100%",
              maxHeight: "90vh",
              overflowY: "auto",
              boxShadow: "var(--shadow-lg)",
            }}
          >
            <div className="card-header">
              <div>
                <span className="card-title">Laboratory Result Entry & Verification</span>
                <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
                  Order: <strong style={{ color: "var(--primary)" }}>{selectedOrder.orderNumber}</strong> • Patient:{" "}
                  <strong>{selectedOrder.patient.firstName} {selectedOrder.patient.lastName}</strong>
                </div>
              </div>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => setSelectedOrder(null)}
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleSaveResults} className="card-body">
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {resultItems.map((item, index) => (
                  <div
                    key={item.id}
                    style={{
                      borderBottom: "1px solid var(--border)",
                      paddingBottom: 14,
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                      <strong style={{ fontSize: 13, color: "var(--text-primary)" }}>{item.testName}</strong>
                      <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{item.category}</span>
                    </div>

                    <p style={{ fontSize: 11, color: "var(--text-muted)", fontStyle: "italic", marginBottom: 8 }}>
                      Normal Reference Range: {item.referenceRange}
                    </p>

                    <div className="form-grid form-grid-3">
                      <div className="form-group" style={{ gridColumn: "span 2" }}>
                        <label className="form-label required">Reported Result Value</label>
                        <input
                          type="text"
                          required
                          className="form-input"
                          value={item.resultValue}
                          onChange={(e) => {
                            const updated = [...resultItems];
                            updated[index].resultValue = e.target.value;
                            setResultItems(updated);
                          }}
                          placeholder="e.g. 13.8 or Negative"
                        />
                      </div>

                      <div className="form-group">
                        <label className="form-label">Units</label>
                        <input
                          type="text"
                          className="form-input"
                          value={item.unit}
                          onChange={(e) => {
                            const updated = [...resultItems];
                            updated[index].unit = e.target.value;
                            setResultItems(updated);
                          }}
                          placeholder="g/dL, U/L"
                        />
                      </div>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
                      <input
                        type="checkbox"
                        id={`abn-${item.id}`}
                        checked={item.isAbnormal}
                        onChange={(e) => {
                          const updated = [...resultItems];
                          updated[index].isAbnormal = e.target.checked;
                          setResultItems(updated);
                        }}
                      />
                      <label htmlFor={`abn-${item.id}`} style={{ fontSize: 12, fontWeight: 700, color: "var(--danger)", cursor: "pointer" }}>
                        Flag as Abnormal / Critical Value
                      </label>
                    </div>
                  </div>
                ))}
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 16 }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setSelectedOrder(null)}
                >
                  Cancel
                </button>
                <button type="submit" disabled={savingResults} className="btn btn-primary">
                  {savingResults ? "Verifying..." : "Verify & Sign Report"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
