"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { COMMON_ICD10_CODES } from "@/lib/constants/icd10";
import { FORMULARY_MEDICATIONS } from "@/lib/constants/medications";
import { STANDARD_LAB_TESTS } from "@/lib/constants/labTests";
import { calculateAge, getBloodPressureStatus } from "@/lib/utils";
import { useRole } from "@/components/layout/RoleContext";

interface PrescriptionRow {
  medicationName: string;
  dosage: string;
  frequency: string;
  duration: string;
  instructions: string;
  quantity: number;
}

interface LabTestRow {
  testName: string;
  category: string;
  referenceRange: string;
}

function ClinicalWorkspaceContent() {
  const searchParams = useSearchParams();
  const patientIdParam = searchParams.get("patientId");
  const appointmentIdParam = searchParams.get("appointmentId");

  const { currentUser } = useRole();

  const [patients, setPatients] = useState<any[]>([]);
  const [selectedPatientId, setSelectedPatientId] = useState<string>("");
  const [patient, setPatient] = useState<any | null>(null);
  const [loadingPatient, setLoadingPatient] = useState(false);

  // Active Encounter State
  const [activeEncounterId, setActiveEncounterId] = useState<string | null>(null);

  // SOAP State
  const [soap, setSoap] = useState({
    chiefComplaint: "",
    hpi: "",
    physicalExam: "Alert, conscious, oriented x3. CVS: S1+S2 heard. Chest: Clear bilaterally.",
    assessmentPlan: "",
    clinicalNotes: "",
  });

  // Diagnoses State
  const [diagnoses, setDiagnoses] = useState<
    { icdCode: string; description: string; type: string }[]
  >([]);
  const [selectedIcdCode, setSelectedIcdCode] = useState<string>("");

  // Prescriptions State
  const [prescriptionItems, setPrescriptionItems] = useState<PrescriptionRow[]>([]);
  const [newRx, setNewRx] = useState<PrescriptionRow>({
    medicationName: FORMULARY_MEDICATIONS[0].brandName,
    dosage: FORMULARY_MEDICATIONS[0].defaultDosage,
    frequency: FORMULARY_MEDICATIONS[0].defaultFrequency,
    duration: FORMULARY_MEDICATIONS[0].defaultDuration,
    instructions: "Take after meals",
    quantity: 10,
  });

  // Lab Orders State
  const [orderedLabs, setOrderedLabs] = useState<LabTestRow[]>([]);
  const [selectedLabTest, setSelectedLabTest] = useState<string>("");

  // Finalizing state
  const [finalizing, setFinalizing] = useState(false);
  const [finalizedSuccess, setFinalizedSuccess] = useState(false);

  // 1. Fetch patients list
  useEffect(() => {
    fetch("/api/patients")
      .then((r) => r.json())
      .then((d) => {
        if (d.success) {
          setPatients(d.patients);
          const defaultId = patientIdParam || (d.patients.length ? d.patients[0].id : "");
          setSelectedPatientId(defaultId);
        }
      });
  }, [patientIdParam]);

  // 2. Fetch full patient profile when selectedPatientId changes
  useEffect(() => {
    if (!selectedPatientId) return;
    setLoadingPatient(true);
    setFinalizedSuccess(false);

    fetch(`/api/patients/${selectedPatientId}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.success) {
          const pt = d.patient;
          setPatient(pt);

          // If there's an active in-progress encounter, preload it
          const inProgress = pt.encounters?.find((e: any) => e.status === "IN_PROGRESS");
          if (inProgress) {
            setActiveEncounterId(inProgress.id);
            setSoap({
              chiefComplaint: inProgress.chiefComplaint || "",
              hpi: inProgress.hpi || "",
              physicalExam: inProgress.physicalExam || "Normal physical findings.",
              assessmentPlan: inProgress.assessmentPlan || "",
              clinicalNotes: inProgress.clinicalNotes || "",
            });
            if (inProgress.diagnoses) {
              setDiagnoses(
                inProgress.diagnoses.map((dx: any) => ({
                  icdCode: dx.icdCode,
                  description: dx.description,
                  type: dx.type,
                }))
              );
            }
          } else {
            setActiveEncounterId(null);
            setSoap({
              chiefComplaint: "General review and consultation",
              hpi: "",
              physicalExam: "Alert, conscious, oriented x3. CVS: Normal heart sounds. Chest: Clear bilaterally.",
              assessmentPlan: "",
              clinicalNotes: "",
            });
            setDiagnoses([]);
            setPrescriptionItems([]);
            setOrderedLabs([]);
          }
        }
      })
      .finally(() => setLoadingPatient(false));
  }, [selectedPatientId]);

  const handleMedSelect = (brandName: string) => {
    const med = FORMULARY_MEDICATIONS.find((m) => m.brandName === brandName);
    if (med) {
      setNewRx({
        medicationName: med.brandName,
        dosage: med.defaultDosage,
        frequency: med.defaultFrequency,
        duration: med.defaultDuration,
        instructions: "Take as directed",
        quantity: 10,
      });
    }
  };

  const addPrescriptionItem = () => {
    if (!newRx.medicationName) return;
    setPrescriptionItems([...prescriptionItems, newRx]);
  };

  const removePrescriptionItem = (index: number) => {
    setPrescriptionItems(prescriptionItems.filter((_, i) => i !== index));
  };

  const addLabTest = () => {
    if (!selectedLabTest) return;
    const test = STANDARD_LAB_TESTS.find((t) => t.testCode === selectedLabTest);
    if (test && !orderedLabs.some((l) => l.testName === test.testName)) {
      setOrderedLabs([
        ...orderedLabs,
        {
          testName: test.testName,
          category: test.category,
          referenceRange: test.normalRange,
        },
      ]);
      setSelectedLabTest("");
    }
  };

  const removeLabTest = (testName: string) => {
    setOrderedLabs(orderedLabs.filter((l) => l.testName !== testName));
  };

  const addDiagnosis = (code: string) => {
    const item = COMMON_ICD10_CODES.find((c) => c.code === code);
    if (item && !diagnoses.some((d) => d.icdCode === item.code)) {
      setDiagnoses([
        ...diagnoses,
        {
          icdCode: item.code,
          description: item.description,
          type: "FINAL",
        },
      ]);
      setSelectedIcdCode("");
    }
  };

  const removeDiagnosis = (code: string) => {
    setDiagnoses(diagnoses.filter((d) => d.icdCode !== code));
  };

  const handleFinalizeConsultation = async () => {
    if (!patient) return;
    setFinalizing(true);
    try {
      let encId = activeEncounterId;
      if (!encId) {
        const encRes = await fetch("/api/encounters", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            patientId: patient.id,
            doctorId: currentUser.id.startsWith("usr_doc") ? currentUser.id : "usr_doc_1",
            appointmentId: appointmentIdParam || null,
            chiefComplaint: soap.chiefComplaint,
            hpi: soap.hpi,
          }),
        });
        const encData = await encRes.json();
        if (encData.success) {
          encId = encData.encounter.id;
        }
      }

      await fetch("/api/encounters", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: encId,
          chiefComplaint: soap.chiefComplaint,
          hpi: soap.hpi,
          physicalExam: soap.physicalExam,
          assessmentPlan: soap.assessmentPlan,
          clinicalNotes: soap.clinicalNotes,
          status: "FINALIZED",
        }),
      });

      for (const dx of diagnoses) {
        await fetch("/api/diagnoses", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            encounterId: encId,
            icdCode: dx.icdCode,
            description: dx.description,
            type: dx.type,
          }),
        });
      }

      if (prescriptionItems.length > 0) {
        await fetch("/api/prescriptions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            encounterId: encId,
            patientId: patient.id,
            doctorId: currentUser.id.startsWith("usr_doc") ? currentUser.id : "usr_doc_1",
            items: prescriptionItems,
            notes: "Clinical consultation e-prescription",
          }),
        });
      }

      if (orderedLabs.length > 0) {
        await fetch("/api/lab-orders", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            encounterId: encId,
            patientId: patient.id,
            doctorId: currentUser.id.startsWith("usr_doc") ? currentUser.id : "usr_doc_1",
            priority: "ROUTINE",
            tests: orderedLabs,
          }),
        });
      }

      // Generate invoice
      const billItems = [
        {
          description: `Physician Consultation (${currentUser.name})`,
          category: "CONSULTATION",
          quantity: 1,
          unitPrice: 50.0,
          totalPrice: 50.0,
        },
      ];

      orderedLabs.forEach((l) => {
        billItems.push({
          description: `Lab Test: ${l.testName}`,
          category: "LAB_TEST",
          quantity: 1,
          unitPrice: 30.0,
          totalPrice: 30.0,
        });
      });

      prescriptionItems.forEach((rx) => {
        billItems.push({
          description: `Medication: ${rx.medicationName}`,
          category: "PHARMACY",
          quantity: rx.quantity || 1,
          unitPrice: 1.5,
          totalPrice: (rx.quantity || 1) * 1.5,
        });
      });

      await fetch("/api/billing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patientId: patient.id,
          encounterId: encId,
          items: billItems,
          discount: 0,
          tax: 5.0,
          paymentMethod: "Cash",
        }),
      });

      setFinalizedSuccess(true);
      fetch(`/api/patients/${patient.id}`)
        .then((r) => r.json())
        .then((d) => {
          if (d.success) setPatient(d.patient);
        });
    } catch (e) {
      console.error("Failed to finalize encounter:", e);
      alert("Error finalizing clinical encounter.");
    } finally {
      setFinalizing(false);
    }
  };

  const latestVitals = patient?.vitals?.[0];
  const bpStatus = latestVitals
    ? getBloodPressureStatus(latestVitals.systolicBP, latestVitals.diastolicBP)
    : null;

  let allergies: string[] = [];
  try {
    if (patient?.allergies) allergies = JSON.parse(patient.allergies);
  } catch {
    allergies = patient?.allergies ? [patient.allergies] : [];
  }

  return (
    <div className="clinical-workspace-page">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Doctor Clinical Workspace</h1>
          <p className="page-subtitle">
            SOAP clinical notes, ICD-10 coding, vital signs, and electronic prescription pad.
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-secondary)" }}>
            Active Patient:
          </span>
          <select
            value={selectedPatientId}
            onChange={(e) => setSelectedPatientId(e.target.value)}
            className="form-select"
            style={{ width: "auto", minWidth: 220, fontWeight: 700 }}
          >
            {patients.map((p) => (
              <option key={p.id} value={p.id}>
                {p.firstName} {p.lastName} ({p.mrn})
              </option>
            ))}
          </select>
        </div>
      </div>

      {finalizedSuccess && (
        <div className="alert alert-success" style={{ marginBottom: 16 }}>
          <span>
            <strong>Encounter Finalized:</strong> Clinical note signed. Orders dispatched to Pharmacy & Laboratory.
          </span>
          <Link
            href={`/patients/${patient?.id}`}
            className="btn btn-secondary btn-sm"
            style={{ marginLeft: "auto" }}
          >
            View Patient 360
          </Link>
        </div>
      )}

      {/* Patient Bio & Vitals Overview Bar */}
      {patient && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-body" style={{ padding: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
              <div>
                <strong style={{ fontSize: 15, color: "var(--primary)" }}>
                  {patient.firstName} {patient.lastName}
                </strong>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 11.5, color: "var(--text-muted)", marginLeft: 8 }}>
                  {patient.mrn} • {calculateAge(patient.dateOfBirth)} yrs • {patient.gender}
                </span>
              </div>

              {/* Vitals summary chips */}
              <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                <div>
                  <span className="stat-label">Blood Pressure:</span>
                  <span style={{ fontFamily: "var(--font-mono)", fontWeight: 700, marginLeft: 4 }}>
                    {latestVitals ? `${latestVitals.systolicBP}/${latestVitals.diastolicBP}` : "--"}
                  </span>
                  {bpStatus && (
                    <span className={`badge ${bpStatus.status === "Normal" ? "badge-green" : "badge-amber"}`} style={{ marginLeft: 4 }}>
                      {bpStatus.status}
                    </span>
                  )}
                </div>

                <div>
                  <span className="stat-label">Heart Rate:</span>
                  <span style={{ fontFamily: "var(--font-mono)", fontWeight: 700, marginLeft: 4 }}>
                    {latestVitals?.heartRate ? `${latestVitals.heartRate} bpm` : "--"}
                  </span>
                </div>

                <div>
                  <span className="stat-label">SpO2:</span>
                  <span style={{ fontFamily: "var(--font-mono)", fontWeight: 700, marginLeft: 4 }}>
                    {latestVitals?.spO2 ? `${latestVitals.spO2}%` : "--"}
                  </span>
                </div>

                <div>
                  <span className="stat-label">BMI:</span>
                  <span style={{ fontFamily: "var(--font-mono)", fontWeight: 700, marginLeft: 4 }}>
                    {latestVitals?.bmi || "--"}
                  </span>
                </div>
              </div>
            </div>

            {allergies.length > 0 && allergies[0] !== "None known" && (
              <div className="alert alert-warning" style={{ marginTop: 10, padding: "8px 12px" }}>
                <span style={{ fontSize: 12 }}>
                  <strong>Known Allergies:</strong> {allergies.join(", ")}
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 2-Column Editor Grid */}
      <div className="grid-2">
        {/* Left Column: SOAP Notes */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {/* S - Subjective */}
          <div className="card">
            <div className="card-header">
              <span className="card-title">Subjective (S) - Chief Complaint & HPI</span>
            </div>
            <div className="card-body" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div className="form-group">
                <label className="form-label required">Chief Complaint</label>
                <input
                  type="text"
                  className="form-input"
                  value={soap.chiefComplaint}
                  onChange={(e) => setSoap({ ...soap, chiefComplaint: e.target.value })}
                  placeholder="e.g. Cough and low-grade fever for 3 days"
                />
              </div>

              <div className="form-group">
                <label className="form-label">History of Present Illness (HPI)</label>
                <textarea
                  rows={3}
                  className="form-textarea"
                  value={soap.hpi}
                  onChange={(e) => setSoap({ ...soap, hpi: e.target.value })}
                  placeholder="Document progression, duration, aggravating factors..."
                />
              </div>
            </div>
          </div>

          {/* O - Objective */}
          <div className="card">
            <div className="card-header">
              <span className="card-title">Objective (O) - Physical Examination</span>
            </div>
            <div className="card-body">
              <textarea
                rows={3}
                className="form-textarea"
                value={soap.physicalExam}
                onChange={(e) => setSoap({ ...soap, physicalExam: e.target.value })}
              />
            </div>
          </div>

          {/* A - Assessment & ICD-10 */}
          <div className="card">
            <div className="card-header">
              <span className="card-title">Assessment (A) - ICD-10 Diagnoses</span>
            </div>
            <div className="card-body" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <select
                value={selectedIcdCode}
                onChange={(e) => {
                  setSelectedIcdCode(e.target.value);
                  if (e.target.value) addDiagnosis(e.target.value);
                }}
                className="form-select"
              >
                <option value="">-- Add ICD-10 Diagnostic Code --</option>
                {COMMON_ICD10_CODES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.code} - {c.description} ({c.category})
                  </option>
                ))}
              </select>

              {diagnoses.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {diagnoses.map((d) => (
                    <span
                      key={d.icdCode}
                      className="badge badge-teal"
                      style={{ padding: "4px 8px", fontSize: 11.5 }}
                    >
                      <strong>{d.icdCode}</strong> {d.description}
                      <button
                        type="button"
                        onClick={() => removeDiagnosis(d.icdCode)}
                        style={{ border: 0, background: "transparent", color: "var(--danger)", marginLeft: 6, cursor: "pointer" }}
                      >
                        &times;
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* P - Plan */}
          <div className="card">
            <div className="card-header">
              <span className="card-title">Plan (P) - Counseling & Management</span>
            </div>
            <div className="card-body">
              <textarea
                rows={3}
                className="form-textarea"
                value={soap.assessmentPlan}
                onChange={(e) => setSoap({ ...soap, assessmentPlan: e.target.value })}
                placeholder="Care instructions, dietary recommendations, follow-up..."
              />
            </div>
          </div>
        </div>

        {/* Right Column: Prescriptions & Diagnostic Lab Orders */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {/* e-Prescription Pad */}
          <div className="card">
            <div className="card-header">
              <span className="card-title">Electronic Prescription (e-Rx)</span>
              <span className="badge badge-green">Formulary Linked</span>
            </div>
            <div className="card-body" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {prescriptionItems.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {prescriptionItems.map((item, idx) => (
                    <div
                      key={idx}
                      style={{
                        padding: "8px 12px",
                        background: "var(--surface-2)",
                        border: "1px solid var(--border)",
                        borderRadius: 4,
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <div>
                        <strong style={{ color: "var(--primary)", fontSize: 12.5 }}>{item.medicationName}</strong>
                        <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                          {item.dosage} • {item.frequency} • {item.duration}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => removePrescriptionItem(idx)}
                        className="btn btn-ghost btn-sm"
                        style={{ color: "var(--danger)" }}
                      >
                        &times;
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Add Med Mini Form */}
              <div style={{ background: "var(--surface-2)", padding: 12, borderRadius: 6, border: "1px solid var(--border)" }}>
                <div className="form-group" style={{ marginBottom: 8 }}>
                  <label className="form-label">Drug / Formulary Item</label>
                  <select
                    className="form-select"
                    value={newRx.medicationName}
                    onChange={(e) => handleMedSelect(e.target.value)}
                  >
                    {FORMULARY_MEDICATIONS.map((m) => (
                      <option key={m.brandName} value={m.brandName}>
                        {m.brandName} ({m.genericName} - {m.strength})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-grid form-grid-2" style={{ marginBottom: 8 }}>
                  <div className="form-group">
                    <label className="form-label">Dosage</label>
                    <input
                      type="text"
                      className="form-input"
                      value={newRx.dosage}
                      onChange={(e) => setNewRx({ ...newRx, dosage: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Duration</label>
                    <input
                      type="text"
                      className="form-input"
                      value={newRx.duration}
                      onChange={(e) => setNewRx({ ...newRx, duration: e.target.value })}
                    />
                  </div>
                </div>

                <div className="form-group" style={{ marginBottom: 10 }}>
                  <label className="form-label">Frequency Schedule</label>
                  <input
                    type="text"
                    className="form-input"
                    value={newRx.frequency}
                    onChange={(e) => setNewRx({ ...newRx, frequency: e.target.value })}
                  />
                </div>

                <button
                  type="button"
                  onClick={addPrescriptionItem}
                  className="btn btn-secondary btn-sm"
                  style={{ width: "100%", justifyContent: "center" }}
                >
                  + Add Medication
                </button>
              </div>
            </div>
          </div>

          {/* Lab Test Orders */}
          <div className="card">
            <div className="card-header">
              <span className="card-title">Diagnostic Laboratory Orders</span>
              <span className="badge badge-blue">LIS</span>
            </div>
            <div className="card-body" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {orderedLabs.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {orderedLabs.map((l) => (
                    <span key={l.testName} className="badge badge-blue" style={{ padding: "4px 8px" }}>
                      {l.testName}
                      <button
                        type="button"
                        onClick={() => removeLabTest(l.testName)}
                        style={{ border: 0, background: "transparent", color: "var(--danger)", marginLeft: 6, cursor: "pointer" }}
                      >
                        &times;
                      </button>
                    </span>
                  ))}
                </div>
              )}

              <div style={{ display: "flex", gap: 8 }}>
                <select
                  className="form-select"
                  value={selectedLabTest}
                  onChange={(e) => setSelectedLabTest(e.target.value)}
                  style={{ flex: 1 }}
                >
                  <option value="">-- Select Lab Test Panel --</option>
                  {STANDARD_LAB_TESTS.map((t) => (
                    <option key={t.testCode} value={t.testCode}>
                      {t.testName} (${t.price.toFixed(2)})
                    </option>
                  ))}
                </select>
                <button type="button" onClick={addLabTest} className="btn btn-secondary btn-sm">
                  Add Test
                </button>
              </div>
            </div>
          </div>

          {/* Finalize Action Card */}
          <div className="card">
            <div className="card-body">
              <h4 style={{ color: "var(--primary)", marginBottom: 6 }}>Finalize & Sign Clinical Encounter</h4>
              <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 14 }}>
                Locks SOAP notes, dispatches prescriptions to Pharmacy, orders to LIS, and compiles itemized patient bill.
              </p>
              <button
                type="button"
                onClick={handleFinalizeConsultation}
                disabled={finalizing || !patient}
                className="btn btn-primary"
                style={{ width: "100%", justifyContent: "center", padding: "10px 16px" }}
              >
                {finalizing ? "Finalizing Note..." : "Sign & Finalize Consultation"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ClinicalWorkspacePage() {
  return (
    <Suspense fallback={<div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)" }}>Loading Clinical Workspace...</div>}>
      <ClinicalWorkspaceContent />
    </Suspense>
  );
}
