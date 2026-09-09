"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  CalendarDays,
  Clock,
  UserCheck,
  Plus,
  Search,
  Filter,
  Stethoscope,
  CheckCircle2,
  AlertCircle,
  X,
  ArrowRight,
  Heart,
} from "lucide-react";
import { formatDateTime, getBloodPressureStatus } from "@/lib/utils";
import { useRole } from "@/components/layout/RoleContext";

export default function AppointmentsPage() {
  const { currentUser } = useRole();
  const [appointments, setAppointments] = useState<any[]>([]);
  const [patients, setPatients] = useState<any[]>([]);
  const [doctors, setDoctors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter
  const [statusFilter, setStatusFilter] = useState<string>("ALL");

  // Booking Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [bookingForm, setBookingForm] = useState({
    patientId: "",
    doctorId: "",
    department: "Internal Medicine",
    reason: "General OPD Consultation",
    type: "OPD",
  });
  const [submitting, setSubmitting] = useState(false);

  const fetchAppointments = () => {
    setLoading(true);
    fetch("/api/appointments")
      .then((res) => res.json())
      .then((data) => {
        if (data.success) setAppointments(data.appointments);
      })
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchAppointments();

    // Fetch patients and doctors for the booking dropdown
    fetch("/api/patients")
      .then((r) => r.json())
      .then((d) => {
        if (d.success) setPatients(d.patients);
      });

    fetch("/api/admin/audit")
      .then((r) => r.json())
      .then((d) => {
        if (d.success) {
          const docs = d.users.filter((u: any) => u.role === "DOCTOR" || u.role === "ADMIN");
          setDoctors(docs);
          if (docs.length > 0 && !bookingForm.doctorId) {
            setBookingForm((prev) => ({ ...prev, doctorId: docs[0].id }));
          }
        }
      });
  }, []);

  const handleStatusUpdate = async (id: string, newStatus: string) => {
    try {
      const res = await fetch("/api/appointments", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status: newStatus }),
      });
      const data = await res.json();
      if (data.success) {
        fetchAppointments();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleBook = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bookingForm.patientId || !bookingForm.doctorId) {
      alert("Please select both a patient and a doctor.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/appointments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bookingForm),
      });
      const data = await res.json();
      if (data.success) {
        setIsModalOpen(false);
        fetchAppointments();
      } else {
        alert(data.error || "Failed to book appointment");
      }
    } catch (e) {
      console.error(e);
      alert("Error booking appointment.");
    } finally {
      setSubmitting(false);
    }
  };

  const filteredAppointments = appointments.filter((a) => {
    if (statusFilter === "ALL") return true;
    return a.status === statusFilter;
  });

  const waitingCount = appointments.filter((a) => a.status === "WAITING").length;
  const inConsultCount = appointments.filter((a) => a.status === "IN_CONSULTATION").length;
  const completedCount = appointments.filter((a) => a.status === "COMPLETED").length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight flex items-center gap-2.5">
            <CalendarDays className="w-6 h-6 text-amber-500" />
            OPD Queue & Appointments
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Real-time outpatient tokens, triage queue management, and consultation scheduling.
          </p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="inline-flex items-center gap-2 bg-amber-600 hover:bg-amber-700 text-white px-4 py-2.5 rounded-xl text-xs font-bold transition shadow-sm"
        >
          <Plus className="w-4 h-4" />
          Check-in / New Appointment
        </button>
      </div>

      {/* Queue Status Tabs / Metric Counters */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <button
          onClick={() => setStatusFilter("ALL")}
          className={`p-4 rounded-xl border text-left transition ${
            statusFilter === "ALL"
              ? "bg-slate-900 text-white border-slate-900 shadow-sm"
              : "bg-white text-slate-700 border-slate-200 hover:border-slate-300"
          }`}
        >
          <span className="text-[11px] font-semibold opacity-80 uppercase">All Tokens</span>
          <p className="text-2xl font-bold mt-1">{appointments.length}</p>
          <p className="text-[10px] opacity-70 mt-1">Today's total registrations</p>
        </button>

        <button
          onClick={() => setStatusFilter("WAITING")}
          className={`p-4 rounded-xl border text-left transition ${
            statusFilter === "WAITING"
              ? "bg-amber-500 text-white border-amber-500 shadow-sm"
              : "bg-white text-slate-700 border-slate-200 hover:border-amber-300"
          }`}
        >
          <span className="text-[11px] font-semibold opacity-80 uppercase">Waiting in Queue</span>
          <p className="text-2xl font-bold mt-1">{waitingCount}</p>
          <p className="text-[10px] opacity-70 mt-1">Seated in waiting lobby</p>
        </button>

        <button
          onClick={() => setStatusFilter("IN_CONSULTATION")}
          className={`p-4 rounded-xl border text-left transition ${
            statusFilter === "IN_CONSULTATION"
              ? "bg-teal-600 text-white border-teal-600 shadow-sm"
              : "bg-white text-slate-700 border-slate-200 hover:border-teal-300"
          }`}
        >
          <span className="text-[11px] font-semibold opacity-80 uppercase">In Consultation</span>
          <p className="text-2xl font-bold mt-1">{inConsultCount}</p>
          <p className="text-[10px] opacity-70 mt-1">Inside doctor's chamber</p>
        </button>

        <button
          onClick={() => setStatusFilter("COMPLETED")}
          className={`p-4 rounded-xl border text-left transition ${
            statusFilter === "COMPLETED"
              ? "bg-emerald-600 text-white border-emerald-600 shadow-sm"
              : "bg-white text-slate-700 border-slate-200 hover:border-emerald-300"
          }`}
        >
          <span className="text-[11px] font-semibold opacity-80 uppercase">Completed</span>
          <p className="text-2xl font-bold mt-1">{completedCount}</p>
          <p className="text-[10px] opacity-70 mt-1">Visits finalized today</p>
        </button>
      </div>

      {/* Queue Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/50">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700">
            Active Queue Display ({filteredAppointments.length} Entries)
          </h2>
          <span className="text-[11px] text-slate-400 font-medium">Auto-sorted by token sequence</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200 uppercase tracking-wider text-[10px]">
              <tr>
                <th className="px-5 py-3">Token #</th>
                <th className="px-4 py-3">Patient Info</th>
                <th className="px-4 py-3">Doctor & Dept</th>
                <th className="px-4 py-3">Triage Vitals</th>
                <th className="px-4 py-3">Reason / Chief Complaint</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-slate-400">
                    Loading queue records...
                  </td>
                </tr>
              ) : filteredAppointments.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-slate-400">
                    No appointments matching selected status.
                  </td>
                </tr>
              ) : (
                filteredAppointments.map((appt) => {
                  const patient = appt.patient;
                  const latestVitals = patient.vitals?.[0];
                  const bp = latestVitals
                    ? getBloodPressureStatus(latestVitals.systolicBP, latestVitals.diastolicBP)
                    : null;

                  return (
                    <tr key={appt.id} className="hover:bg-slate-50/80 transition">
                      {/* Token */}
                      <td className="px-5 py-3.5 whitespace-nowrap">
                        <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-900 border border-amber-300 flex items-center justify-center font-extrabold text-sm shadow-sm">
                          #{appt.tokenNumber}
                        </div>
                      </td>

                      {/* Patient */}
                      <td className="px-4 py-3.5">
                        <div>
                          <Link
                            href={`/patients/${patient.id}`}
                            className="font-bold text-slate-900 hover:text-teal-700 transition"
                          >
                            {patient.firstName} {patient.lastName}
                          </Link>
                          <p className="text-[11px] font-mono text-teal-700">{patient.mrn}</p>
                          <p className="text-[10px] text-slate-400">
                            {patient.gender} • {patient.phone}
                          </p>
                        </div>
                      </td>

                      {/* Doctor */}
                      <td className="px-4 py-3.5">
                        <p className="font-semibold text-slate-800">{appt.doctor.name}</p>
                        <p className="text-[11px] text-slate-500">{appt.department}</p>
                      </td>

                      {/* Triage Vitals */}
                      <td className="px-4 py-3.5">
                        {latestVitals ? (
                          <div>
                            <span className="font-bold text-slate-800">
                              {latestVitals.systolicBP}/{latestVitals.diastolicBP} mmHg
                            </span>
                            <p className="text-[10px] text-slate-400">
                              HR {latestVitals.heartRate || "--"} • {latestVitals.temperature || "--"}°F
                            </p>
                          </div>
                        ) : (
                          <span className="text-[11px] text-amber-700 font-medium bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                            Needs Triage
                          </span>
                        )}
                      </td>

                      {/* Reason */}
                      <td className="px-4 py-3.5 max-w-xs">
                        <p className="truncate text-slate-700 font-medium">
                          {appt.reason || "Outpatient Consultation"}
                        </p>
                        <span className="text-[10px] text-slate-400">{appt.type}</span>
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <span
                          className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${
                            appt.status === "WAITING"
                              ? "bg-amber-100 text-amber-800 border border-amber-200"
                              : appt.status === "IN_CONSULTATION"
                              ? "bg-teal-100 text-teal-800 border border-teal-200"
                              : appt.status === "COMPLETED"
                              ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                              : "bg-slate-100 text-slate-700"
                          }`}
                        >
                          {appt.status.replace("_", " ")}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="px-5 py-3.5 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-2">
                          {appt.status === "WAITING" && (
                            <Link
                              href={`/clinical?patientId=${patient.id}&appointmentId=${appt.id}`}
                              className="px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg font-bold text-[11px] transition shadow-sm flex items-center gap-1"
                            >
                              <Stethoscope className="w-3.5 h-3.5" />
                              Call In
                            </Link>
                          )}

                          {appt.status === "IN_CONSULTATION" && (
                            <button
                              onClick={() => handleStatusUpdate(appt.id, "COMPLETED")}
                              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-[11px] transition"
                            >
                              Mark Complete
                            </button>
                          )}

                          {appt.status !== "COMPLETED" && (
                            <button
                              onClick={() => handleStatusUpdate(appt.id, "CANCELLED")}
                              className="px-2 py-1.5 text-slate-400 hover:text-red-600 text-[11px] font-semibold"
                            >
                              Cancel
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Book Appointment Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3 mb-4">
              <div className="flex items-center gap-2">
                <CalendarDays className="w-5 h-5 text-amber-500" />
                <h2 className="text-base font-bold text-slate-800">Check-in & Issue Token</h2>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleBook} className="space-y-4 text-xs">
              <div>
                <label className="font-semibold text-slate-700 mb-1 block">Select Patient *</label>
                <select
                  required
                  value={bookingForm.patientId}
                  onChange={(e) => setBookingForm({ ...bookingForm, patientId: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-slate-50"
                >
                  <option value="">-- Choose Registered Patient --</option>
                  {patients.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.firstName} {p.lastName} ({p.mrn})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-semibold text-slate-700 mb-1 block">Assigned Doctor *</label>
                <select
                  required
                  value={bookingForm.doctorId}
                  onChange={(e) => setBookingForm({ ...bookingForm, doctorId: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-slate-50"
                >
                  {doctors.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name} - {d.department}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 mb-1 block">Department</label>
                  <input
                    type="text"
                    value={bookingForm.department}
                    onChange={(e) => setBookingForm({ ...bookingForm, department: e.target.value })}
                    className="w-full px-3 py-1.5 border border-slate-200 rounded-lg bg-slate-50"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 mb-1 block">Visit Type</label>
                  <select
                    value={bookingForm.type}
                    onChange={(e) => setBookingForm({ ...bookingForm, type: e.target.value })}
                    className="w-full px-3 py-1.5 border border-slate-200 rounded-lg bg-slate-50"
                  >
                    <option value="OPD">OPD Consultation</option>
                    <option value="FOLLOW_UP">Follow-up</option>
                    <option value="EMERGENCY">Emergency</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="font-semibold text-slate-700 mb-1 block">Reason for Visit</label>
                <input
                  type="text"
                  value={bookingForm.reason}
                  onChange={(e) => setBookingForm({ ...bookingForm, reason: e.target.value })}
                  placeholder="e.g. Cough and mild fever, BP check"
                  className="w-full px-3 py-1.5 border border-slate-200 rounded-lg bg-slate-50"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 font-semibold text-slate-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 font-bold bg-amber-600 hover:bg-amber-700 text-white rounded-xl transition disabled:opacity-50"
                >
                  {submitting ? "Allocating Token..." : "Confirm & Issue Token"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
