"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
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
    <div className="appointments-page">
      {/* Page Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Patient Booking & OPD Queue</h1>
          <p className="page-subtitle">
            Outpatient tokens, triage queue management, and physician consultations.
          </p>
        </div>
        <div className="page-actions">
          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            className="btn btn-primary btn-sm"
          >
            + Issue Token / Booking
          </button>
        </div>
      </div>

      {/* 4 Stat Cards Row (LIMS grid-4 style) */}
      <div className="grid-4" style={{ marginBottom: 16 }}>
        <div
          className="stat-card blue"
          style={{ cursor: "pointer" }}
          onClick={() => setStatusFilter("ALL")}
        >
          <div className="stat-label">Total Bookings</div>
          <div className="stat-value">{appointments.length}</div>
          <div className="stat-sub">Registered today</div>
        </div>

        <div
          className="stat-card amber"
          style={{ cursor: "pointer" }}
          onClick={() => setStatusFilter("WAITING")}
        >
          <div className="stat-label">Waiting in Queue</div>
          <div className="stat-value">{waitingCount}</div>
          <div className="stat-sub">Awaiting triage / doctor</div>
        </div>

        <div
          className="stat-card teal"
          style={{ cursor: "pointer" }}
          onClick={() => setStatusFilter("IN_CONSULTATION")}
        >
          <div className="stat-label">In Consultation</div>
          <div className="stat-value">{inConsultCount}</div>
          <div className="stat-sub">Active visits in chamber</div>
        </div>

        <div
          className="stat-card green"
          style={{ cursor: "pointer" }}
          onClick={() => setStatusFilter("COMPLETED")}
        >
          <div className="stat-label">Completed Visits</div>
          <div className="stat-value">{completedCount}</div>
          <div className="stat-sub">Visits finalized today</div>
        </div>
      </div>

      {/* Queue Table Card */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">Live Queue Worklist ({filteredAppointments.length})</span>
          <div style={{ display: "flex", gap: 6 }}>
            <button
              type="button"
              onClick={() => setStatusFilter("ALL")}
              className={`btn ${statusFilter === "ALL" ? "btn-primary" : "btn-secondary"} btn-sm`}
            >
              All
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter("WAITING")}
              className={`btn ${statusFilter === "WAITING" ? "btn-primary" : "btn-secondary"} btn-sm`}
            >
              Waiting
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter("IN_CONSULTATION")}
              className={`btn ${statusFilter === "IN_CONSULTATION" ? "btn-primary" : "btn-secondary"} btn-sm`}
            >
              In Consult
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter("COMPLETED")}
              className={`btn ${statusFilter === "COMPLETED" ? "btn-primary" : "btn-secondary"} btn-sm`}
            >
              Completed
            </button>
          </div>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Token #</th>
                <th>Patient Details</th>
                <th>Assigned Doctor</th>
                <th>Triage Vitals</th>
                <th>Reason / Complaint</th>
                <th>Status</th>
                <th style={{ textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: "center", padding: "30px", color: "var(--text-muted)" }}>
                    Loading queue records...
                  </td>
                </tr>
              ) : filteredAppointments.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: "center", padding: "30px", color: "var(--text-muted)" }}>
                    No queue tokens for this filter.
                  </td>
                </tr>
              ) : (
                filteredAppointments.map((appt) => {
                  const patient = appt.patient;
                  const latestVitals = patient.vitals?.[0];

                  return (
                    <tr key={appt.id}>
                      {/* Token */}
                      <td>
                        <span
                          className="badge badge-blue"
                          style={{
                            fontFamily: "var(--font-mono)",
                            fontSize: 13,
                            fontWeight: 800,
                            padding: "4px 10px",
                          }}
                        >
                          #{appt.tokenNumber}
                        </span>
                      </td>

                      {/* Patient */}
                      <td>
                        <Link
                          href={`/patients/${patient.id}`}
                          style={{
                            fontWeight: 700,
                            color: "var(--primary)",
                            textDecoration: "none",
                            display: "block",
                          }}
                        >
                          {patient.firstName} {patient.lastName}
                        </Link>
                        <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-muted)" }}>
                          {patient.mrn} • {patient.phone}
                        </span>
                      </td>

                      {/* Doctor */}
                      <td>
                        <strong>{appt.doctor.name}</strong>
                        <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{appt.department}</div>
                      </td>

                      {/* Vitals */}
                      <td>
                        {latestVitals ? (
                          <div>
                            <span style={{ fontFamily: "var(--font-mono)", fontWeight: 700 }}>
                              {latestVitals.systolicBP}/{latestVitals.diastolicBP}
                            </span>{" "}
                            <span style={{ fontSize: 10.5, color: "var(--text-muted)" }}>mmHg</span>
                          </div>
                        ) : (
                          <span className="badge badge-amber">Needs Triage</span>
                        )}
                      </td>

                      {/* Reason */}
                      <td>
                        <div>{appt.reason || "Outpatient Consultation"}</div>
                        <span style={{ fontSize: 10.5, color: "var(--text-muted)" }}>{appt.type}</span>
                      </td>

                      {/* Status */}
                      <td>
                        <span
                          className={`badge ${
                            appt.status === "WAITING"
                              ? "badge-amber"
                              : appt.status === "IN_CONSULTATION"
                              ? "badge-blue"
                              : appt.status === "COMPLETED"
                              ? "badge-green"
                              : "badge-gray"
                          }`}
                        >
                          {appt.status.replace("_", " ")}
                        </span>
                      </td>

                      {/* Action */}
                      <td style={{ textAlign: "right" }}>
                        <div style={{ display: "flex", justifyContent: "flex-end", gap: 6 }}>
                          {appt.status === "WAITING" && (
                            <Link
                              href={`/clinical?patientId=${patient.id}&appointmentId=${appt.id}`}
                              className="btn btn-primary btn-sm"
                            >
                              Call In &rarr;
                            </Link>
                          )}

                          {appt.status === "IN_CONSULTATION" && (
                            <button
                              type="button"
                              onClick={() => handleStatusUpdate(appt.id, "COMPLETED")}
                              className="btn btn-success btn-sm"
                            >
                              Mark Done
                            </button>
                          )}

                          {appt.status !== "COMPLETED" && (
                            <button
                              type="button"
                              onClick={() => handleStatusUpdate(appt.id, "CANCELLED")}
                              className="btn btn-ghost btn-sm"
                              style={{ color: "var(--danger)" }}
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
              <span className="card-title">Issue OPD Token & Booking</span>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => setIsModalOpen(false)}
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleBook} className="card-body">
              <div className="form-group" style={{ marginBottom: 12 }}>
                <label className="form-label required">Select Patient</label>
                <select
                  required
                  className="form-select"
                  value={bookingForm.patientId}
                  onChange={(e) => setBookingForm({ ...bookingForm, patientId: e.target.value })}
                >
                  <option value="">-- Choose Registered Patient --</option>
                  {patients.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.firstName} {p.lastName} ({p.mrn})
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group" style={{ marginBottom: 12 }}>
                <label className="form-label required">Assigned Doctor</label>
                <select
                  required
                  className="form-select"
                  value={bookingForm.doctorId}
                  onChange={(e) => setBookingForm({ ...bookingForm, doctorId: e.target.value })}
                >
                  {doctors.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name} ({d.department})
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-grid form-grid-2" style={{ marginBottom: 12 }}>
                <div className="form-group">
                  <label className="form-label">Department</label>
                  <input
                    type="text"
                    className="form-input"
                    value={bookingForm.department}
                    onChange={(e) => setBookingForm({ ...bookingForm, department: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Visit Type</label>
                  <select
                    className="form-select"
                    value={bookingForm.type}
                    onChange={(e) => setBookingForm({ ...bookingForm, type: e.target.value })}
                  >
                    <option value="OPD">OPD Consultation</option>
                    <option value="FOLLOW_UP">Follow-up</option>
                    <option value="EMERGENCY">Emergency</option>
                  </select>
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: 16 }}>
                <label className="form-label">Presenting Complaint / Reason</label>
                <input
                  type="text"
                  className="form-input"
                  value={bookingForm.reason}
                  onChange={(e) => setBookingForm({ ...bookingForm, reason: e.target.value })}
                  placeholder="e.g. Cough and fever, regular hypertension checkup"
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setIsModalOpen(false)}
                >
                  Cancel
                </button>
                <button type="submit" disabled={submitting} className="btn btn-primary">
                  {submitting ? "Issuing..." : "Confirm & Issue Token"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
