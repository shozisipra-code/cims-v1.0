"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Activity, CheckCircle2, FileText, Heart, Plus, Printer, Stethoscope, Trash2 } from "lucide-react";
import { useRole } from "@/components/layout/RoleContext";
import { calculateAge, calculateBMI, formatDate, formatDateTime } from "@/lib/utils";
import { conditionText, ConsultationForm, emptyPrescription, formFromEncounter, vitalFields } from "@/lib/consultation";
import { downloadConsultationPdf } from "@/lib/pdf";

async function request(url: string, options?: RequestInit) {
  const response = await fetch(url, { cache: "no-store", ...options });
  const result = await response.json();
  if (!response.ok || !result.success) throw Object.assign(new Error(result.error || "Unable to load the consultation."), { status: response.status });
  return result;
}

function ConsultationLobby() {
  const { currentUser, ready } = useRole();
  const [current, setCurrent] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!ready) return;
    let active = true;
    const load = () => request("/api/appointments?status=IN_CONSULTATION", { headers: { "x-cims-user-id": currentUser.id } }).then(result => { if (active) { setCurrent(result.appointments[0] || null); setError(""); } }).catch(error => { if (active) setError(error.message); }).finally(() => { if (active) setLoading(false); });
    load();
    const timer = window.setInterval(load, 4000);
    return () => { active = false; window.clearInterval(timer); };
  }, [currentUser.id, ready]);
  return <div className="consultation-page space-y-5">
    <div className="page-heading"><div><h1>Consultation Workspace</h1><p>Record today's vitals, notes and treatment in one place.</p></div></div>
    {error && <p role="alert" className="calling-message error">{error}</p>}
    <section className="card"><div className="card-header"><h2>Patient in the doctor's room</h2></div><div className="consultation-section">
      {loading ? <p>Loading current patient…</p> : current ? <>
        <span className="consultation-token">Token #{current.tokenNumber}</span><h2>{current.patient.firstName} {current.patient.lastName}</h2><p>{current.patient.mrn} · {current.reason}</p>
        <Link className="btn btn-primary" href={`/clinical?patientId=${current.patient.id}&appointmentId=${current.id}`}>Open Consultation</Link>
      </> : <><h2>No patient is currently called</h2><p>Call a patient from the queue to begin. This screen updates when a patient is called.</p><Link className="btn btn-primary" href="/patient-calling">Open patient calling</Link></>}
    </div></section>
  </div>;
}

