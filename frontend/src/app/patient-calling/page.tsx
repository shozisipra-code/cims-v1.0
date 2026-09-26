"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRole } from "@/components/layout/RoleContext";
import { canAccess } from "@/lib/permissions";

type QueuePatient = {
  id: string;
  firstName: string;
  lastName: string;
  mrn: string;
  phone: string;
};

type QueueAppointment = {
  id: string;
  tokenNumber: number;
  status: "WAITING" | "IN_CONSULTATION" | "COMPLETED" | "CANCELLED" | "NO_SHOW" | "SCHEDULED";
  department: string;
  reason?: string | null;
  type: string;
  scheduledAt: string;
  patient: QueuePatient;
};

export default function PatientCallingPage() {
  const { currentUser, ready } = useRole();
  const [appointments, setAppointments] = useState<QueueAppointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [calling, setCalling] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const canCall = canAccess(currentUser.role, currentUser.permissions || [], "patient_calling")
    && canAccess(currentUser.role, currentUser.permissions || [], "clinical");

  const loadQueue = useCallback(async (quiet = false) => {
    if (!ready) return;
    if (!quiet) setLoading(true);
    try {
      const response = await fetch("/api/appointments?view=today", {
        cache: "no-store",
        headers: { "x-cims-user-id": currentUser.id },
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || "Unable to load the patient queue.");
      setAppointments(result.appointments);
      setError("");
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load the patient queue.");
    } finally {
      if (!quiet) setLoading(false);
    }
  }, [currentUser.id, ready]);

  useEffect(() => {
    if (!ready) return;
    void loadQueue();
    const timer = window.setInterval(() => void loadQueue(true), 4000);
    return () => window.clearInterval(timer);
  }, [loadQueue, ready]);

  const waiting = useMemo(() => appointments
    .filter(appointment => appointment.status === "WAITING")
    .sort((a, b) => a.tokenNumber - b.tokenNumber), [appointments]);
  const current = useMemo(() => appointments
    .filter(appointment => appointment.status === "IN_CONSULTATION")
    .sort((a, b) => new Date(b.scheduledAt).getTime() - new Date(a.scheduledAt).getTime())[0], [appointments]);
  const completed = appointments.filter(appointment => appointment.status === "COMPLETED").length;

  async function callPatient(id?: string) {
    if (!canCall) {
      setError("Consultation permission is required to call a patient.");
      return;
    }
    setCalling(id || "next");
    setMessage("");
    setError("");
    try {
      const response = await fetch("/api/appointments", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-cims-user-id": currentUser.id },
        body: JSON.stringify({ action: id ? "CALL" : "CALL_NEXT", ...(id ? { id } : {}) }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || "Unable to call the patient.");
      const called = result.appointment as QueueAppointment;
      setMessage(`Token #${called.tokenNumber} — ${called.patient.firstName} ${called.patient.lastName} has been called.`);
      window.dispatchEvent(new Event("cims:notifications-refresh"));
      await loadQueue(true);
    } catch (callError) {
      setError(callError instanceof Error ? callError.message : "Unable to call the patient.");
    } finally {
      setCalling(null);
    }
  }

  return <div className="patient-calling-page space-y-5">
    <div className="page-heading"><div><h1>Patient Calling</h1><p>Call checked-in patients in token order and keep the clinic queue synchronized.</p></div></div>

    <section className="calling-stats">
      <div className="stat-card"><div className="stat-label">Waiting</div><div className="stat-value">{waiting.length}</div><div className="stat-sub">Checked in and ready</div></div>
      <div className="stat-card"><div className="stat-label">Now called</div><div className="stat-value">{current ? `#${current.tokenNumber}` : "—"}</div><div className="stat-sub">Current clinic token</div></div>
      <div className="stat-card"><div className="stat-label">Completed</div><div className="stat-value">{completed}</div><div className="stat-sub">Finished today</div></div>
    </section>

    {message && <div className="calling-message success" role="status">{message}</div>}
    {error && <div className="calling-message error" role="alert">{error}</div>}
    {!canCall && <div className="calling-message" role="status">This is a read-only queue view. A doctor with consultation permission must call the patient.</div>}

    <section className="card calling-current">
      <div className="card-header"><h2>Now calling</h2></div>
      {loading ? <div className="calling-empty">Loading current token…</div> : current ? <div className="calling-current-body">
        <div className="calling-token">#{current.tokenNumber}</div>
        <div className="calling-current-patient"><span>Patient</span><strong>{current.patient.firstName} {current.patient.lastName}</strong><small>{current.patient.mrn} · {current.department}</small></div>
        <div className="calling-current-actions">
          {canAccess(currentUser.role, currentUser.permissions || [], "clinical") && <Link className="btn btn-primary" href={`/clinical?patientId=${current.patient.id}&appointmentId=${current.id}`}>Open Consultation</Link>}
          <span className="text-xs text-slate-500">Finish the current consultation before calling the next patient.</span>
        </div>
      </div> : <div className="calling-empty">
        <strong>No patient is currently called.</strong>
        <span>{waiting.length ? "Call the next checked-in token when ready." : "There are no checked-in patients waiting."}</span>
        {canCall ? <button className="btn btn-primary" type="button" disabled={calling !== null || waiting.length === 0} onClick={() => void callPatient()}>{calling === "next" ? "Calling…" : "Call next"}</button> : <span className="text-xs text-slate-500">Waiting for the doctor to call the next patient.</span>}
      </div>}
    </section>

    <section className="card calling-queue">
      <div className="card-header"><h2>Waiting queue ({waiting.length})</h2></div>
      <div className="table-scroll">
        <table>
          <thead><tr><th>Token</th><th>Patient</th><th>Visit</th><th>Action</th></tr></thead>
          <tbody>
            {!loading && waiting.map(appointment => <tr key={appointment.id}>
              <td><span className="calling-queue-token">#{appointment.tokenNumber}</span></td>
              <td><strong>{appointment.patient.firstName} {appointment.patient.lastName}</strong><small>{appointment.patient.mrn}</small></td>
              <td><strong>{appointment.type.replaceAll("_", " ")}</strong><small>{appointment.reason || "Outpatient consultation"}</small></td>
              <td>{canCall ? <button className="btn btn-primary" type="button" disabled={calling !== null || !!current} onClick={() => void callPatient(appointment.id)}>{calling === appointment.id ? "Calling…" : "Call patient"}</button> : <span className="text-xs text-slate-400">Doctor action</span>}</td>
            </tr>)}
            {loading && <tr><td className="calling-table-empty" colSpan={4}>Loading waiting queue…</td></tr>}
            {!loading && waiting.length === 0 && <tr><td className="calling-table-empty" colSpan={4}>No patients are waiting.</td></tr>}
          </tbody>
        </table>
      </div>
    </section>
  </div>;
}
