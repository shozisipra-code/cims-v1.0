"use client";

import React, { useState, useEffect, use } from "react";
import Link from "next/link";
import {
  calculateAge,
  formatDate,
  formatDateTime,
  formatCurrency,
  getBloodPressureStatus,
} from "@/lib/utils";
import { useRole } from "@/components/layout/RoleContext";

export default function PatientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);
  const { id } = resolvedParams;
  const { currentUser } = useRole();

  const [patient, setPatient] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<
    "vitals" | "encounters" | "prescriptions" | "labs" | "billing"
  >("vitals");

  // Vitals Modal
  const [isVitalsModalOpen, setIsVitalsModalOpen] = useState(false);
  const [vitalsForm, setVitalsForm] = useState({
    systolicBP: "120",
    diastolicBP: "80",
    heartRate: "72",
    temperature: "98.6",
    respiratoryRate: "16",
    spO2: "98",
    weightKg: "70",
    heightCm: "175",
    bloodGlucose: "100",
    painScore: "0",
    notes: "",
  });
  const [savingVitals, setSavingVitals] = useState(false);

  const fetchPatient = () => {
    setLoading(true);
    fetch(`/api/patients/${id}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success) setPatient(data.patient);
      })
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchPatient();
  }, [id]);

  const handleSaveVitals = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingVitals(true);
    try {
      const res = await fetch("/api/vitals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patientId: id,
          ...vitalsForm,
          recordedBy: currentUser.name,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setIsVitalsModalOpen(false);
        fetchPatient();
      } else {
        alert(data.error || "Failed to record vitals");
      }
    } catch (err) {
      console.error(err);
      alert("Error saving vitals.");
    } finally {
      setSavingVitals(false);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>
        Loading patient 360 profile...
      </div>
    );
  }

  if (!patient) {
    return (
      <div className="card" style={{ padding: 40, textAlign: "center" }}>
        <h3 style={{ color: "var(--text-primary)", marginBottom: 8 }}>Patient not found</h3>
        <Link href="/patients" className="btn btn-primary btn-sm">
          Return to Patient Directory
        </Link>
      </div>
    );
  }

  let allergies: string[] = [];
  try {
    if (patient.allergies) allergies = JSON.parse(patient.allergies);
  } catch {
    allergies = patient.allergies ? [patient.allergies] : [];
  }

  let chronicConditions: string[] = [];
  try {
    if (patient.chronicConditions) chronicConditions = JSON.parse(patient.chronicConditions);
  } catch {
    chronicConditions = patient.chronicConditions ? [patient.chronicConditions] : [];
  }

  return (
    <div className="patient-detail-page">
      {/* Breadcrumb / Header */}
      <div className="page-header">
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
            <Link
              href="/patients"
              style={{ fontSize: 12, color: "var(--primary)", textDecoration: "none", fontWeight: 600 }}
            >
              &larr; Patients Directory
            </Link>
            <span style={{ color: "var(--text-muted)", fontSize: 12 }}>/</span>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 700 }}>
              {patient.mrn}
            </span>
          </div>
          <h1 className="page-title">
            {patient.firstName} {patient.lastName}
          </h1>
          <p className="page-subtitle">
            {calculateAge(patient.dateOfBirth)} years old • {patient.gender} • Blood:{" "}
            <strong style={{ color: "var(--danger)" }}>{patient.bloodGroup || "Unknown"}</strong>
          </p>
        </div>

        <div className="page-actions">
          <button
            type="button"
            onClick={() => setIsVitalsModalOpen(true)}
            className="btn btn-secondary btn-sm"
          >
            Record Vitals
          </button>
          <Link
            href={`/clinical?patientId=${patient.id}`}
            className="btn btn-primary btn-sm"
          >
            Start Consultation &rarr;
          </Link>
        </div>
      </div>

      {/* Patient Overview Card (LIMS style) */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-body">
          <div className="grid-3" style={{ gap: 14 }}>
            <div>
              <span className="stat-label">Contact Information</span>
              <p style={{ marginTop: 4, fontWeight: 600 }}>{patient.phone}</p>
              <p style={{ fontSize: 11.5, color: "var(--text-muted)" }}>{patient.email || "No email on file"}</p>
            </div>

            <div>
              <span className="stat-label">National ID / Address</span>
              <p style={{ marginTop: 4, fontFamily: "var(--font-mono)", fontSize: 12 }}>
                {patient.nationalId || "Not provided"}
              </p>
              <p style={{ fontSize: 11.5, color: "var(--text-muted)" }}>{patient.address || "No address"}</p>
            </div>

            <div>
              <span className="stat-label">Emergency Contact</span>
              <p style={{ marginTop: 4, fontWeight: 600 }}>
                {patient.emergencyContactName || "Not assigned"}
              </p>
              <p style={{ fontSize: 11.5, color: "var(--text-muted)" }}>
                {patient.emergencyContactPhone} ({patient.emergencyContactRelation || "Relative"})
              </p>
            </div>
          </div>

          {/* Allergy Alert Banner */}
          {allergies.length > 0 && allergies[0] !== "None known" && (
            <div className="alert alert-warning" style={{ marginTop: 14 }}>
              <span>
                <strong>Allergy Warning:</strong> Patient has known drug allergies to:{" "}
                <span style={{ textDecoration: "underline", fontWeight: 700 }}>{allergies.join(", ")}</span>
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Tab Navigation (LIMS button row style) */}
      <div style={{ display: "flex", gap: 8, marginBottom: 14, overflowX: "auto" }}>
        <button
          type="button"
          onClick={() => setActiveTab("vitals")}
          className={`btn ${activeTab === "vitals" ? "btn-primary" : "btn-secondary"} btn-sm`}
        >
          Vitals History ({patient.vitals?.length || 0})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("encounters")}
          className={`btn ${activeTab === "encounters" ? "btn-primary" : "btn-secondary"} btn-sm`}
        >
          Clinical SOAP Visits ({patient.encounters?.length || 0})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("prescriptions")}
          className={`btn ${activeTab === "prescriptions" ? "btn-primary" : "btn-secondary"} btn-sm`}
        >
          Prescriptions ({patient.prescriptions?.length || 0})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("labs")}
          className={`btn ${activeTab === "labs" ? "btn-primary" : "btn-secondary"} btn-sm`}
        >
          Diagnostic Labs ({patient.labOrders?.length || 0})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("billing")}
          className={`btn ${activeTab === "billing" ? "btn-primary" : "btn-secondary"} btn-sm`}
        >
          Invoices & Billing ({patient.invoices?.length || 0})
        </button>
      </div>

      {/* Tab 1: Vitals */}
      {activeTab === "vitals" && (
        <div className="card">
          <div className="card-header">
            <span className="card-title">Vital Signs Trend Log</span>
            <button
              type="button"
              onClick={() => setIsVitalsModalOpen(true)}
              className="btn btn-ghost btn-sm"
              style={{ color: "var(--primary)" }}
            >
              + Record Reading
            </button>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Recorded At</th>
                  <th>Blood Pressure</th>
                  <th>Heart Rate</th>
                  <th>Temp</th>
                  <th>SpO2</th>
                  <th>Weight / Height / BMI</th>
                  <th>Glucose</th>
                  <th>Recorded By</th>
                </tr>
              </thead>
              <tbody>
                {patient.vitals?.length ? (
                  patient.vitals.map((v: any) => {
                    const status = getBloodPressureStatus(v.systolicBP, v.diastolicBP);
                    return (
                      <tr key={v.id}>
                        <td style={{ fontFamily: "var(--font-mono)", fontSize: 11.5 }}>
                          {formatDateTime(v.recordedAt)}
                        </td>
                        <td>
                          <span style={{ fontFamily: "var(--font-mono)", fontWeight: 700 }}>
                            {v.systolicBP}/{v.diastolicBP}
                          </span>{" "}
                          <span className={`badge ${status.status === "Normal" ? "badge-green" : "badge-amber"}`}>
                            {status.status}
                          </span>
                        </td>
                        <td>{v.heartRate ? `${v.heartRate} bpm` : "--"}</td>
                        <td>{v.temperature ? `${v.temperature}°F` : "--"}</td>
                        <td>{v.spO2 ? `${v.spO2}%` : "--"}</td>
                        <td>
                          {v.weightKg ? `${v.weightKg} kg` : "--"} / {v.heightCm ? `${v.heightCm} cm` : "--"}{" "}
                          {v.bmi && (
                            <span className="badge badge-teal" style={{ marginLeft: 4 }}>
                              BMI {v.bmi}
                            </span>
                          )}
                        </td>
                        <td>{v.bloodGlucose ? `${v.bloodGlucose} mg/dL` : "--"}</td>
                        <td style={{ color: "var(--text-muted)" }}>{v.recordedBy || "Nurse"}</td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={8} style={{ textAlign: "center", padding: "30px", color: "var(--text-muted)" }}>
                      No vital signs recorded yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 2: Encounters */}
      {activeTab === "encounters" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {patient.encounters?.length ? (
            patient.encounters.map((enc: any) => (
              <div key={enc.id} className="card">
                <div className="card-header">
                  <div>
                    <span style={{ fontSize: 12, fontWeight: 700, color: "var(--primary)" }}>
                      Consultation: {formatDateTime(enc.encounterDate)}
                    </span>
                    <span style={{ fontSize: 11, color: "var(--text-muted)", marginLeft: 8 }}>
                      Attending: {enc.doctor?.name} ({enc.doctor?.department})
                    </span>
                  </div>
                  <span className={`badge ${enc.status === "FINALIZED" ? "badge-green" : "badge-amber"}`}>
                    {enc.status}
                  </span>
                </div>
                <div className="card-body">
                  <div className="grid-2" style={{ gap: 12, fontSize: 12.5 }}>
                    <div>
                      <strong style={{ display: "block", color: "var(--text-secondary)", marginBottom: 3 }}>
                        Chief Complaint
                      </strong>
                      <p style={{ background: "var(--surface-2)", padding: 10, borderRadius: 6, border: "1px solid var(--border)" }}>
                        {enc.chiefComplaint || "Routine consultation."}
                      </p>
                    </div>
                    <div>
                      <strong style={{ display: "block", color: "var(--text-secondary)", marginBottom: 3 }}>
                        History of Present Illness (HPI)
                      </strong>
                      <p style={{ background: "var(--surface-2)", padding: 10, borderRadius: 6, border: "1px solid var(--border)" }}>
                        {enc.hpi || "None documented."}
                      </p>
                    </div>
                    <div>
                      <strong style={{ display: "block", color: "var(--text-secondary)", marginBottom: 3 }}>
                        Physical Examination
                      </strong>
                      <p style={{ background: "var(--surface-2)", padding: 10, borderRadius: 6, border: "1px solid var(--border)" }}>
                        {enc.physicalExam || "Normal physical findings."}
                      </p>
                    </div>
                    <div>
                      <strong style={{ display: "block", color: "var(--text-secondary)", marginBottom: 3 }}>
                        Assessment & Plan
                      </strong>
                      <p style={{ background: "var(--surface-2)", padding: 10, borderRadius: 6, border: "1px solid var(--border)" }}>
                        {enc.assessmentPlan || "Continue supportive care."}
                      </p>
                    </div>
                  </div>

                  {enc.diagnoses?.length > 0 && (
                    <div style={{ marginTop: 12, borderTop: "1px solid var(--border)", paddingTop: 10 }}>
                      <span className="stat-label" style={{ display: "block", marginBottom: 6 }}>
                        ICD-10 Diagnoses
                      </span>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                        {enc.diagnoses.map((d: any) => (
                          <span key={d.id} className="badge badge-teal">
                            <strong>{d.icdCode}</strong> - {d.description} ({d.type})
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))
          ) : (
            <div className="card" style={{ padding: 30, textAlign: "center", color: "var(--text-muted)" }}>
              No clinical encounters recorded.
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Prescriptions */}
      {activeTab === "prescriptions" && (
        <div className="card">
          <div className="card-header">
            <span className="card-title">Prescription History</span>
          </div>
          <div className="card-body" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {patient.prescriptions?.length ? (
              patient.prescriptions.map((rx: any) => (
                <div
                  key={rx.id}
                  style={{
                    border: "1px solid var(--border)",
                    borderRadius: 6,
                    padding: 12,
                    background: "var(--surface-2)",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, fontSize: 12 }}>
                    <strong>Prescribed by {rx.doctor?.name} ({formatDate(rx.createdAt)})</strong>
                    <span className={`badge ${rx.status === "DISPENSED" ? "badge-green" : "badge-amber"}`}>
                      {rx.status}
                    </span>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {rx.items?.map((item: any) => (
                      <div
                        key={item.id}
                        style={{
                          background: "var(--surface)",
                          padding: "8px 12px",
                          border: "1px solid var(--border)",
                          borderRadius: 4,
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          fontSize: 12,
                        }}
                      >
                        <div>
                          <strong style={{ color: "var(--primary)" }}>{item.medicationName}</strong>
                          <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                            {item.dosage} • {item.frequency} • {item.duration} ({item.route})
                          </div>
                        </div>
                        <span className="badge badge-gray">Qty: {item.quantity}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            ) : (
              <span style={{ fontSize: 12, color: "var(--text-muted)", textAlign: "center", padding: 20 }}>
                No prescriptions on record.
              </span>
            )}
          </div>
        </div>
      )}

      {/* Tab 4: Labs */}
      {activeTab === "labs" && (
        <div className="card">
          <div className="card-header">
            <span className="card-title">Laboratory Diagnostic Orders</span>
          </div>
          <div className="card-body" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {patient.labOrders?.length ? (
              patient.labOrders.map((order: any) => (
                <div
                  key={order.id}
                  style={{
                    border: "1px solid var(--border)",
                    borderRadius: 6,
                    padding: 12,
                    background: "var(--surface-2)",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, fontSize: 12 }}>
                    <div>
                      <strong style={{ fontFamily: "var(--font-mono)", color: "var(--primary)" }}>
                        {order.orderNumber}
                      </strong>
                      <span style={{ color: "var(--text-muted)", marginLeft: 8 }}>
                        Ordered {formatDate(order.orderedAt)} by {order.doctor?.name}
                      </span>
                    </div>
                    <span className={`badge ${order.status === "COMPLETED" ? "badge-green" : "badge-blue"}`}>
                      {order.status}
                    </span>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {order.items?.map((item: any) => (
                      <div
                        key={item.id}
                        style={{
                          background: "var(--surface)",
                          padding: "8px 12px",
                          border: "1px solid var(--border)",
                          borderRadius: 4,
                          fontSize: 12,
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between" }}>
                          <strong>{item.testName}</strong>
                          {item.isAbnormal && <span className="badge badge-red">ABNORMAL</span>}
                        </div>
                        <div style={{ marginTop: 2, display: "flex", gap: 8, alignItems: "baseline" }}>
                          <span style={{ fontFamily: "var(--font-mono)", fontWeight: 700, fontSize: 14 }}>
                            {item.resultValue || "Pending Analysis"}
                          </span>
                          <span style={{ color: "var(--text-muted)", fontSize: 11 }}>{item.unit}</span>
                        </div>
                        {item.referenceRange && (
                          <div style={{ fontSize: 10.5, color: "var(--text-muted)", marginTop: 2 }}>
                            Ref: {item.referenceRange}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))
            ) : (
              <span style={{ fontSize: 12, color: "var(--text-muted)", textAlign: "center", padding: 20 }}>
                No diagnostic lab orders on file.
              </span>
            )}
          </div>
        </div>
      )}

      {/* Tab 5: Billing */}
      {activeTab === "billing" && (
        <div className="card">
          <div className="card-header">
            <span className="card-title">Invoices & Statements</span>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Invoice #</th>
                  <th>Date</th>
                  <th>Billed Amount</th>
                  <th>Paid Amount</th>
                  <th>Balance Due</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {patient.invoices?.length ? (
                  patient.invoices.map((inv: any) => (
                    <tr key={inv.id}>
                      <td style={{ fontFamily: "var(--font-mono)", fontWeight: 700, color: "var(--primary)" }}>
                        {inv.invoiceNumber}
                      </td>
                      <td style={{ fontFamily: "var(--font-mono)", fontSize: 11.5 }}>
                        {formatDate(inv.createdAt)}
                      </td>
                      <td style={{ fontWeight: 700 }}>{formatCurrency(inv.totalAmount)}</td>
                      <td style={{ color: "var(--success)" }}>{formatCurrency(inv.paidAmount)}</td>
                      <td style={{ color: inv.balanceDue > 0 ? "var(--danger)" : "var(--text-muted)", fontWeight: 700 }}>
                        {formatCurrency(inv.balanceDue)}
                      </td>
                      <td>
                        <span className={`badge ${inv.status === "PAID" ? "badge-green" : "badge-red"}`}>
                          {inv.status}
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} style={{ textAlign: "center", padding: "30px", color: "var(--text-muted)" }}>
                      No invoices recorded.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Record Vitals Modal */}
      {isVitalsModalOpen && (
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
              maxWidth: 520,
              width: "100%",
              boxShadow: "var(--shadow-lg)",
            }}
          >
            <div className="card-header">
              <span className="card-title">Record Vital Signs</span>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => setIsVitalsModalOpen(false)}
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleSaveVitals} className="card-body">
              <div className="form-grid form-grid-2" style={{ marginBottom: 12 }}>
                <div className="form-group">
                  <label className="form-label required">Systolic BP (mmHg)</label>
                  <input
                    type="number"
                    required
                    className="form-input"
                    value={vitalsForm.systolicBP}
                    onChange={(e) => setVitalsForm({ ...vitalsForm, systolicBP: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label required">Diastolic BP (mmHg)</label>
                  <input
                    type="number"
                    required
                    className="form-input"
                    value={vitalsForm.diastolicBP}
                    onChange={(e) => setVitalsForm({ ...vitalsForm, diastolicBP: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Heart Rate (bpm)</label>
                  <input
                    type="number"
                    className="form-input"
                    value={vitalsForm.heartRate}
                    onChange={(e) => setVitalsForm({ ...vitalsForm, heartRate: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Temperature (°F)</label>
                  <input
                    type="number"
                    step="0.1"
                    className="form-input"
                    value={vitalsForm.temperature}
                    onChange={(e) => setVitalsForm({ ...vitalsForm, temperature: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">SpO2 Oxygen (%)</label>
                  <input
                    type="number"
                    className="form-input"
                    value={vitalsForm.spO2}
                    onChange={(e) => setVitalsForm({ ...vitalsForm, spO2: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Resp Rate (/min)</label>
                  <input
                    type="number"
                    className="form-input"
                    value={vitalsForm.respiratoryRate}
                    onChange={(e) => setVitalsForm({ ...vitalsForm, respiratoryRate: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Weight (kg)</label>
                  <input
                    type="number"
                    step="0.1"
                    className="form-input"
                    value={vitalsForm.weightKg}
                    onChange={(e) => setVitalsForm({ ...vitalsForm, weightKg: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Height (cm)</label>
                  <input
                    type="number"
                    className="form-input"
                    value={vitalsForm.heightCm}
                    onChange={(e) => setVitalsForm({ ...vitalsForm, heightCm: e.target.value })}
                  />
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: 14 }}>
                <label className="form-label">Observation Notes</label>
                <textarea
                  rows={2}
                  className="form-textarea"
                  value={vitalsForm.notes}
                  onChange={(e) => setVitalsForm({ ...vitalsForm, notes: e.target.value })}
                  placeholder="Patient reports morning fatigue or dizziness..."
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setIsVitalsModalOpen(false)}
                >
                  Cancel
                </button>
                <button type="submit" disabled={savingVitals} className="btn btn-primary">
                  {savingVitals ? "Saving..." : "Save Vitals"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
