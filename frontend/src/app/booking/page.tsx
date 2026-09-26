"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { CalendarClock, CheckCircle2, ChevronDown, ListOrdered, Printer, Search } from "lucide-react";
import { useRole } from "@/components/layout/RoleContext";
import { CimsSelect } from "@/components/ui/CimsSelect";
import { PAKISTAN, PAYMENT_METHODS, pakistanDateKey } from "@/lib/pakistan";
import { formatCurrency } from "@/lib/utils";
import { downloadPdfDocument } from "@/lib/pdf";

const emptyPatient = { title: "MR", name: "", fatherHusbandName: "", ageValue: "", ageUnit: "YEARS", gender: "Male", phone: "", nationalId: "", address: "" };
const titleLabels: Record<string, string> = { MR: "Mr", MRS: "Mrs", MISS: "Miss" };
const titleGender: Record<string, string> = { MR: "Male", MRS: "Female", MISS: "Female" };
const toNameCase = (value: string) => value.trim().replace(/\s+/g, " ").split(" ").map(part => part ? part.charAt(0).toUpperCase() + part.slice(1).toLowerCase() : "").join(" ");
const patientName = (patient: any) => [patient.title ? titleLabels[patient.title] : "", patient.firstName, patient.lastName].filter(Boolean).join(" ");
const digitsOnly = (value: string, maximum: number) => value.replace(/\D/g, "").slice(0, maximum);

type BookingTiming = { mode: "TODAY" | "FUTURE"; date: string; time: string };

function tomorrowInKarachi() {
  const [year, month, day] = pakistanDateKey().split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + 1)).toISOString().slice(0, 10);
}

function initialTiming(): BookingTiming {
  return { mode: "TODAY", date: tomorrowInKarachi(), time: "09:00" };
}

function karachiTime() {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: PAKISTAN.timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date());
}

function appointmentDateTime(timing: BookingTiming) {
  const date = timing.mode === "TODAY" ? pakistanDateKey() : timing.date;
  const time = timing.mode === "TODAY" ? karachiTime() : timing.time;
  return `${date}T${time}:00+05:00`;
}