function VisitWorkspace({ patientId, appointmentId }: { patientId: string; appointmentId: string | null }) {
  const { currentUser, ready } = useRole();
  const [patient, setPatient] = useState<any>(null);
  const [encounter, setEncounter] = useState<any>(null);
  const [form, setForm] = useState<ConsultationForm | null>(null);
  const [saved, setSaved] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [error, setError] = useState("");
  const [conflict, setConflict] = useState(false);
  const [correctionMode, setCorrectionMode] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const formRef = useRef<ConsultationForm | null>(null);
  const encounterRef = useRef<any>(null);
  const savedRef = useRef("");
  const inFlight = useRef<Promise<boolean> | null>(null);
  const finishRequested = useRef(false);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);

  useEffect(() => {
    if (!ready) return;
    let active = true;
    const headers = { "Content-Type": "application/json", "x-cims-user-id": currentUser.id };
    Promise.all([
      request(`/api/patients/${patientId}`, { headers }),
      request("/api/encounters", { method: "POST", headers, body: JSON.stringify({ patientId, appointmentId }) }),
    ]).then(([profile, result]) => {
      if (!active) return;
      const values = formFromEncounter(result.encounter);
      formRef.current = values; encounterRef.current = result.encounter; savedRef.current = JSON.stringify(values);
      setPatient(profile.patient); setEncounter(result.encounter); setForm(values); setSaved(savedRef.current);
      if (result.encounter.revision > 0) setLastSavedAt(result.encounter.updatedAt);
    }).catch(error => { if (active) setError(error.message); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [patientId, appointmentId, currentUser.id, ready]);

  const save = useCallback(async (finalize = false): Promise<boolean> => {
    while (inFlight.current) {
      const previousSucceeded = await inFlight.current;
      if (!previousSucceeded || !mounted.current) return false;
    }
    if (!finalize && finishRequested.current) return false;
    const currentEncounter = encounterRef.current;
    const values = formRef.current;
    if (!values || !currentEncounter || conflict) return false;
    const snapshot = JSON.stringify(values);
    if (!finalize && snapshot === savedRef.current) return true;
    setSaving(true); setError("");
    const operation = (async () => {
      try {
        const result = await request("/api/encounters", {
          method: "PATCH", headers: { "Content-Type": "application/json", "x-cims-user-id": currentUser.id },
          body: JSON.stringify({ id: currentEncounter.id, revision: currentEncounter.revision, status: finalize || currentEncounter.status === "FINALIZED" ? "FINALIZED" : "IN_PROGRESS", ...values }),
        });
        encounterRef.current = result.encounter; savedRef.current = snapshot;
        if (mounted.current) { setEncounter(result.encounter); setSaved(snapshot); setLastSavedAt(result.encounter.updatedAt); }
        if (finalize) window.dispatchEvent(new Event("cims:notifications-refresh"));
        return true;
      } catch (error: any) {
        if (mounted.current) { setError(error.message || "Unable to save. Please retry."); if (error.status === 409) setConflict(true); }
        return false;
      } finally {
        inFlight.current = null;
        if (mounted.current) setSaving(false);
      }
    })();
    inFlight.current = operation;
    return operation;
  }, [currentUser.id, conflict]);

  const dirty = !!form && JSON.stringify(form) !== saved;
  useEffect(() => {
    if (!dirty || finishing || conflict || encounter?.status === "FINALIZED") return;
    const timer = window.setTimeout(() => { if (!finishRequested.current) void save(); }, 1000);
    return () => window.clearTimeout(timer);
  }, [form, dirty, finishing, conflict, encounter?.status, save]);

  // Keep navigation from discarding edits while the debounce or a request is pending.
  useEffect(() => {
    if (!dirty && !saving) return;
    const unload = (event: BeforeUnloadEvent) => { if (inFlight.current || JSON.stringify(formRef.current) !== savedRef.current) { event.preventDefault(); event.returnValue = ""; } };
    const navigate = (event: MouseEvent) => {
      const anchor = (event.target as Element)?.closest?.("a");
      if (!anchor || anchor.target === "_blank" || event.ctrlKey || event.metaKey || event.shiftKey || event.button !== 0 || anchor.href.startsWith(`${window.location.href}#`)) return;
      event.preventDefault(); event.stopPropagation();
      if (finishRequested.current) return;
      void save().then(ok => { if (ok && JSON.stringify(formRef.current) === savedRef.current) window.location.assign(anchor.href); });
    };
    window.addEventListener("beforeunload", unload);
    document.addEventListener("click", navigate, true);
    return () => { window.removeEventListener("beforeunload", unload); document.removeEventListener("click", navigate, true); };
  }, [dirty, saving, save]);

  function edit(update: (current: ConsultationForm) => ConsultationForm) {
    if (!formRef.current) return;
    const next = update(formRef.current); formRef.current = next; setForm(next);
  }
  async function finish(event: React.FormEvent) {
    event.preventDefault();
    if (finishRequested.current) return;
    finishRequested.current = true; setFinishing(true);
    const succeeded = await save(true);
    if (succeeded && encounterRef.current?.status === "FINALIZED") setCorrectionMode(false);
    finishRequested.current = false; setFinishing(false);
  }

  if (loading) return <p className="consultation-loading">Opening consultation…</p>;
  if (!patient || !encounter || !form) return <section className="card consultation-section"><h1>Unable to open consultation</h1><p role="alert">{error}</p><div className="consultation-links"><Link href="/patient-calling" className="btn btn-primary">Return to queue</Link><Link href={`/patients/${patientId}`} className="btn btn-secondary">Patient 360</Link></div></section>;
  const finalized = encounter.status === "FINALIZED";
  const bmi = calculateBMI(Number(form.vitals.weightKg), Number(form.vitals.heightCm));
  const history = patient.encounters?.filter((visit: any) => visit.id !== encounter.id) || [];
  const priorVitals = patient.vitals?.filter((vitals: any) => vitals.encounterId !== encounter.id) || [];

  return <div className="consultation-page space-y-5">
    <div className="page-heading"><div><h1><Stethoscope size={23} /> Consultation Workspace</h1><p>Today's visit · {formatDate(encounter.encounterDate)} · {encounter.doctor?.name}</p></div><div className="consultation-links"><button type="button" className="btn btn-secondary" onClick={() => void downloadConsultationPdf(patient, encounter, form)}><Printer size={15} />Download consultation PDF</button><Link className="btn btn-secondary" href={`/patients/${patient.id}`}>Patient 360</Link></div></div>
    <section className="card consultation-patient">
      <span className="consultation-token">Token #{encounter.appointment?.tokenNumber}</span>
      <div><h2>{patient.firstName} {patient.lastName}</h2><p>{patient.mrn} · {calculateAge(patient.dateOfBirth)} years · {patient.gender}</p></div>
      <div className="consultation-conditions"><span><Activity size={15} /> Chronic conditions</span><p>{conditionText(patient.chronicConditions)}</p></div>
    </section>

    {finalized && !correctionMode ? <section className="card consultation-section consultation-complete" role="status"><CheckCircle2 size={32} /><h2>Consultation completed</h2><p>Vitals, clinical notes, diagnosis and any prescription are saved in Patient 360. Corrections can be entered directly when needed.</p><div className="consultation-links"><button type="button" className="btn btn-secondary" onClick={() => setCorrectionMode(true)}>Edit consultation</button><Link href={`/patients/${patient.id}`} className="btn btn-secondary">View Patient 360</Link><Link href="/patient-calling" className="btn btn-primary">Return to queue / Call next</Link></div></section> :
    <form onSubmit={finish}>
      <div className="consultation-layout">
        <fieldset disabled={finishing || conflict} className="consultation-editor">
          <section className="card"><div className="card-header"><h2><Heart size={16} /> Today's vitals</h2><span>Recorded by the doctor</span></div><div className="consultation-section">
            <p className="consultation-hint">Enter measurements taken during this visit. Leave unmeasured values blank.</p>
            <div className="consultation-vitals-grid">{vitalFields.map(field => <label className="consultation-field" key={field.key}><span>{field.label} <small>{field.unit}</small></span><input aria-label={`${field.label} (${field.unit})`} type="number" min={field.min} max={field.max} step={field.step} value={form.vitals[field.key]} placeholder="—" onChange={event => edit(current => ({ ...current, vitals: { ...current.vitals, [field.key]: event.target.value } }))} /></label>)}
              <div className="consultation-bmi"><span>BMI</span><strong>{bmi?.bmi ?? "—"}</strong><small>Calculated from weight and height</small></div>
            </div>
            <label className="consultation-field"><span>Vitals notes</span><input value={form.vitals.notes} onChange={event => edit(current => ({ ...current, vitals: { ...current.vitals, notes: event.target.value } }))} placeholder="Any observations about the measurements" /></label>
          </div></section>

          <section className="card"><div className="card-header"><h2><FileText size={16} /> Clinical notes</h2></div><div className="consultation-section">
            <label className="consultation-field"><span>Chief complaint *</span><input required value={form.chiefComplaint} onChange={event => edit(current => ({ ...current, chiefComplaint: event.target.value }))} placeholder="Reason for today's visit" /></label>
            <label className="consultation-field"><span>History of present illness</span><textarea aria-label="History of present illness" rows={3} value={form.hpi} onChange={event => edit(current => ({ ...current, hpi: event.target.value }))} /></label>
            <label className="consultation-field"><span>Clinical notes</span><textarea aria-label="Clinical notes" rows={4} value={form.clinicalNotes} onChange={event => edit(current => ({ ...current, clinicalNotes: event.target.value }))} placeholder="Relevant history and observations" /></label>
            <label className="consultation-field"><span>Examination findings</span><textarea aria-label="Examination findings" rows={3} value={form.physicalExam} onChange={event => edit(current => ({ ...current, physicalExam: event.target.value }))} /></label>
            <label className="consultation-field"><span>Diagnosis</span><textarea aria-label="Diagnosis" rows={2} value={form.diagnosis} onChange={event => edit(current => ({ ...current, diagnosis: event.target.value }))} placeholder="Write the diagnosis in your own words" /></label>
            <label className="consultation-field"><span>Plan and advice</span><textarea aria-label="Plan and advice" rows={3} value={form.assessmentPlan} onChange={event => edit(current => ({ ...current, assessmentPlan: event.target.value }))} /></label>
          </div></section>

          <section className="card"><div className="card-header"><h2>Prescription</h2><span>Optional · issued when the visit is finished</span></div><div className="consultation-section">
            {form.prescriptionItems.length === 0 && <p className="consultation-hint">No medicines added.</p>}
            {form.prescriptionItems.map((item, index) => <div className="consultation-rx" key={index}>
              <div className="consultation-rx-title"><strong>Medicine {index + 1}</strong><button type="button" className="btn btn-secondary" aria-label={`Remove medicine ${index + 1}`} onClick={() => edit(current => ({ ...current, prescriptionItems: current.prescriptionItems.filter((_, i) => i !== index) }))}><Trash2 size={14} /> Remove</button></div>
              <div className="consultation-rx-grid">{([{ key: "medicationName", label: "Medicine name" }, { key: "dosage", label: "Dosage" }, { key: "frequency", label: "Frequency" }, { key: "duration", label: "Duration" }, { key: "quantity", label: "Quantity" }, { key: "instructions", label: "Instructions" }] as const).map(({ key, label }) => <label className="consultation-field" key={key}><span>{label}{key !== "instructions" ? " *" : ""}</span><input aria-label={`${label} ${index + 1}`} type={key === "quantity" ? "number" : "text"} min={key === "quantity" ? 1 : undefined} step={key === "quantity" ? 1 : undefined} required={key !== "instructions"} value={item[key]} onChange={event => edit(current => ({ ...current, prescriptionItems: current.prescriptionItems.map((row, i) => i === index ? { ...row, [key]: key === "quantity" ? Number(event.target.value) : event.target.value } : row) }))} /></label>)}</div>
            </div>)}
            <button type="button" className="btn btn-secondary" onClick={() => edit(current => ({ ...current, prescriptionItems: [...current.prescriptionItems, emptyPrescription()] }))}><Plus size={15} /> Add medicine</button>
          </div></section>

          <section className="card"><div className="card-header"><h2>Follow-up</h2></div><div className="consultation-section"><label className="consultation-field"><span>Follow-up date</span><input type="date" value={form.followUpDate} onChange={event => edit(current => ({ ...current, followUpDate: event.target.value }))} /></label></div></section>
        </fieldset>

        <aside className="consultation-history">
          <section className="card"><div className="card-header"><h2>Patient 360 history</h2></div><div className="consultation-section">
            <h3>Previous vitals</h3>
            {!priorVitals.length && <p className="consultation-hint">No previous measurements.</p>}
            {priorVitals.slice(0, 3).map((vitals: any) => <details key={vitals.id}><summary>{formatDateTime(vitals.recordedAt)}</summary><dl className="consultation-history-vitals">{vitalFields.map(field => vitals[field.key] != null && <div key={field.key}><dt>{field.label}</dt><dd>{vitals[field.key]} {field.unit}</dd></div>)}</dl>{vitals.notes && <p>{vitals.notes}</p>}</details>)}
            <h3>Previous visits ({history.length})</h3>
            {!history.length && <p className="consultation-hint">No previous visits.</p>}
            {history.map((visit: any) => <details key={visit.id}><summary>{formatDate(visit.encounterDate)} · {visit.status === "FINALIZED" ? "Completed" : "Draft"}</summary><p><strong>{visit.chiefComplaint || "No complaint recorded"}</strong></p>{visit.clinicalNotes && <p>{visit.clinicalNotes}</p>}{visit.hpi && <p>History: {visit.hpi}</p>}{visit.physicalExam && <p>Examination: {visit.physicalExam}</p>}{visit.diagnoses?.map((diagnosis: any) => <p key={diagnosis.id}>Diagnosis: {diagnosis.description}</p>)}{visit.assessmentPlan && <p>Plan: {visit.assessmentPlan}</p>}{visit.followUpDate && <p>Follow-up: {formatDate(visit.followUpDate)}</p>}{visit.prescriptions?.flatMap((prescription: any) => prescription.items.map((item: any) => <p key={item.id}>{item.medicationName} · {item.dosage} · {item.frequency} · {item.duration}</p>))}</details>)}
          </div></section>
        </aside>
      </div>
      <div className="consultation-savebar">
        <div aria-live="polite"><strong>{finishing ? "Finishing consultation…" : saving ? "Saving draft…" : dirty ? "Unsaved changes" : lastSavedAt ? "Draft saved" : "Ready for entries"}</strong><small>{lastSavedAt ? `Last saved ${formatDateTime(lastSavedAt)}` : "Changes save automatically as you type."}</small></div>
        <div className="consultation-links">{!finalized && <button type="button" className="btn btn-secondary" disabled={saving || finishing || conflict} onClick={() => void save()}>Save Draft</button>}{finalized && <button type="button" className="btn btn-secondary" disabled={saving || finishing} onClick={() => { setCorrectionMode(false); const values = formFromEncounter(encounterRef.current); formRef.current = values; setForm(values); }}>Cancel corrections</button>}<button type="submit" className="btn btn-primary" disabled={finishing || conflict}>{finalized ? "Save corrections" : "Finish Consultation"}</button></div>
        {error && <div className="consultation-save-error" role="alert">{error}{conflict && <p>Your entries remain visible. Copy any unsaved changes before <button type="button" onClick={() => window.location.reload()}>reloading this visit</button>.</p>}</div>}
      </div>
    </form>}
  </div>;
}

function WorkspaceRouter() {
  const params = useSearchParams();
  const patientId = params.get("patientId");
  const appointmentId = params.get("appointmentId");
  return patientId ? <VisitWorkspace key={`${patientId}:${appointmentId}`} patientId={patientId} appointmentId={appointmentId} /> : <ConsultationLobby />;
}

export default function ClinicalPage() {
  return <Suspense fallback={<p className="consultation-loading">Loading consultation…</p>}><WorkspaceRouter /></Suspense>;
}
