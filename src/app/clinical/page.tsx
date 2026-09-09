"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Stethoscope,
  User,
  Heart,
  AlertTriangle,
  FileText,
  Pill,
  FlaskConical,
  Plus,
  Trash2,
  CheckCircle2,
  Clock,
  Sparkles,
  ShieldCheck,
  ChevronDown,
  Info,
} from "lucide-react";
import { COMMON_ICD10_CODES } from "@/lib/constants/icd10";
import { FORMULARY_MEDICATIONS } from "@/lib/constants/medications";
import { STANDARD_LAB_TESTS } from "@/lib/constants/labTests";
import { calculateAge, calculateBMI, getBloodPressureStatus, formatDateTime } from "@/lib/utils";
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
    physicalExam: "Alert, conscious, oriented x3. CVS: Normal heart sounds. Chest: Clear bilaterally.",
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
    instructions: "Take after food",
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

  // Handle Medication selection change
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

  // Handle Lab Test Add
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

  // Add ICD-10 diagnosis
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

  // Finalize Consultation & Generate Orders
  const handleFinalizeConsultation = async () => {
    if (!patient) return;
    setFinalizing(true);
    try {
      // 1. Create or update encounter
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

      // Update SOAP and mark FINALIZED
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

      // 2. Save Diagnoses
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

      // 3. Save Prescriptions if any
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

      // 4. Save Lab Orders if any
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

      // 5. Generate Point-of-Care Billing Invoice automatically
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
      // Refresh patient data
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
    <div className="space-y-6">
      {/* Top Clinician Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight flex items-center gap-2.5">
            <Stethoscope className="w-6 h-6 text-teal-600" />
            Doctor Clinical Workspace & EMR
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Conduct outpatient encounters, document SOAP notes, add ICD-10 diagnoses, and issue e-prescriptions.
          </p>
        </div>

        {/* Patient Selector */}
        <div className="flex items-center gap-3">
          <label className="text-xs font-semibold text-slate-600">Active Patient:</label>
          <select
            value={selectedPatientId}
            onChange={(e) => setSelectedPatientId(e.target.value)}
            className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
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
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center justify-between animate-in fade-in">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
            <div>
              <p className="text-xs font-bold text-emerald-900">
                Clinical Encounter Successfully Finalized!
              </p>
              <p className="text-[11px] text-emerald-700">
                Orders have been dispatched to Pharmacy and Laboratory. An itemized invoice was generated.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href={`/patients/${patient?.id}`}
              className="text-xs px-3 py-1.5 bg-emerald-600 text-white rounded-lg font-semibold hover:bg-emerald-700"
            >
              View Patient 360
            </Link>
          </div>
        </div>
      )}

      {/* Patient Bio & Vitals Overview Bar */}
      {patient && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-xl bg-teal-600 text-white font-bold text-base flex items-center justify-center shadow-sm">
                {patient.firstName[0]}
                {patient.lastName[0]}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-bold text-slate-900">
                    {patient.firstName} {patient.lastName}
                  </h2>
                  <span className="font-mono text-xs font-bold text-teal-800 bg-teal-50 px-2 py-0.2 rounded border border-teal-200">
                    {patient.mrn}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  {calculateAge(patient.dateOfBirth)} yrs • {patient.gender} • Blood:{" "}
                  <strong className="text-red-600">{patient.bloodGroup || "Unknown"}</strong>
                </p>
              </div>
            </div>

            {/* Quick Vitals Metrics */}
            <div className="flex items-center gap-4 text-xs bg-slate-50 p-3 rounded-xl border border-slate-200 flex-wrap">
              <div>
                <span className="text-[10px] text-slate-400 block uppercase font-bold">Blood Pressure</span>
                {latestVitals ? (
                  <span className="font-bold text-slate-800">
                    {latestVitals.systolicBP}/{latestVitals.diastolicBP} mmHg{" "}
                    <span className={`text-[10px] px-1 rounded font-semibold ${bpStatus?.color}`}>
                      {bpStatus?.status}
                    </span>
                  </span>
                ) : (
                  <span className="text-slate-400">--</span>
                )}
              </div>

              <div className="h-6 w-px bg-slate-200"></div>

              <div>
                <span className="text-[10px] text-slate-400 block uppercase font-bold">Heart Rate</span>
                <span className="font-bold text-slate-800">
                  {latestVitals?.heartRate ? `${latestVitals.heartRate} bpm` : "--"}
                </span>
              </div>

              <div className="h-6 w-px bg-slate-200"></div>

              <div>
                <span className="text-[10px] text-slate-400 block uppercase font-bold">Temperature</span>
                <span className="font-bold text-slate-800">
                  {latestVitals?.temperature ? `${latestVitals.temperature}°F` : "--"}
                </span>
              </div>

              <div className="h-6 w-px bg-slate-200"></div>

              <div>
                <span className="text-[10px] text-slate-400 block uppercase font-bold">SpO2 Oxygen</span>
                <span className="font-bold text-slate-800">
                  {latestVitals?.spO2 ? `${latestVitals.spO2}%` : "--"}
                </span>
              </div>

              <div className="h-6 w-px bg-slate-200"></div>

              <div>
                <span className="text-[10px] text-slate-400 block uppercase font-bold">BMI</span>
                <span className="font-bold text-slate-800">
                  {latestVitals?.bmi ? `${latestVitals.bmi}` : "--"}
                </span>
              </div>
            </div>
          </div>

          {/* Prominent Allergy Banner */}
          {allergies.length > 0 && allergies[0] !== "None known" && (
            <div className="flex items-center gap-2 p-2.5 rounded-lg bg-amber-50 border border-amber-300 text-xs text-amber-900 font-semibold">
              <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
              <span>Allergy Alert: Patient has documented allergies to </span>
              <span className="underline font-bold">{allergies.join(", ")}</span>
            </div>
          )}
        </div>
      )}

      {/* Main Consultation Editor Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: SOAP Note Editor */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                <FileText className="w-4 h-4 text-teal-600" />
                SOAP Clinical Documentation
              </h2>
              <span className="text-[11px] text-slate-400 font-medium">Standard Clinical Notes Format</span>
            </div>

            {/* S - Subjective */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-teal-100 text-teal-800 font-bold text-xs flex items-center justify-center">
                  S
                </span>
                <h3 className="text-xs font-bold text-slate-800 uppercase">Subjective History</h3>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-600 block mb-1">
                  Chief Complaint *
                </label>
                <input
                  type="text"
                  value={soap.chiefComplaint}
                  onChange={(e) => setSoap({ ...soap, chiefComplaint: e.target.value })}
                  placeholder="e.g. Headache for 3 days, sore throat and dry cough."
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-600 block mb-1">
                  History of Present Illness (HPI)
                </label>
                <textarea
                  rows={3}
                  value={soap.hpi}
                  onChange={(e) => setSoap({ ...soap, hpi: e.target.value })}
                  placeholder="Describe onset, duration, character, aggravating and relieving factors..."
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>
            </div>

            {/* O - Objective */}
            <div className="space-y-3 pt-3 border-t border-slate-100">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-800 font-bold text-xs flex items-center justify-center">
                  O
                </span>
                <h3 className="text-xs font-bold text-slate-800 uppercase">
                  Objective / Physical Examination
                </h3>
              </div>

              <div>
                <textarea
                  rows={3}
                  value={soap.physicalExam}
                  onChange={(e) => setSoap({ ...soap, physicalExam: e.target.value })}
                  placeholder="Document physical exam findings, general appearance, systemic exams..."
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>
            </div>

            {/* A - Assessment & Diagnoses */}
            <div className="space-y-3 pt-3 border-t border-slate-100">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-purple-100 text-purple-800 font-bold text-xs flex items-center justify-center">
                    A
                  </span>
                  <h3 className="text-xs font-bold text-slate-800 uppercase">
                    Assessment & ICD-10 Diagnoses
                  </h3>
                </div>
              </div>

              {/* ICD-10 Selector */}
              <div className="flex gap-2">
                <select
                  value={selectedIcdCode}
                  onChange={(e) => {
                    setSelectedIcdCode(e.target.value);
                    if (e.target.value) addDiagnosis(e.target.value);
                  }}
                  className="flex-1 px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg"
                >
                  <option value="">-- Add ICD-10 Diagnosis (Search Common Conditions) --</option>
                  {COMMON_ICD10_CODES.map((icd) => (
                    <option key={icd.code} value={icd.code}>
                      {icd.code} - {icd.description} ({icd.category})
                    </option>
                  ))}
                </select>
              </div>

              {/* Added Diagnoses Badges */}
              {diagnoses.length > 0 && (
                <div className="space-y-1.5">
                  {diagnoses.map((dx) => (
                    <div
                      key={dx.icdCode}
                      className="p-2.5 rounded-lg bg-teal-50/70 border border-teal-200 flex items-center justify-between text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-teal-800">{dx.icdCode}</span>
                        <span className="text-slate-800">{dx.description}</span>
                        <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-teal-200 text-teal-900">
                          {dx.type}
                        </span>
                      </div>
                      <button
                        onClick={() => removeDiagnosis(dx.icdCode)}
                        className="text-slate-400 hover:text-red-600"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* P - Plan & Clinical Notes */}
            <div className="space-y-3 pt-3 border-t border-slate-100">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-800 font-bold text-xs flex items-center justify-center">
                  P
                </span>
                <h3 className="text-xs font-bold text-slate-800 uppercase">
                  Care Plan & Patient Counseling
                </h3>
              </div>

              <div>
                <textarea
                  rows={3}
                  value={soap.assessmentPlan}
                  onChange={(e) => setSoap({ ...soap, assessmentPlan: e.target.value })}
                  placeholder="Document therapeutic plan, patient lifestyle recommendations, diet, follow-up..."
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Right 1 Col: Orders Panel (e-Rx, Lab Orders, Finalize) */}
        <div className="space-y-6">
          {/* E-Prescription Pad */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                <Pill className="w-4 h-4 text-emerald-600" />
                Electronic Prescription (e-Rx)
              </h3>
              <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                Formulary Integrated
              </span>
            </div>

            {/* Prescribed Items Table */}
            {prescriptionItems.length > 0 && (
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {prescriptionItems.map((item, idx) => (
                  <div
                    key={idx}
                    className="p-2.5 rounded-lg border border-slate-200 bg-slate-50 text-xs flex items-center justify-between"
                  >
                    <div>
                      <p className="font-bold text-teal-800">{item.medicationName}</p>
                      <p className="text-[11px] text-slate-500">
                        {item.dosage} • {item.frequency} • {item.duration}
                      </p>
                    </div>
                    <button
                      onClick={() => removePrescriptionItem(idx)}
                      className="text-slate-400 hover:text-red-600"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Add Medication Mini-Form */}
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5 text-xs">
              <div>
                <label className="font-semibold text-slate-700 mb-1 block">Drug / Formulary</label>
                <select
                  value={newRx.medicationName}
                  onChange={(e) => handleMedSelect(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs"
                >
                  {FORMULARY_MEDICATIONS.map((m) => (
                    <option key={m.brandName} value={m.brandName}>
                      {m.brandName} ({m.genericName} - {m.strength})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-semibold text-slate-700 mb-1 block">Dosage</label>
                  <input
                    type="text"
                    value={newRx.dosage}
                    onChange={(e) => setNewRx({ ...newRx, dosage: e.target.value })}
                    className="w-full px-2.5 py-1 bg-white border border-slate-200 rounded-lg"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 mb-1 block">Duration</label>
                  <input
                    type="text"
                    value={newRx.duration}
                    onChange={(e) => setNewRx({ ...newRx, duration: e.target.value })}
                    className="w-full px-2.5 py-1 bg-white border border-slate-200 rounded-lg"
                  />
                </div>
              </div>

              <div>
                <label className="font-semibold text-slate-700 mb-1 block">Frequency / Schedule</label>
                <input
                  type="text"
                  value={newRx.frequency}
                  onChange={(e) => setNewRx({ ...newRx, frequency: e.target.value })}
                  className="w-full px-2.5 py-1 bg-white border border-slate-200 rounded-lg"
                />
              </div>

              <button
                type="button"
                onClick={addPrescriptionItem}
                className="w-full py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-xs transition flex items-center justify-center gap-1.5 shadow-sm"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Medication
              </button>
            </div>
          </div>

          {/* Diagnostic Lab Order Pad */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                <FlaskConical className="w-4 h-4 text-indigo-600" />
                Diagnostic Lab Orders
              </h3>
              <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded">
                LIS
              </span>
            </div>

            {/* Ordered tests badges */}
            {orderedLabs.length > 0 && (
              <div className="space-y-1.5">
                {orderedLabs.map((lab) => (
                  <div
                    key={lab.testName}
                    className="p-2 rounded-lg bg-indigo-50/70 border border-indigo-200 flex items-center justify-between text-xs"
                  >
                    <div>
                      <p className="font-bold text-indigo-900">{lab.testName}</p>
                      <p className="text-[10px] text-slate-500">{lab.category}</p>
                    </div>
                    <button
                      onClick={() => removeLabTest(lab.testName)}
                      className="text-slate-400 hover:text-red-600"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="space-y-2">
              <select
                value={selectedLabTest}
                onChange={(e) => setSelectedLabTest(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs"
              >
                <option value="">-- Choose Diagnostic Test / Panel --</option>
                {STANDARD_LAB_TESTS.map((t) => (
                  <option key={t.testCode} value={t.testCode}>
                    {t.testName} (${t.price.toFixed(2)})
                  </option>
                ))}
              </select>

              <button
                type="button"
                onClick={addLabTest}
                className="w-full py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold text-xs transition flex items-center justify-center gap-1.5 shadow-sm"
              >
                <Plus className="w-3.5 h-3.5" />
                Order Selected Lab Test
              </button>
            </div>
          </div>

          {/* Finalize Consultation CTA Card */}
          <div className="bg-gradient-to-br from-teal-800 to-slate-900 rounded-2xl p-5 text-white shadow-lg space-y-3">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-teal-400" />
              <h3 className="font-bold text-sm">Finalize & Sign Encounter</h3>
            </div>
            <p className="text-[11px] text-teal-100/80 leading-relaxed">
              Completes consultation note, transmits e-prescriptions to Pharmacy, generates lab work orders, and prepares the patient invoice.
            </p>

            <button
              onClick={handleFinalizeConsultation}
              disabled={finalizing || !patient}
              className="w-full py-2.5 bg-teal-400 hover:bg-teal-300 text-slate-950 font-bold text-xs rounded-xl transition shadow-md disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {finalizing ? (
                "Finalizing Clinical Note..."
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  Sign & Finalize Encounter
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ClinicalWorkspacePage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-xs text-slate-400">Loading Doctor Workspace...</div>}>
      <ClinicalWorkspaceContent />
    </Suspense>
  );
}
