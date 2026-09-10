"use client";

import React, { useState, useEffect } from "react";
import { formatDateTime } from "@/lib/utils";
import { useRole } from "@/components/layout/RoleContext";

export default function PharmacyPage() {
  const { currentUser } = useRole();
  const [prescriptions, setPrescriptions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dispensingId, setDispensingId] = useState<string | null>(null);

  const fetchPharmacyData = () => {
    setLoading(true);
    fetch("/api/prescriptions")
      .then((r) => r.json())
      .then((data) => {
        if (data.success) setPrescriptions(data.prescriptions);
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
    <div className="pharmacy-page">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Pharmacy & Medication Dispensing</h1>
          <p className="page-subtitle">
            Outpatient prescription fulfillment, formulary inventory management, and automated stock deductions.
          </p>
        </div>

        <div className="badge badge-amber" style={{ fontSize: 12, padding: "6px 12px" }}>
          {pendingCount} Prescriptions Awaiting Fulfillment
        </div>
      </div>

      {/* Prescriptions Worklist Card */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">Active Prescription Dispensing Queue</span>
          <span style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
            Directly linked to EMR consult pad
          </span>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Date & Time</th>
                <th>Patient Details</th>
                <th>Prescribing Doctor</th>
                <th>Medications Regimen</th>
                <th>Status</th>
                <th style={{ textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: "center", padding: "30px", color: "var(--text-muted)" }}>
                    Loading prescription queue...
                  </td>
                </tr>
              ) : prescriptions.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: "center", padding: "30px", color: "var(--text-muted)" }}>
                    No active prescriptions in queue.
                  </td>
                </tr>
              ) : (
                prescriptions.map((rx) => (
                  <tr key={rx.id}>
                    <td>
                      <div style={{ fontWeight: 600 }}>{formatDateTime(rx.createdAt)}</div>
                      {rx.dispensedAt && (
                        <div style={{ fontSize: 10.5, color: "var(--success)" }}>
                          Dispensed: {formatDateTime(rx.dispensedAt)}
                        </div>
                      )}
                    </td>

                    <td>
                      <strong>{rx.patient.firstName} {rx.patient.lastName}</strong>
                      <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-muted)" }}>
                        {rx.patient.mrn}
                      </div>
                    </td>

                    <td>
                      <div>{rx.doctor.name}</div>
                      <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{rx.doctor.department}</span>
                    </td>

                    {/* Medications Items */}
                    <td style={{ maxWidth: 360 }}>
                      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                        {rx.items?.map((item: any) => (
                          <div
                            key={item.id}
                            style={{
                              background: "var(--surface-2)",
                              padding: "4px 8px",
                              borderRadius: 4,
                              fontSize: 11.5,
                              border: "1px solid var(--border)",
                            }}
                          >
                            <div style={{ display: "flex", justifyContent: "space-between" }}>
                              <strong style={{ color: "var(--primary)" }}>{item.medicationName}</strong>
                              <span className="badge badge-gray" style={{ fontSize: 10 }}>Qty: {item.quantity}</span>
                            </div>
                            <div style={{ fontSize: 10.5, color: "var(--text-muted)" }}>
                              {item.dosage} • {item.frequency} • {item.duration}
                            </div>
                          </div>
                        ))}
                      </div>
                    </td>

                    <td>
                      <span className={`badge ${rx.status === "DISPENSED" ? "badge-green" : "badge-amber"}`}>
                        {rx.status}
                      </span>
                    </td>

                    <td style={{ textAlign: "right" }}>
                      {rx.status === "PENDING" ? (
                        <button
                          type="button"
                          onClick={() => handleDispense(rx.id)}
                          disabled={dispensingId === rx.id}
                          className="btn btn-success btn-sm"
                        >
                          {dispensingId === rx.id ? "Dispensing..." : "Fulfill & Dispense"}
                        </button>
                      ) : (
                        <span style={{ fontSize: 11, color: "var(--text-muted)", fontStyle: "italic" }}>
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
