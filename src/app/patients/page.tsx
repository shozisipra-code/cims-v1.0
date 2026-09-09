"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  Users,
  Search,
  Plus,
  Filter,
  UserCheck,
  Calendar,
  AlertTriangle,
  Heart,
  ChevronRight,
  Phone,
  Mail,
  Shield,
  X,
} from "lucide-react";
import { calculateAge, formatDate } from "@/lib/utils";
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
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight flex items-center gap-2.5">
            <Users className="w-6 h-6 text-teal-600" />
            Patient Master Index (PMI)
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Universal health records directory, demographic registry, and clinical history repository.
          </p>
        </div>

        <button
          onClick={() => setIsRegisterModalOpen(true)}
          className="inline-flex items-center justify-center gap-2 bg-teal-600 hover:bg-teal-700 text-white px-4 py-2.5 rounded-xl text-xs font-bold transition shadow-sm"
        >
          <Plus className="w-4 h-4" />
          Register New Patient
        </button>
      </div>

      {/* Search & Filter Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col sm:flex-row items-center gap-3">
        <form onSubmit={handleSearch} className="relative flex-1 w-full">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search patient by MRN (e.g. CIMS-2026-0001), Name, Phone, or National ID..."
            className="w-full pl-9 pr-24 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:bg-white transition"
          />
          <button
            type="submit"
            className="absolute right-1.5 top-1/2 -translate-y-1/2 px-3 py-1 bg-teal-600 hover:bg-teal-700 text-white rounded text-[11px] font-semibold transition"
          >
            Search
          </button>
        </form>

        {search && (
          <button
            onClick={() => {
              setSearch("");
              fetchPatients("");
            }}
            className="text-xs text-slate-500 hover:text-slate-800 underline px-2"
          >
            Clear Search
          </button>
        )}
      </div>

      {/* Patients Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200 uppercase tracking-wider text-[10px]">
              <tr>
                <th className="px-5 py-3">Patient / MRN</th>
                <th className="px-4 py-3">Age & Gender</th>
                <th className="px-4 py-3">Blood Group</th>
                <th className="px-4 py-3">Contact & National ID</th>
                <th className="px-4 py-3">Allergies & Alerts</th>
                <th className="px-4 py-3">Latest Vitals</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-10 text-center text-slate-400">
                    Loading patient records...
                  </td>
                </tr>
              ) : patients.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-slate-400">
                    No matching patients found.
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
                    <tr
                      key={patient.id}
                      className="hover:bg-teal-50/30 transition-colors group"
                    >
                      {/* Name & MRN */}
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-teal-100 text-teal-800 font-bold flex items-center justify-center text-xs flex-shrink-0">
                            {patient.firstName[0]}
                            {patient.lastName[0]}
                          </div>
                          <div>
                            <Link
                              href={`/patients/${patient.id}`}
                              className="font-bold text-slate-900 hover:text-teal-700 transition"
                            >
                              {patient.firstName} {patient.lastName}
                            </Link>
                            <p className="text-[11px] font-mono text-teal-700 font-medium">
                              {patient.mrn}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Age & Gender */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <span className="font-medium text-slate-800">
                          {calculateAge(patient.dateOfBirth)} yrs
                        </span>
                        <span className="text-slate-400"> • {patient.gender}</span>
                      </td>

                      {/* Blood Group */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        {patient.bloodGroup ? (
                          <span className="px-2 py-0.5 rounded font-bold text-[11px] bg-red-50 text-red-700 border border-red-200">
                            {patient.bloodGroup}
                          </span>
                        ) : (
                          <span className="text-slate-400">N/A</span>
                        )}
                      </td>

                      {/* Contact */}
                      <td className="px-4 py-3.5">
                        <div className="space-y-0.5">
                          <p className="text-slate-700 flex items-center gap-1.5">
                            <Phone className="w-3 h-3 text-slate-400" />
                            {patient.phone}
                          </p>
                          {patient.nationalId && (
                            <p className="text-[10px] font-mono text-slate-400">
                              ID: {patient.nationalId}
                            </p>
                          )}
                        </div>
                      </td>

                      {/* Allergies */}
                      <td className="px-4 py-3.5">
                        {allergies.length > 0 && allergies[0] !== "None known" ? (
                          <div className="flex flex-wrap gap-1">
                            {allergies.map((a: string, i: number) => (
                              <span
                                key={i}
                                className="px-1.5 py-0.2 rounded text-[10px] font-semibold bg-amber-50 text-amber-800 border border-amber-200"
                              >
                                {a}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-[11px] text-slate-400">None recorded</span>
                        )}
                      </td>

                      {/* Latest Vitals */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        {latestVitals ? (
                          <div>
                            <span className="font-semibold text-slate-800">
                              {latestVitals.systolicBP}/{latestVitals.diastolicBP} mmHg
                            </span>
                            <p className="text-[10px] text-slate-400">
                              HR {latestVitals.heartRate || "--"} • {latestVitals.temperature || "--"}°F
                            </p>
                          </div>
                        ) : (
                          <span className="text-slate-400 text-[11px]">No vitals</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="px-5 py-3.5 text-right whitespace-nowrap">
                        <Link
                          href={`/patients/${patient.id}`}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 hover:border-teal-500 hover:bg-teal-50 text-slate-700 hover:text-teal-700 font-semibold text-[11px] transition"
                        >
                          View 360
                          <ChevronRight className="w-3.5 h-3.5" />
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

      {/* Register Patient Modal */}
      {isRegisterModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-200 flex items-center justify-between sticky top-0 bg-white z-10">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-teal-100 text-teal-700 flex items-center justify-center">
                  <Plus className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-800">Register New Patient</h2>
                  <p className="text-xs text-slate-500">Universal Medical Record Number (MRN) auto-generated</p>
                </div>
              </div>
              <button
                onClick={() => setIsRegisterModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleRegister} className="p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    First Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={form.firstName}
                    onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                    placeholder="e.g. John"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Last Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={form.lastName}
                    onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                    placeholder="e.g. Doe"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Gender *
                  </label>
                  <select
                    value={form.gender}
                    onChange={(e) => setForm({ ...form, gender: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                  >
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Date of Birth *
                  </label>
                  <input
                    type="date"
                    required
                    value={form.dateOfBirth}
                    onChange={(e) => setForm({ ...form, dateOfBirth: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Blood Group
                  </label>
                  <select
                    value={form.bloodGroup}
                    onChange={(e) => setForm({ ...form, bloodGroup: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
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

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Phone Number *
                  </label>
                  <input
                    type="tel"
                    required
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                    placeholder="+1 (555) 000-0000"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                    placeholder="patient@example.com"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    National ID / SSN
                  </label>
                  <input
                    type="text"
                    value={form.nationalId}
                    onChange={(e) => setForm({ ...form, nationalId: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                    placeholder="e.g. SSN-000-00-0000"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Residential Address
                </label>
                <input
                  type="text"
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                  placeholder="Street, City, State, ZIP"
                />
              </div>

              {/* Emergency Contact */}
              <div className="pt-2 border-t border-slate-100">
                <p className="text-xs font-bold text-slate-800 mb-2">Emergency Contact</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] text-slate-600 mb-1">Name</label>
                    <input
                      type="text"
                      value={form.emergencyContactName}
                      onChange={(e) => setForm({ ...form, emergencyContactName: e.target.value })}
                      className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg"
                      placeholder="Full Name"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-600 mb-1">Phone</label>
                    <input
                      type="tel"
                      value={form.emergencyContactPhone}
                      onChange={(e) => setForm({ ...form, emergencyContactPhone: e.target.value })}
                      className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg"
                      placeholder="Phone"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-600 mb-1">Relationship</label>
                    <input
                      type="text"
                      value={form.emergencyContactRelation}
                      onChange={(e) => setForm({ ...form, emergencyContactRelation: e.target.value })}
                      className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg"
                      placeholder="Spouse / Parent / Sibling"
                    />
                  </div>
                </div>
              </div>

              {/* Clinical Alerts */}
              <div className="pt-2 border-t border-slate-100">
                <p className="text-xs font-bold text-slate-800 mb-2">Clinical Alerts & Flags</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] text-slate-600 mb-1">
                      Known Allergies (comma-separated)
                    </label>
                    <input
                      type="text"
                      value={form.allergies}
                      onChange={(e) => setForm({ ...form, allergies: e.target.value })}
                      className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg"
                      placeholder="e.g. Penicillin, Peanuts, Latex"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-600 mb-1">
                      Chronic Conditions (comma-separated)
                    </label>
                    <input
                      type="text"
                      value={form.chronicConditions}
                      onChange={(e) => setForm({ ...form, chronicConditions: e.target.value })}
                      className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg"
                      placeholder="e.g. Hypertension, Type 2 Diabetes"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsRegisterModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 text-xs font-bold bg-teal-600 hover:bg-teal-700 text-white rounded-xl transition shadow-sm disabled:opacity-50"
                >
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
