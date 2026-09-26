"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CalendarCheck2, CalendarDays, CalendarPlus, Megaphone, Printer, Stethoscope } from "lucide-react";
import { useRole } from "@/components/layout/RoleContext";
import { canAccess } from "@/lib/permissions";
import { PAKISTAN } from "@/lib/pakistan";
import { downloadPdfDocument } from "@/lib/pdf";

type AppointmentStatus = "SCHEDULED" | "WAITING" | "IN_CONSULTATION" | "COMPLETED" | "CANCELLED" | "NO_SHOW";
type AppointmentView = "today" | "upcoming";

type Appointment = {
  id: string;
  tokenNumber: number;
  status: AppointmentStatus;
  department: string;
  reason?: string | null;
  type: string;
  scheduledAt: string;
  patient: { id: string; firstName: string; lastName: string; mrn: string; phone: string };
};

const metricStatuses: Array<{ status: "ALL" | AppointmentStatus; label: string; note: string }> = [
  { status: "ALL", label: "All", note: "Appointments in view" },
  { status: "SCHEDULED", label: "Scheduled", note: "Not checked in" },
  { status: "WAITING", label: "Waiting", note: "Ready for the doctor" },
  { status: "IN_CONSULTATION", label: "In consultation", note: "Visit in progress" },
  { status: "COMPLETED", label: "Completed", note: "Visits finished" },
];

