"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { calculateAge } from "@/lib/utils";
import { useRole } from "@/components/layout/RoleContext";

export default function PatientsPage() {
  const { currentUser } = useRole();
  const [patients, setPatients] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);

  // Form State
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    gender: "Male",
    dateOfBirth: "1990-01-01",
    bloodGroup: "O+",
    phone: "",
    email: "",
    nationalId: "",
    address: "",
    emergencyContactName: "",
    emergencyContactPhone: "",
    emergencyContactRelation: "Spouse",
    allergies: "",
    chronicConditions: "",
  });

  const [saving, setSaving] = useState(false);

  const fetchPatients = (query = "") => {
    setLoading(true);
    fetch(`/api/patients?search=${encodeURIComponent(query)}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success) setPatients(data.patients);
      })
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchPatients();
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchPatients(search);
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        ...form,
        allergies: form.allergies ? form.allergies.split(",").map((s) => s.trim()) : [],
        chronicConditions: form.chronicConditions
          ? form.chronicConditions.split(",").map((s) => s.trim())
          : [],
        registeredBy: currentUser.name,
      };

      const res = await fetch("/api/patients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (data.success) {
        setIsRegisterModalOpen(false);
        setForm({
          firstName: "",
          lastName: "",
          gender: "Male",
          dateOfBirth: "1990-01-01",
          bloodGroup: "O+",
          phone: "",
          email: "",
          nationalId: "",
          address: "",
          emergencyContactName: "",
          emergencyContactPhone: "",
          emergencyContactRelation: "Spouse",
          allergies: "",
          chronicConditions: "",
        });
        fetchPatients();
      } else {
        alert(data.error || "Failed to register patient");
      }
    } catch (err) {
      console.error(err);
      alert("An error occurred while registering patient.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="patients-page">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Patient Master Index (PMI)</h1>
          <p className="page-subtitle">
            Universal health demographic registry, medical history, and clinical records.
          </p>
        </div>
        <div className="page-actions">
          <button
            type="button"
            onClick={() => setIsRegisterModalOpen(true)}
            className="btn btn-primary btn-sm"
          >
            + Register New Patient
          </button>
        </div>
      </div>

      {/* Search Bar Card */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-body" style={{ padding: "14px 18px" }}>
          <form onSubmit={handleSearch} style={{ display: "flex", gap: 10 }}>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by MRN (e.g. CIMS-2026-0001), Name, Phone, or National ID..."
              className="form-input"
              style={{ flex: 1 }}
            />
            <button type="submit" className="btn btn-primary">
              Search
            </button>
            {search && (
              <button
                type="button"
                onClick={() => {
                  setSearch("");
                  fetchPatients("");
                }}
                className="btn btn-ghost"
              >
                Clear
              </button>
            )}
          </form>
        </div>
      </div>

      {/* Patients Table Card */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">Registered Patients Directory ({patients.length})</span>
          <span style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
            Records auto-sorted by recent
          </span>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Patient / MRN</th>
                <th>Age & Gender</th>
                <th>Blood Group</th>
                <th>Contact & National ID</th>
                <th>Allergies & Alerts</th>
                <th>Latest Vitals</th>
                <th style={{ textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: "center", padding: "30px", color: "var(--text-muted)" }}>
                    Loading patient records...
                  </td>
                </tr>
              ) : patients.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: "center", padding: "30px", color: "var(--text-muted)" }}>
                    No matching patient records found.
                  </td>
                </tr>
              ) : (
                patients.map((patient) => {
                  let allergies: string[] = [];
                  try {
                    if (patient.allergies) allergies = JSON.parse(patient.allergies);
                  } catch {
                    allergies = patient.allergies ? [patient.allergies] : [];
                  }

                  const latestVitals = patient.vitals?.[0];

                  return (
                    <tr key={patient.id}>
                      {/* Name & MRN */}
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
                        <span
                          style={{
                            fontFamily: "var(--font-mono)",
                            fontSize: 11,
                            color: "var(--text-muted)",
                          }}
                        >
                          {patient.mrn}
                        </span>
                      </td>

                      {/* Age & Gender */}
                      <td>
                        <strong>{calculateAge(patient.dateOfBirth)} yrs</strong>
                        <span style={{ color: "var(--text-muted)", fontSize: 11 }}> • {patient.gender}</span>
                      </td>

                      {/* Blood Group */}
                      <td>
                        {patient.bloodGroup ? (
                          <span className="badge badge-red">{patient.bloodGroup}</span>
                        ) : (
                          <span style={{ color: "var(--text-muted)" }}>--</span>
                        )}
                      </td>

                      {/* Contact */}
                      <td>
                        <div>{patient.phone}</div>
                        {patient.nationalId && (
                          <span
                            style={{
                              fontFamily: "var(--font-mono)",
                              fontSize: 10.5,
                              color: "var(--text-muted)",
                            }}
                          >
                            ID: {patient.nationalId}
                          </span>
                        )}
                      </td>

                      {/* Allergies */}
                      <td>
                        {allergies.length > 0 && allergies[0] !== "None known" ? (
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                            {allergies.map((a: string, i: number) => (
                              <span key={i} className="badge badge-amber">
                                {a}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span style={{ fontSize: 11, color: "var(--text-muted)" }}>None known</span>
                        )}
                      </td>

                      {/* Vitals */}
                      <td>
                        {latestVitals ? (
                          <div>
                            <span style={{ fontWeight: 700, fontFamily: "var(--font-mono)" }}>
                              {latestVitals.systolicBP}/{latestVitals.diastolicBP}
                            </span>{" "}
                            <span style={{ fontSize: 10.5, color: "var(--text-muted)" }}>mmHg</span>
                          </div>
                        ) : (
                          <span style={{ fontSize: 11, color: "var(--text-muted)" }}>No readings</span>
                        )}
                      </td>

                      {/* Action */}
                      <td style={{ textAlign: "right" }}>
                        <Link
                          href={`/patients/${patient.id}`}
                          className="btn btn-secondary btn-sm"
                        >
                          View 360 &rarr;
                        </Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Register Patient Modal (LIMS card style) */}
      {isRegisterModalOpen && (
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
              maxWidth: 680,
              width: "100%",
              maxHeight: "90vh",
              overflowY: "auto",
              boxShadow: "var(--shadow-lg)",
            }}
          >
            <div className="card-header">
              <span className="card-title">Register New Patient</span>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => setIsRegisterModalOpen(false)}
                style={{ fontSize: 16, padding: "2px 8px" }}
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleRegister} className="card-body">
              <div className="form-grid form-grid-2" style={{ marginBottom: 14 }}>
                <div className="form-group">
                  <label className="form-label required">First Name</label>
                  <input
                    type="text"
                    required
                    className="form-input"
                    value={form.firstName}
                    onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                    placeholder="e.g. John"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label required">Last Name</label>
                  <input
                    type="text"
                    required
                    className="form-input"
                    value={form.lastName}
                    onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                    placeholder="e.g. Doe"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label required">Gender</label>
                  <select
                    className="form-select"
                    value={form.gender}
                    onChange={(e) => setForm({ ...form, gender: e.target.value })}
                  >
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label required">Date of Birth</label>
                  <input
                    type="date"
                    required
                    className="form-input"
                    value={form.dateOfBirth}
                    onChange={(e) => setForm({ ...form, dateOfBirth: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Blood Group</label>
                  <select
                    className="form-select"
                    value={form.bloodGroup}
                    onChange={(e) => setForm({ ...form, bloodGroup: e.target.value })}
                  >
                    <option value="A+">A+</option>
                    <option value="A-">A-</option>
                    <option value="B+">B+</option>
                    <option value="B-">B-</option>
                    <option value="AB+">AB+</option>
                    <option value="AB-">AB-</option>
                    <option value="O+">O+</option>
                    <option value="O-">O-</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label required">Phone Number</label>
                  <input
                    type="tel"
                    required
                    className="form-input"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    placeholder="+92 300 1234567"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Email Address</label>
                  <input
                    type="email"
                    className="form-input"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    placeholder="patient@example.com"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">National ID / CNIC</label>
                  <input
                    type="text"
                    className="form-input"
                    value={form.nationalId}
                    onChange={(e) => setForm({ ...form, nationalId: e.target.value })}
                    placeholder="e.g. 35201-1234567-1"
                  />
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: 14 }}>
                <label className="form-label">Residential Address</label>
                <input
                  type="text"
                  className="form-input"
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                  placeholder="Street, City, Postal Code"
                />
              </div>

              {/* Emergency Contact */}
              <div
                style={{
                  borderTop: "1px solid var(--border)",
                  paddingTop: 12,
                  marginBottom: 14,
                }}
              >
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    textTransform: "uppercase",
                    color: "var(--text-secondary)",
                    display: "block",
                    marginBottom: 10,
                  }}
                >
                  Emergency Contact
                </span>
                <div className="form-grid form-grid-3">
                  <div className="form-group">
                    <label className="form-label">Contact Name</label>
                    <input
                      type="text"
                      className="form-input"
                      value={form.emergencyContactName}
                      onChange={(e) => setForm({ ...form, emergencyContactName: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Contact Phone</label>
                    <input
                      type="tel"
                      className="form-input"
                      value={form.emergencyContactPhone}
                      onChange={(e) => setForm({ ...form, emergencyContactPhone: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Relation</label>
                    <input
                      type="text"
                      className="form-input"
                      value={form.emergencyContactRelation}
                      onChange={(e) => setForm({ ...form, emergencyContactRelation: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              {/* Clinical Alerts */}
              <div
                style={{
                  borderTop: "1px solid var(--border)",
                  paddingTop: 12,
                  marginBottom: 18,
                }}
              >
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    textTransform: "uppercase",
                    color: "var(--text-secondary)",
                    display: "block",
                    marginBottom: 10,
                  }}
                >
                  Clinical Allergies & Chronic Conditions
                </span>
                <div className="form-grid form-grid-2">
                  <div className="form-group">
                    <label className="form-label">Drug Allergies (comma-separated)</label>
                    <input
                      type="text"
                      className="form-input"
                      value={form.allergies}
                      onChange={(e) => setForm({ ...form, allergies: e.target.value })}
                      placeholder="e.g. Penicillin, Aspirin, Sulfa"
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Chronic Conditions (comma-separated)</label>
                    <input
                      type="text"
                      className="form-input"
                      value={form.chronicConditions}
                      onChange={(e) => setForm({ ...form, chronicConditions: e.target.value })}
                      placeholder="e.g. Hypertension, Diabetes Type 2"
                    />
                  </div>
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setIsRegisterModalOpen(false)}
                >
                  Cancel
                </button>
                <button type="submit" disabled={saving} className="btn btn-primary">
                  {saving ? "Registering..." : "Confirm & Save Patient"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
