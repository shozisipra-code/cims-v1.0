"use client";

import React, { useState, useEffect, use } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Heart,
  Activity,
  Stethoscope,
  Pill,
  CreditCard,
  FileText,
  Printer,
} from "lucide-react";
import {
  calculateAge,
  formatDate,
  formatDateTime,
  formatCurrency,
  getBloodPressureStatus,
} from "@/lib/utils";
import { useRole } from "@/components/layout/RoleContext";
import { canAccess } from "@/lib/permissions";
import { downloadPatient360Pdf } from "@/lib/pdf";

export default function PatientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);
  const { id } = resolvedParams;
  const { currentUser, ready } = useRole();

  const [patient, setPatient] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<
    "vitals" | "encounters" | "prescriptions" | "billing"
  >("vitals");

  const fetchPatient = () => {
    setLoading(true);
    fetch(`/api/patients/${id}`, { headers: { "x-cims-user-id": currentUser.id } })
      .then((res) => res.json())
      .then((data) => {
        if (data.success) setPatient(data.patient);
      })
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (!ready) return;
    fetchPatient();
  }, [id, currentUser.id, ready]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-slate-400 text-xs">
        Loading patient 360 profile...
      </div>
    );
  }

  if (!patient) {
    return (
      <div className="module-card p-8 text-center bg-white rounded-xl border border-slate-200">
        <p className="text-slate-600 font-bold mb-2">Patient not found</p>
        <Link href="/patients" className="text-xs text-teal-600 hover:underline">
          Return to Patient Directory
        </Link>
      </div>
    );
  }

  let chronicConditions: string[] = [];
  try {
    if (patient.chronicConditions) chronicConditions = JSON.parse(patient.chronicConditions);
  } catch {
    chronicConditions = patient.chronicConditions ? [patient.chronicConditions] : [];
  }
  const activeEncounter = patient.encounters?.find((encounter: any) => encounter.status === "IN_PROGRESS" && encounter.appointmentId);

  return (
    <div className="space-y-6">
      {/* Top Breadcrumb */}
      <div className="flex items-center gap-2 text-xs text-slate-500">
        <Link href="/patients" className="hover:text-teal-600 flex items-center gap-1 font-medium">
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to Patient Directory
        </Link>
        <span>/</span>
        <span className="text-slate-800 font-semibold">{patient.mrn}</span>
      </div>

      {/* Patient 360 Header Card */}
      <div className="module-card bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-teal-600 to-teal-800 text-white font-bold text-xl flex items-center justify-center shadow-md shadow-teal-700/20 flex-shrink-0">
              {patient.firstName[0]}
              {patient.lastName[0]}
            </div>

            <div>
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="text-xl md:text-2xl font-bold text-slate-900">
                  {patient.firstName} {patient.lastName}
                </h1>
                <span className="font-mono text-xs px-2.5 py-0.5 rounded-full bg-teal-50 border border-teal-200 text-teal-800 font-bold">
                  {patient.mrn}
                </span>
                {patient.bloodGroup && (
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-red-50 border border-red-200 text-red-700 font-bold">
                    Blood {patient.bloodGroup}
                  </span>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 mt-2">
                <span>
                  <strong className="text-slate-700">Age:</strong> {calculateAge(patient.dateOfBirth)} yrs ({formatDate(patient.dateOfBirth)})
                </span>
                <span>•</span>
                <span>
                  <strong className="text-slate-700">Gender:</strong> {patient.gender}
                </span>
                <span>•</span>
                <span>
                  <strong className="text-slate-700">Phone:</strong> {patient.phone}
                </span>
                {patient.nationalId && (
                  <>
                    <span>•</span>
                    <span>
                      <strong className="text-slate-700">CNIC / B-form:</strong> {patient.nationalId}
                    </span>
                  </>
                )}
              </div>

              {/* Emergency Contact */}
              {patient.emergencyContactName && (
                <div className="text-[11px] text-slate-500 mt-1.5 flex items-center gap-1.5">
                  <span className="text-slate-400 font-medium">Emergency Contact:</span>
                  <span className="font-semibold text-slate-700">
                    {patient.emergencyContactName} ({patient.emergencyContactRelation || "Relative"})
                  </span>
                  <span>• {patient.emergencyContactPhone}</span>
                </div>
              )}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="flex items-center gap-2.5 flex-wrap">
            <button type="button" onClick={() => void downloadPatient360Pdf(patient)} className="btn btn-secondary no-print"><Printer className="w-4 h-4" />Print Patient 360 PDF</button>
            {activeEncounter && canAccess(currentUser.role, currentUser.permissions || [], "clinical") && <Link
              href={`/clinical?patientId=${patient.id}&appointmentId=${activeEncounter.appointmentId}`}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-teal-600 hover:bg-teal-700 text-white transition shadow-sm"
            >
              <Stethoscope className="w-4 h-4" />
              Resume Consultation
            </Link>}
          </div>
        </div>

        {/* Chronic Conditions */}
        <div className="mt-5 pt-4 border-t border-slate-100">
          {/* Chronic Conditions */}
          <div className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-50 border border-slate-200">
            <Activity className="w-4 h-4 text-slate-600 flex-shrink-0 mt-0.5" />
            <div>
              <span className="text-xs font-bold text-slate-900 block">Chronic Conditions:</span>
              <div className="flex flex-wrap gap-1.5 mt-1">
                {chronicConditions.length > 0 && chronicConditions[0] !== "None" ? (
                  chronicConditions.map((c, i) => (
                    <span
                      key={i}
                      className="px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-200 text-slate-800"
                    >
                      {c}
                    </span>
                  ))
                ) : (
                  <span className="text-xs text-slate-500">None documented</span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="module-card flex border-b border-slate-200 bg-white rounded-xl px-2 shadow-sm">
        <button
          onClick={() => setActiveTab("vitals")}
          className={`px-4 py-3 text-xs font-bold border-b-2 flex items-center gap-2 transition ${
            activeTab === "vitals"
              ? "border-teal-600 text-teal-700"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <Heart className="w-4 h-4" />
          Vitals History ({patient.vitals?.length || 0})
        </button>

        <button
          onClick={() => setActiveTab("encounters")}
          className={`px-4 py-3 text-xs font-bold border-b-2 flex items-center gap-2 transition ${
            activeTab === "encounters"
              ? "border-teal-600 text-teal-700"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <FileText className="w-4 h-4" />
          Clinical Visits ({patient.encounters?.length || 0})
        </button>

        <button
          onClick={() => setActiveTab("prescriptions")}
          className={`px-4 py-3 text-xs font-bold border-b-2 flex items-center gap-2 transition ${
            activeTab === "prescriptions"
              ? "border-teal-600 text-teal-700"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <Pill className="w-4 h-4" />
          Prescriptions ({patient.prescriptions?.length || 0})
        </button>

        <button
          onClick={() => setActiveTab("billing")}
          className={`px-4 py-3 text-xs font-bold border-b-2 flex items-center gap-2 transition ${
            activeTab === "billing"
              ? "border-teal-600 text-teal-700"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <CreditCard className="w-4 h-4" />
          Invoices & Payments ({patient.invoices?.length || 0})
        </button>
      </div>

      {/* Tab 1: Vitals */}
      {activeTab === "vitals" && (
        <div className="module-card bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-800">Vital Signs & Trend Log</h3>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50 text-slate-500 uppercase font-semibold text-[10px] border-b border-slate-200">
                <tr>
                  <th className="px-4 py-2.5">Date & Time</th>
                  <th className="px-4 py-2.5">Blood Pressure</th>
                  <th className="px-4 py-2.5">Heart Rate</th>
                  <th className="px-4 py-2.5">Temp</th>
                  <th className="px-4 py-2.5">SpO2</th>
                  <th className="px-4 py-2.5">Weight / Height / BMI</th>
                  <th className="px-4 py-2.5">Glucose</th>
                  <th className="px-4 py-2.5">Resp. rate / Pain</th><th className="px-4 py-2.5">Visit / Notes</th>
                  <th className="px-4 py-2.5">Recorded By</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {patient.vitals?.length ? (
                  patient.vitals.map((v: any) => {
                    const status = getBloodPressureStatus(v.systolicBP, v.diastolicBP);
                    return (
                      <tr key={v.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3 font-medium text-slate-800 whitespace-nowrap">
                          {formatDateTime(v.recordedAt)}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className="font-bold text-slate-900">
                            {v.systolicBP ?? "—"}/{v.diastolicBP ?? "—"} mmHg
                          </span>{" "}
                          <span className={`text-[10px] px-1.5 py-0.2 rounded font-semibold ${status.color}`}>
                            {status.status}
                          </span>
                        </td>
                        <td className="px-4 py-3">{v.heartRate ? `${v.heartRate} bpm` : "--"}</td>
                        <td className="px-4 py-3">{v.temperature ? `${v.temperature}°C` : "--"}</td>
                        <td className="px-4 py-3">{v.spO2 ? `${v.spO2}%` : "--"}</td>
                        <td className="px-4 py-3">
                          {v.weightKg ? `${v.weightKg} kg` : "--"} / {v.heightCm ? `${v.heightCm} cm` : "--"}{" "}
                          {v.bmi && (
                            <span className="text-[10px] text-teal-700 font-bold ml-1">
                              (BMI {v.bmi})
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3">{v.bloodGlucose ? `${v.bloodGlucose} mg/dL` : "--"}</td>
                        <td className="px-4 py-3">{v.respiratoryRate ?? "—"} /min · {v.painScore ?? "—"}/10</td><td className="px-4 py-3">{v.encounterId ? formatDate(patient.encounters?.find((enc: any) => enc.id === v.encounterId)?.encounterDate) : "Earlier record"}{v.notes && <p className="mt-1 whitespace-pre-wrap">{v.notes}</p>}</td>
                        <td className="px-4 py-3 text-slate-500">{v.recordedBy || "Not recorded"}</td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={10} className="text-center py-8 text-slate-400">
                      No vitals recorded yet.
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
        <div className="space-y-4">
          {patient.encounters?.length ? (
            patient.encounters.map((enc: any) => (
              <div key={enc.id} className="module-card bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-3">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div>
                    <span className="text-xs font-bold text-teal-800 bg-teal-50 px-2 py-0.5 rounded">
                      Encounter Date: {formatDateTime(enc.encounterDate)}
                    </span>
                    <p className="text-xs text-slate-600 mt-1">
                      Attending: <strong className="text-slate-800">{enc.doctor?.name}</strong> ({enc.doctor?.department})
                    </p>
                  </div>
                  <span
                    className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                      enc.status === "FINALIZED"
                        ? "bg-emerald-100 text-emerald-800"
                        : "bg-amber-100 text-amber-800"
                    }`}
                  >
                    {enc.status}
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                  <div>
                    <p className="font-bold text-slate-800">Chief Complaint:</p>
                    <p className="text-slate-600 bg-slate-50 p-2.5 rounded-lg mt-1">
                      {enc.chiefComplaint || "Not documented."}
                    </p>
                  </div>
                  <div>
                    <p className="font-bold text-slate-800">History of Present Illness (HPI):</p>
                    <p className="text-slate-600 bg-slate-50 p-2.5 rounded-lg mt-1">
                      {enc.hpi || "No documented HPI."}
                    </p>
                  </div>
                  <div>
                    <p className="font-bold text-slate-800">Physical Examination:</p>
                    <p className="text-slate-600 bg-slate-50 p-2.5 rounded-lg mt-1">
                      {enc.physicalExam || "Not documented."}
                    </p>
                  </div>
                  <div>
                    <p className="font-bold text-slate-800">Assessment & Plan:</p>
                    <p className="text-slate-600 bg-slate-50 p-2.5 rounded-lg mt-1">
                      {enc.assessmentPlan || "Not documented."}
                    </p>
                  </div>
                </div>

                {enc.clinicalNotes && <div className="text-xs"><p className="font-bold text-slate-800">Clinical Notes:</p><p className="text-slate-600 whitespace-pre-wrap mt-1">{enc.clinicalNotes}</p></div>}
                {enc.followUpDate && <p className="text-xs font-semibold">Follow-up: {formatDate(enc.followUpDate)}</p>}
                {enc.appointmentId && canAccess(currentUser.role, currentUser.permissions || [], "clinical") && <Link className="btn btn-secondary" href={`/clinical?patientId=${patient.id}&appointmentId=${enc.appointmentId}`}>{enc.status === "FINALIZED" ? "Edit Consultation" : "Resume Consultation"}</Link>}
                {/* Diagnoses */}
                {enc.diagnoses?.length > 0 && (
                  <div className="pt-2">
                    <p className="text-xs font-bold text-slate-800 mb-1">Diagnosis:</p>
                    <div className="flex flex-wrap gap-2">
                      {enc.diagnoses.map((d: any) => (
                        <span
                          key={d.id}
                          className="px-2.5 py-1 rounded-lg bg-teal-50 border border-teal-200 text-teal-900 text-xs font-medium"
                        >
                          {d.description} ({d.type})
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))
          ) : (
            <div className="module-card bg-white p-8 rounded-xl border border-slate-200 text-center text-slate-400 text-xs">
              No clinical encounters recorded.
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Prescriptions */}
      {activeTab === "prescriptions" && (
        <div className="module-card bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-4">
          <h3 className="text-sm font-bold text-slate-800">Active & Past Prescriptions</h3>
          <div className="space-y-3">
            {patient.prescriptions?.length ? (
              patient.prescriptions.map((rx: any) => (
                <div key={rx.id} className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-800">
                      Prescribed by {rx.doctor?.name} on {formatDate(rx.createdAt)}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        rx.status === "DISPENSED"
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-amber-100 text-amber-800"
                      }`}
                    >
                      {rx.status}
                    </span>
                  </div>

                  <div className="divide-y divide-slate-200 border-t border-slate-200 pt-2">
                    {rx.items?.map((item: any) => (
                      <div key={item.id} className="py-2 text-xs flex items-center justify-between">
                        <div>
                          <p className="font-bold text-teal-800">{item.medicationName}</p>
                          <p className="text-slate-500 text-[11px]">
                            {item.dosage} • {item.frequency} • {item.duration} ({item.route})
                          </p>
                          {item.instructions && (
                            <p className="text-slate-400 text-[10px] italic">Note: {item.instructions}</p>
                          )}
                        </div>
                        <span className="text-xs font-semibold text-slate-600">Qty: {item.quantity}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            ) : (
              <p className="text-center py-6 text-slate-400 text-xs">No prescriptions on record.</p>
            )}
          </div>
        </div>
      )}

      {/* Tab 4: Billing */}
      {activeTab === "billing" && (
        <div className="module-card bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-4">
          <h3 className="text-sm font-bold text-slate-800">Financial Invoices & Receipts</h3>
          <div className="space-y-3">
            {patient.invoices?.length ? (
              patient.invoices.map((inv: any) => (
                <div key={inv.id} className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-mono font-bold text-slate-800">{inv.invoiceNumber}</span>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        inv.status === "PAID"
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-red-100 text-red-800"
                      }`}
                    >
                      {inv.status}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-xs pt-1">
                    <span className="text-slate-500">Issued {formatDate(inv.createdAt)}</span>
                    <span className="font-bold text-slate-900 text-sm">{formatCurrency(inv.totalAmount)}</span>
                  </div>

                  <div className="border-t border-slate-200 pt-2 text-[11px] text-slate-500 flex justify-between">
                    <span>Paid: {formatCurrency(inv.paidAmount)}</span>
                    <span className="text-emerald-700 font-semibold">Received: {formatCurrency(inv.paidAmount)}</span>
                  </div>
                  {inv.payments?.length > 0 && <div className="border-t border-slate-200 pt-2 space-y-1.5">
                    <p className="text-[10px] uppercase tracking-wider font-bold text-slate-400">Payment history</p>
                    {inv.payments.map((payment: any) => <div key={payment.id} className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
                      <span className="text-slate-500">{formatDateTime(payment.receivedAt)} · {payment.method}{payment.reference ? ` · ${payment.reference}` : ""}</span>
                      <span className="font-bold text-emerald-700">{formatCurrency(payment.amount)}</span>
                    </div>)}
                  </div>}
                </div>
              ))
            ) : (
              <p className="text-center py-6 text-slate-400 text-xs">No invoices on record.</p>
            )}
          </div>
        </div>
      )}

    </div>
  );
}