function formatKarachiDateTime(value: string | Date) {
  return new Intl.DateTimeFormat(PAKISTAN.locale, {
    timeZone: PAKISTAN.timeZone,
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function bookingControls(current: HTMLElement) {
  const form = current.closest("form");
  if (!form) return [];
  return Array.from(form.querySelectorAll<HTMLElement>("input:not([disabled]), textarea:not([disabled]), .cims-select-trigger:not([disabled]), button[type='submit']:not([disabled])"))
    .filter(control => control.offsetParent !== null);
}

function advanceBookingField(current: HTMLElement) {
  const controls = bookingControls(current);
  const next = controls[controls.indexOf(current) + 1];
  next?.focus();
}

export default function PatientBookingPage() {
  const { currentUser, ready } = useRole();
  const [patients, setPatients] = useState<any[]>([]);
  const [loadingPatients, setLoadingPatients] = useState(true);
  const [mode, setMode] = useState<"existing" | "new">("existing");
  const [search, setSearch] = useState("");
  const [patientDropdownOpen, setPatientDropdownOpen] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [issued, setIssued] = useState<any>(null);
  const [booking, setBooking] = useState({ patientId: "", reason: "", type: "OPD" });
  const [timing, setTiming] = useState<BookingTiming>(initialTiming);
  const [payment, setPayment] = useState({ amount: "", description: "Booking / consultation fee", method: "Cash", reference: "", notes: "" });
  const [newPatient, setNewPatient] = useState(emptyPatient);
  const patientSearchRef = useRef<HTMLDivElement>(null);
  const advanceActiveField = () => {
    if (document.activeElement instanceof HTMLElement) advanceBookingField(document.activeElement);
  };

  function handleBookingEnter(event: React.KeyboardEvent<HTMLFormElement>) {
    if (event.key !== "Enter" || event.defaultPrevented || event.nativeEvent.isComposing) return;
    const target = event.target as HTMLElement;
    if (target.matches("textarea, .cims-select-trigger, button[type='submit']")) return;
    event.preventDefault();
    advanceBookingField(target);
  }

  useEffect(() => {
    if (!ready) return;
    fetch("/api/patients", { headers: { "x-cims-user-id": currentUser.id } })
      .then(response => response.json())
      .then(data => data.success && setPatients(data.patients))
      .catch(() => setError("Could not load patient records."))
      .finally(() => setLoadingPatients(false));
  }, [currentUser.id, ready]);

  useEffect(() => {
    const closePatientDropdown = (event: PointerEvent) => {
      if (!patientSearchRef.current?.contains(event.target as Node)) setPatientDropdownOpen(false);
    };
    document.addEventListener("pointerdown", closePatientDropdown);
    return () => document.removeEventListener("pointerdown", closePatientDropdown);
  }, []);

  const matches = useMemo(() => {
    const query = search.trim().toLowerCase();
    return patients
      .filter(patient => !query || [patient.title && titleLabels[patient.title], patient.firstName, patient.lastName, patient.fatherHusbandName, patient.mrn, patient.phone, patient.nationalId]
        .filter(Boolean)
        .some(value => String(value).toLowerCase().includes(query)))
      .slice(0, 8);
  }, [patients, search]);

  const selected = patients.find(patient => patient.id === booking.patientId);

  function reset() {
    setIssued(null);
    setMode("existing");
    setSearch("");
    setPatientDropdownOpen(false);
    setError("");
    setNewPatient(emptyPatient);
    setBooking({ patientId: "", reason: "", type: "OPD" });
    setTiming(initialTiming());
    setPayment({ amount: "", description: "Booking / consultation fee", method: "Cash", reference: "", notes: "" });
  }

  function choosePatient(patient: any) {
    setBooking(current => ({ ...current, patientId: patient.id }));
    setSearch(patientName(patient));
    setPatientDropdownOpen(false);
    setError("");
  }

  async function registerPatient() {
    const name = toNameCase(newPatient.name);
    const fatherHusbandName = toNameCase(newPatient.fatherHusbandName);
    const [firstName = "", ...remainingNames] = name.split(" ");
    const response = await fetch("/api/patients", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-cims-user-id": currentUser.id },
      body: JSON.stringify({ ...newPatient, name, fatherHusbandName, firstName, lastName: remainingNames.join(" "), registeredBy: currentUser.name }),
    });
    const data = await response.json();
    if (!response.ok || !data.success) throw new Error(data.error || "Could not register the patient.");
    setPatients(current => [data.patient, ...current]);
    return data.patient;
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    if (mode === "existing" && !booking.patientId) {
      setError("Choose a registered patient or use the new-patient form.");
      return;
    }
    if (timing.mode === "FUTURE" && (!timing.date || timing.date <= pakistanDateKey() || !timing.time)) {
      setError("Choose a future Karachi date and appointment time.");
      return;
    }

    setSubmitting(true);
    try {
      const patient = mode === "new" ? await registerPatient() : selected;
      if (!patient) throw new Error("Choose a patient before issuing a token.");
      const response = await fetch("/api/appointments", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-cims-user-id": currentUser.id },
        body: JSON.stringify({
          ...booking,
          patientId: patient.id,
          scheduledAt: appointmentDateTime(timing),
          reason: booking.reason || "General OPD consultation",
          payment: {
            ...payment,
            amount: payment.amount ? Number(payment.amount) : 0,
            receivedBy: currentUser.name,
          },
        }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || "Could not issue token.");
      setIssued({ ...data.appointment, receipt: data.receipt });
      window.dispatchEvent(new Event("cims:notifications-refresh"));
    } catch (submissionError: any) {
      setError(submissionError.message || "Booking failed.");
    } finally {
      setSubmitting(false);
    }
  }

  return <div className="booking-page space-y-5">
    <div className="booking-page-header flex justify-between gap-4">
      <div>
        <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Patient Booking</h1>
      </div>
      <Link href="/appointments" className="booking-queue-link inline-flex items-center justify-center gap-2 border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 px-4 py-2.5 rounded-xl text-xs font-bold transition shadow-sm"><ListOrdered className="w-4 h-4" />View appointments &amp; queue</Link>
    </div>

    <div className="booking-panel module-card w-full bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      {issued ? <Confirmation appointment={issued} another={reset} /> : <>
        <div className="booking-panel-header p-4 border-b border-slate-200 bg-slate-50/50">
          <h2 className="text-base font-bold text-slate-800">New patient booking</h2>
          <p className="text-xs text-slate-500 mt-0.5">Check in a walk-in today or reserve a future appointment.</p>
        </div>
        <form onSubmit={submit} onKeyDown={handleBookingEnter} className="booking-form p-4 space-y-4">
          <div className="booking-mode-switch grid grid-cols-2 gap-1 rounded-xl bg-teal-50 p-1 border border-teal-100">
            <ModeButton active={mode === "existing"} onClick={() => { setMode("existing"); setPatientDropdownOpen(false); setError(""); }}>Find registered patient</ModeButton>
            <ModeButton active={mode === "new"} onClick={() => { setMode("new"); setPatientDropdownOpen(false); setError(""); }}>Register new patient</ModeButton>
          </div>

          {mode === "existing" ? <div>
            <Label>Search patient *</Label>
            <div ref={patientSearchRef} className="booking-patient-picker relative">
              <div className="booking-patient-search relative"><Search className="booking-patient-search-icon w-4 h-4 text-slate-400 absolute" /><input value={search} onFocus={() => setPatientDropdownOpen(true)} onClick={() => setPatientDropdownOpen(true)} onKeyDown={event => {
                if (event.key === "Escape") setPatientDropdownOpen(false);
                if (event.key === "Enter") {
                  event.preventDefault();
                  const patient = selected || matches[0];
                  const input = event.currentTarget;
                  if (patient) { choosePatient(patient); window.requestAnimationFrame(() => advanceBookingField(input)); }
                }
              }} onChange={event => { setSearch(event.target.value); setPatientDropdownOpen(true); setBooking(current => ({ ...current, patientId: "" })); }} className="input" placeholder="Name, MRN, phone, or CNIC" role="combobox" aria-expanded={patientDropdownOpen} aria-controls="booking-patient-options" aria-autocomplete="list" /><ChevronDown className={`booking-patient-chevron w-4 h-4 text-slate-400 absolute pointer-events-none ${patientDropdownOpen ? "is-open" : ""}`} /></div>
              {patientDropdownOpen && <div id="booking-patient-options" role="listbox" className="booking-results absolute z-20 left-0 right-0 mt-2 max-h-48 overflow-y-auto border border-slate-200 rounded-lg divide-y divide-slate-100 bg-white shadow-lg">
                {loadingPatients ? <p className="px-3 py-4 text-slate-400">Loading patient records...</p> : matches.map(patient => <button type="button" role="option" aria-selected={booking.patientId === patient.id} key={patient.id} onClick={() => choosePatient(patient)} className={`w-full text-left px-3 py-2.5 hover:bg-teal-50 flex justify-between ${booking.patientId === patient.id ? "bg-teal-50" : ""}`}><span><strong className="text-slate-800">{patientName(patient)}</strong><span className="ml-2 font-mono text-[10px] text-teal-700">{patient.mrn}</span></span><span className="text-[11px] text-slate-500">{patient.phone}</span></button>)}
                {!loadingPatients && matches.length === 0 && <p className="px-3 py-4 text-slate-400">No patient found. Register a new patient to continue.</p>}
              </div>}
            </div>
            {selected && <p className="mt-2 text-teal-700 font-semibold">Selected: {patientName(selected)} · {selected.mrn}</p>}
          </div> : <PatientForm patient={newPatient} setPatient={setNewPatient} onEnterCommit={advanceActiveField} />}

          <section className="booking-section">
            <div className="booking-section-heading"><h3>Visit details</h3></div>
            <div className="booking-section-body">
              <div className="mb-4">
                <Label>Appointment timing</Label>
                <div className="grid grid-cols-2 gap-2 rounded-xl border border-teal-100 bg-teal-50 p-1" role="group" aria-label="Appointment timing">
                  <ModeButton active={timing.mode === "TODAY"} onClick={() => setTiming(current => ({ ...current, mode: "TODAY" }))}>Today / walk-in</ModeButton>
                  <ModeButton active={timing.mode === "FUTURE"} onClick={() => setTiming(current => ({ ...current, mode: "FUTURE" }))}>Future appointment</ModeButton>
                </div>
                <p className="mt-2 text-[11px] text-slate-500">{timing.mode === "TODAY" ? "The patient will enter today's waiting queue immediately." : "The patient will remain scheduled until reception checks them in on the appointment day."}</p>
              </div>
              {timing.mode === "FUTURE" && <div className="booking-details-grid grid gap-3">
                <Field label="Appointment date *"><input required aria-label="Appointment date" type="date" min={tomorrowInKarachi()} value={timing.date} onChange={event => setTiming(current => ({ ...current, date: event.target.value }))} className="input" /></Field>
                <Field label="Appointment time *"><input required aria-label="Appointment time" type="time" value={timing.time} onChange={event => setTiming(current => ({ ...current, time: event.target.value }))} className="input" /></Field>
              </div>}
              <div className="booking-details-grid grid gap-3">
                <Field label="Visit type"><CimsSelect value={booking.type} onChange={value => setBooking({ ...booking, type: value })} onEnterCommit={advanceActiveField} options={[{ value: "OPD", label: "OPD consultation" }, { value: "FOLLOW_UP", label: "Follow-up visit" }, { value: "EMERGENCY", label: "Emergency" }]} /></Field>
              </div>
              <Field label="Reason for visit"><input value={booking.reason} onChange={event => setBooking({ ...booking, reason: event.target.value })} className="input" placeholder="e.g. Fever, follow-up, BP check" /></Field>
            </div>
          </section>

          <section className="booking-payment">
            <div className="booking-payment-heading"><h3>Payment received at booking</h3></div>
            <div className="booking-payment-body">
              <div className="booking-details-grid grid gap-3">
                <Field label="Amount received (PKR)"><input type="number" min="0" step="0.01" value={payment.amount} onChange={event => setPayment({ ...payment, amount: event.target.value })} className="input" placeholder="0" /></Field>
                <Field label="Payment method"><CimsSelect value={payment.method} onChange={method => setPayment({ ...payment, method })} onEnterCommit={advanceActiveField} options={PAYMENT_METHODS.map(value => ({ value, label: value }))} /></Field>
                <Field label="Charge description"><input value={payment.description} onChange={event => setPayment({ ...payment, description: event.target.value })} className="input" /></Field>
                <Field label="Reference (optional)"><input value={payment.reference} onChange={event => setPayment({ ...payment, reference: event.target.value })} className="input" placeholder="Bank, card, Raast or wallet reference" /></Field>
              </div>
              <Field label="Payment note (optional)"><input value={payment.notes} onChange={event => setPayment({ ...payment, notes: event.target.value })} className="input" placeholder="Custom note for this receipt" /></Field>
            </div>
          </section>

          {error && <p role="alert" className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-red-700">{error}</p>}
          <div className="booking-submit-row flex justify-end border-t border-slate-200 pt-4">
            <button type="submit" disabled={submitting} className="btn btn-primary px-5 py-2.5 rounded-xl font-bold disabled:opacity-50">{submitting ? "Saving booking..." : timing.mode === "FUTURE" ? (mode === "new" ? "Register & schedule" : "Schedule appointment") : (mode === "new" ? "Register & check in" : "Check in patient")}</button>
          </div>
        </form>
      </>}
    </div>
  </div>;
}

function Label({ children }: { children: React.ReactNode }) { return <label className="font-normal text-slate-700 mb-1.5 block">{children}</label>; }
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="block font-normal text-slate-700 mb-3">{label}{children}</label>; }
function ModeButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) { return <button type="button" onClick={onClick} className={`rounded-lg border px-3 py-2 font-bold transition ${active ? "bg-teal-600 text-white border-teal-600 shadow-sm" : "bg-white text-teal-700 border-teal-300 hover:bg-teal-50 hover:border-teal-500"}`}>{children}</button>; }

function PatientForm({ patient, setPatient, onEnterCommit }: any) {
  const update = (key: string, value: string) => setPatient((current: any) => ({ ...current, [key]: value }));
  const updateTitle = (title: string) => setPatient((current: any) => ({ ...current, title, gender: titleGender[title] || current.gender }));
  return <section className="booking-section">
    <div className="booking-section-heading"><h3>Patient information</h3></div>
    <div className="booking-section-body">
      <div className="booking-details-grid grid gap-3">
        <Field label="Patient name *"><div className="booking-name-field"><div className="booking-title-select"><CimsSelect value={patient.title} onChange={updateTitle} onEnterCommit={onEnterCommit} options={[{ value: "MR", label: "Mr" }, { value: "MRS", label: "Mrs" }, { value: "MISS", label: "Miss" }]} ariaLabel="Patient title" /></div><input required value={patient.name} onChange={event => update("name", event.target.value)} onBlur={() => update("name", toNameCase(patient.name))} className="input" placeholder="Full patient name" /></div></Field>
        <Field label="Father / Husband name *"><input required value={patient.fatherHusbandName} onChange={event => update("fatherHusbandName", event.target.value)} onBlur={() => update("fatherHusbandName", toNameCase(patient.fatherHusbandName))} className="input" placeholder="Father or husband name" /></Field>
        <Field label="Age *"><div className="booking-age-field"><input required type="number" min="0" step="1" value={patient.ageValue} onChange={event => update("ageValue", event.target.value)} className="input" placeholder="Age" /><CimsSelect value={patient.ageUnit} onChange={value => update("ageUnit", value)} onEnterCommit={onEnterCommit} options={[{ value: "YEARS", label: "Years" }, { value: "MONTHS", label: "Months" }, { value: "DAYS", label: "Days" }]} ariaLabel="Age unit" /></div></Field>
        <Field label="Gender *"><CimsSelect value={patient.gender} onChange={value => update("gender", value)} onEnterCommit={onEnterCommit} options={[{ value: "Male", label: "Male" }, { value: "Female", label: "Female" }, { value: "Other", label: "Other" }]} /></Field>
        <Field label="WhatsApp number *"><input required type="tel" inputMode="numeric" maxLength={11} value={patient.phone} onChange={event => update("phone", digitsOnly(event.target.value, 11))} className="input" placeholder="03001234567" aria-describedby="booking-phone-limit" /><small id="booking-phone-limit" className="booking-field-hint">Maximum 11 digits</small></Field>
        <Field label="CNIC / B-form"><input inputMode="numeric" maxLength={13} value={patient.nationalId} onChange={event => update("nationalId", digitsOnly(event.target.value, 13))} className="input" placeholder="3520212345671" aria-describedby="booking-cnic-limit" /><small id="booking-cnic-limit" className="booking-field-hint">13 digits</small></Field>
      </div>
      <Field label="Residential address"><input value={patient.address} onChange={event => update("address", event.target.value)} className="input" placeholder="Street, city, district" /></Field>
    </div>
  </section>;
}

function Confirmation({ appointment, another }: any) {
  const patient = appointment.patient;
  const scheduled = appointment.status === "SCHEDULED";
  const downloadBooking = () => downloadPdfDocument({
    filename: `${scheduled ? "appointment" : "clinic-token"}-${appointment.tokenNumber}-${patient.mrn}.pdf`, title: scheduled ? "Appointment Confirmation" : "Clinic Token",
    subtitle: `${patientName(patient)} | MRN ${patient.mrn}`,
    metrics: [{ label: "Token", value: `#${appointment.tokenNumber}` }, { label: "Status", value: appointment.status.replaceAll("_", " ") }, { label: "Department", value: appointment.department }, { label: "Visit type", value: appointment.type.replaceAll("_", " ") }],
    sections: [{ title: "Booking details", columns: ["Patient", "Scheduled", "Reason", "Payment", "Receipt"], rows: [[patientName(patient), formatKarachiDateTime(appointment.scheduledAt), appointment.reason || "Routine consultation", appointment.receipt ? `${formatCurrency(appointment.receipt.paidAmount)} / ${appointment.receipt.paymentMethod}` : "No payment recorded", appointment.receipt?.invoiceNumber || "-"]] }],
  });
  return <div className="booking-confirmation">
    <div className="booking-confirmation-icon"><CheckCircle2 /></div>
    <h2>{scheduled ? "Appointment scheduled" : "Patient checked in"}</h2>
    <p className="booking-confirmation-message">{scheduled ? `${patientName(patient)} is booked for ${formatKarachiDateTime(appointment.scheduledAt)}.` : `${patientName(patient)} is in today's waiting queue.`}</p>
    {appointment.receipt && <p className="booking-confirmation-receipt">{formatCurrency(appointment.receipt.paidAmount)} received <span>·</span> {appointment.receipt.paymentMethod} <span>·</span> {appointment.receipt.invoiceNumber}</p>}
    <div className="booking-token-card">
      <p className="booking-token-label">{scheduled ? <><CalendarClock size={16} /> Appointment token</> : "Clinic token"}</p>
      <p className="booking-token-number">#{appointment.tokenNumber}</p>
      <p className="booking-token-detail">{appointment.department} <span>·</span> {appointment.type.replaceAll("_", " ")}</p>
      {scheduled && <p className="mt-2 text-sm font-semibold text-teal-700">{formatKarachiDateTime(appointment.scheduledAt)} (Karachi)</p>}
    </div>
    <div className="booking-confirmation-actions">
      <button type="button" onClick={() => void downloadBooking()} className="btn booking-confirmation-secondary"><Printer size={16} />Download PDF</button>
      <Link href="/appointments" className="btn booking-confirmation-secondary">{scheduled ? "View appointments" : "View queue"}</Link>
      <button type="button" onClick={another} className="btn btn-primary">Book another patient</button>
    </div>
  </div>;
}