function formatAppointmentTime(value: string, includeDate: boolean) {
  return new Intl.DateTimeFormat(PAKISTAN.locale, {
    timeZone: PAKISTAN.timeZone,
    ...(includeDate ? { weekday: "short", day: "numeric", month: "short", year: "numeric" } : {}),
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

export default function AppointmentsPage() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"ALL" | AppointmentStatus>("ALL");
  const [view, setView] = useState<AppointmentView>("today");
  const [updating, setUpdating] = useState<string | null>(null);
  const [error, setError] = useState("");
  const { currentUser, ready } = useRole();
  const canBook = canAccess(currentUser.role, currentUser.permissions || [], "booking");
  const clinical = canAccess(currentUser.role, currentUser.permissions || [], "clinical");

  useEffect(() => {
    const requestedView = new URLSearchParams(window.location.search).get("view");
    if (requestedView === "today" || requestedView === "upcoming") setView(requestedView);
  }, []);

  const fetchAppointments = useCallback(async (quiet = false) => {
    if (!ready) return;
    if (!quiet) setLoading(true);
    try {
      const response = await fetch(`/api/appointments?view=${view}`, {
        cache: "no-store",
        headers: { "x-cims-user-id": currentUser.id },
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || "Unable to load appointments.");
      setAppointments(data.appointments);
      setError("");
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load appointments.");
    } finally {
      if (!quiet) setLoading(false);
    }
  }, [currentUser.id, ready, view]);

  useEffect(() => {
    if (!ready) return;
    void fetchAppointments();
    const timer = window.setInterval(() => void fetchAppointments(true), 5000);
    return () => window.clearInterval(timer);
  }, [fetchAppointments, ready]);

  const rows = useMemo(() => appointments.filter(appointment => filter === "ALL" || appointment.status === filter), [appointments, filter]);
  const count = (status: "ALL" | AppointmentStatus) => status === "ALL" ? appointments.length : appointments.filter(appointment => appointment.status === status).length;
  const downloadAppointments = () => downloadPdfDocument({
    filename: `${view}-appointments-${new Date().toISOString().slice(0, 10)}.pdf`, title: view === "today" ? "Today's Appointments and Queue" : "Upcoming Appointments", orientation: "landscape",
    metrics: metricStatuses.slice(1).map(metric => ({ label: metric.label, value: count(metric.status) })),
    sections: [{ title: filter === "ALL" ? "All appointments in view" : `${filter.replaceAll("_", " ")} appointments`, columns: ["Token", "Patient", "MRN", "Phone", "Department", "Reason", "Date / time", "Visit type", "Status"], rows: rows.map(appointment => [`#${appointment.tokenNumber}`, `${appointment.patient.firstName} ${appointment.patient.lastName}`, appointment.patient.mrn, appointment.patient.phone, appointment.department, appointment.reason || "Outpatient consultation", formatAppointmentTime(appointment.scheduledAt, true), appointment.type.replaceAll("_", " "), appointment.status.replaceAll("_", " ")]) }],
  });

  function changeView(next: AppointmentView) {
    setView(next);
    setFilter("ALL");
    setError("");
    const url = new URL(window.location.href);
    url.searchParams.set("view", next);
    window.history.replaceState(null, "", url);
  }

  async function updateAppointment(id: string, change: { action: "CHECK_IN" } | { status: "CANCELLED" | "NO_SHOW" }) {
    setUpdating(id);
    setError("");
    try {
      const response = await fetch("/api/appointments", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-cims-user-id": currentUser.id },
        body: JSON.stringify({ id, ...change }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || "Unable to update this appointment.");
      window.dispatchEvent(new Event("cims:notifications-refresh"));
      await fetchAppointments(true);
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "Unable to update this appointment.");
    } finally {
      setUpdating(null);
    }
  }

  return <div className="space-y-6">
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div>
        <h1 className="text-2xl font-bold text-slate-800 tracking-tight flex items-center gap-2.5"><CalendarDays className="w-6 h-6 text-teal-600" />Appointments &amp; Queue</h1>
        <p className="text-xs text-slate-500 mt-1">Check patients in before they enter the live doctor queue.</p>
      </div>
      <div className="flex flex-wrap gap-2"><button type="button" className="btn" disabled={loading || !rows.length} onClick={() => void downloadAppointments()}><Printer className="w-4 h-4" />Download PDF</button>{canBook && <Link href="/booking" className="inline-flex items-center justify-center gap-2 bg-teal-600 hover:bg-teal-700 text-white px-4 py-2.5 rounded-xl text-xs font-bold transition shadow-sm"><CalendarPlus className="w-4 h-4" />New patient booking</Link>}</div>
    </div>

    <div className="inline-grid grid-cols-2 gap-1 rounded-xl border border-slate-200 bg-slate-100 p-1" role="tablist" aria-label="Appointment period">
      <button type="button" role="tab" aria-selected={view === "today"} onClick={() => changeView("today")} className={`rounded-lg px-5 py-2 text-xs font-bold transition ${view === "today" ? "bg-white text-teal-700 shadow-sm" : "text-slate-500 hover:text-slate-800"}`}>Today</button>
      <button type="button" role="tab" aria-selected={view === "upcoming"} onClick={() => changeView("upcoming")} className={`rounded-lg px-5 py-2 text-xs font-bold transition ${view === "upcoming" ? "bg-white text-teal-700 shadow-sm" : "text-slate-500 hover:text-slate-800"}`}>Upcoming</button>
    </div>

    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3">
      {metricStatuses.map(metric => <Metric key={metric.status} active={filter === metric.status} click={() => setFilter(metric.status)} label={metric.label} value={count(metric.status)} note={metric.note} />)}
    </div>

    {error && <p role="alert" className="calling-message error">{error}</p>}
    <div className="module-card bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="card-header appointments-queue-heading"><h2>{view === "today" ? "Today's appointments" : "Upcoming appointments"} ({rows.length})</h2></div>
      <div className="overflow-x-auto"><table className="w-full text-left text-xs text-slate-600">
        <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200 uppercase tracking-wider text-[10px]"><tr><th className="px-5 py-3">Token</th><th className="px-4 py-3">Patient</th><th className="px-4 py-3">Visit</th><th className="px-4 py-3">Date &amp; time</th><th className="px-4 py-3 text-center">Status</th><th className="px-5 py-3 text-right">Actions</th></tr></thead>
        <tbody className="divide-y divide-slate-200">{loading ? <Empty text="Loading appointment records..." /> : rows.length === 0 ? <Empty text={view === "today" ? "No appointments match today's view." : "No upcoming appointments match this view."} /> : rows.map(appointment => <QueueRow key={appointment.id} appointment={appointment} view={view} canBook={canBook} clinical={clinical} updating={updating === appointment.id} updateAppointment={updateAppointment} />)}</tbody>
      </table></div>
    </div>
  </div>;
}

function Metric({ active, click, label, value, note }: { active: boolean; click: () => void; label: string; value: number; note: string }) {
  return <button type="button" onClick={click} className={`queue-metric ${active ? "is-active" : ""}`}><span className="text-[11px] font-semibold opacity-80 uppercase">{label}</span><p className="text-2xl font-bold mt-1">{value}</p><p className="text-[10px] opacity-70 mt-1">{note}</p></button>;
}

function Empty({ text }: { text: string }) { return <tr><td colSpan={6} className="px-6 py-12 text-center text-slate-400">{text}</td></tr>; }

function QueueRow({ appointment, view, canBook, clinical, updating, updateAppointment }: {
  appointment: Appointment;
  view: AppointmentView;
  canBook: boolean;
  clinical: boolean;
  updating: boolean;
  updateAppointment: (id: string, change: { action: "CHECK_IN" } | { status: "CANCELLED" | "NO_SHOW" }) => Promise<void>;
}) {
  const patient = appointment.patient;
  const canManageBooking = canBook && ["WAITING", "SCHEDULED"].includes(appointment.status);
  return <tr className="hover:bg-slate-50/80">
    <td className="px-5 py-3.5"><div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-800 border border-teal-300 flex items-center justify-center font-extrabold text-sm">#{appointment.tokenNumber}</div></td>
    <td className="px-4 py-3.5"><Link href={`/patients/${patient.id}`} className="font-bold text-slate-900 hover:text-teal-700">{patient.firstName} {patient.lastName}</Link><p className="text-[11px] font-mono text-teal-700">{patient.mrn}</p><p className="text-[10px] text-slate-400">{patient.phone}</p></td>
    <td className="px-4 py-3.5"><p className="font-semibold text-slate-800">{appointment.department}</p><p className="text-[11px] text-slate-500 max-w-48 truncate">{appointment.reason || "Outpatient consultation"}</p><span className="text-[10px] text-slate-400">{appointment.type.replaceAll("_", " ")}</span></td>
    <td className="px-4 py-3.5"><time dateTime={appointment.scheduledAt} className="font-semibold text-slate-700">{formatAppointmentTime(appointment.scheduledAt, view === "upcoming")}</time><p className="text-[10px] text-slate-400">Karachi time</p></td>
    <td className="px-4 py-3.5 text-center"><Badge status={appointment.status} /></td>
    <td className="px-5 py-3.5 text-right"><div className="flex flex-wrap justify-end gap-2">
      {appointment.status === "IN_CONSULTATION" && clinical && <Link href={`/clinical?patientId=${patient.id}&appointmentId=${appointment.id}`} className="px-3 py-1.5 bg-teal-600 text-white rounded-lg font-bold text-[11px] inline-flex items-center gap-1"><Stethoscope className="w-3.5 h-3.5" />Open Consultation</Link>}
      {appointment.status === "WAITING" && clinical && <Link href="/patient-calling" className="px-3 py-1.5 bg-teal-600 text-white rounded-lg font-bold text-[11px] inline-flex items-center gap-1"><Megaphone className="w-3.5 h-3.5" />Patient Calling</Link>}
      {canBook && view === "today" && appointment.status === "SCHEDULED" && <button type="button" disabled={updating} onClick={() => void updateAppointment(appointment.id, { action: "CHECK_IN" })} className="px-3 py-1.5 bg-teal-600 text-white rounded-lg font-bold text-[11px] inline-flex items-center gap-1 disabled:opacity-50"><CalendarCheck2 className="w-3.5 h-3.5" />Check in</button>}
      {canManageBooking && view === "today" && <button type="button" disabled={updating} onClick={() => void updateAppointment(appointment.id, { status: "NO_SHOW" })} className="px-2 py-1.5 text-slate-500 hover:text-amber-700 text-[11px] font-semibold disabled:opacity-50">No-show</button>}
      {canManageBooking && <button type="button" disabled={updating} onClick={() => void updateAppointment(appointment.id, { status: "CANCELLED" })} className="px-2 py-1.5 text-slate-400 hover:text-red-600 text-[11px] font-semibold disabled:opacity-50">Cancel</button>}
    </div></td>
  </tr>;
}

function Badge({ status }: { status: AppointmentStatus }) {
  const styles: Record<AppointmentStatus, string> = {
    SCHEDULED: "bg-sky-50 text-sky-700 border-sky-200",
    WAITING: "bg-teal-50 text-teal-800 border-teal-200",
    IN_CONSULTATION: "bg-teal-100 text-teal-800 border-teal-200",
    COMPLETED: "bg-emerald-100 text-emerald-800 border-emerald-200",
    CANCELLED: "bg-red-50 text-red-700 border-red-200",
    NO_SHOW: "bg-amber-50 text-amber-800 border-amber-200",
  };
  return <span className={`px-2.5 py-1 rounded-full border text-[11px] font-bold ${styles[status]}`}>{status.replaceAll("_", " ")}</span>;
}
