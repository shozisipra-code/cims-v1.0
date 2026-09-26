"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  Users,
  Search,
  ChevronRight,
  Phone,
  FileDown,
  Printer,
  CalendarDays,
} from "lucide-react";
import { calculateAge, formatDate } from "@/lib/utils";
import { useRole } from "@/components/layout/RoleContext";
import { downloadPdfDocument } from "@/lib/pdf";

export default function PatientsPage() {
  const { currentUser, ready } = useRole();
  const [patients, setPatients] = useState<any[]>([]);
  const [filters, setFilters] = useState({ name: "", mrn: "", phone: "", nationalId: "", from: "", to: "" });
  const [loading, setLoading] = useState(true);

  const fetchPatients = (query = filters) => {
    setLoading(true);
    const params = new URLSearchParams(Object.entries(query).filter(([, value]) => value));
    fetch(`/api/patients?${params.toString()}`, { headers: { "x-cims-user-id": currentUser.id } })
      .then((res) => res.json())
      .then((data) => {
        if (data.success) setPatients(data.patients);
      })
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (!ready) return;
    const query = new URLSearchParams(window.location.search).get("search") || "";
    const initialFilters = { name: query, mrn: "", phone: "", nationalId: "", from: "", to: "" };
    setFilters(initialFilters);
    fetchPatients(initialFilters);
  }, [currentUser.id, ready]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchPatients(filters);
  };

  const updateFilter = (key: keyof typeof filters, value: string) => setFilters(current => ({ ...current, [key]: value }));
  const clearFilters = () => {
    const empty = { name: "", mrn: "", phone: "", nationalId: "", from: "", to: "" };
    setFilters(empty);
    fetchPatients(empty);
  };

  const exportPatients = () => {
    const escapeCsv = (value: unknown) => `"${String(value ?? "").replace(/"/g, '""')}"`;
    const rows = patients.map((patient, index) => [
      index + 1,
      patient.mrn,
      `${patient.firstName} ${patient.lastName}`,
      patient.phone,
      patient.nationalId || "",
      patient.gender,
      patient.bloodGroup || "",
      formatDate(patient.createdAt),
    ]);
    const csv = [["No.", "MRN", "Patient Name", "Phone", "CNIC / B-form", "Gender", "Blood Group", "Registered"], ...rows]
      .map(row => row.map(escapeCsv).join(","))
      .join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `patient-records-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const exportPatientsPdf = () => downloadPdfDocument({
    filename: `patient-records-${new Date().toISOString().slice(0, 10)}.pdf`,
    title: "Patient Records",
    subtitle: `${patients.length} matching patient records`,
    orientation: "landscape",
    sections: [{ title: "Patient directory", columns: ["No.", "MRN", "Patient", "Age / gender", "Phone", "CNIC / B-form", "Blood group", "Registered", "Visits", "Consultations"], rows: patients.map((patient, index) => [index + 1, patient.mrn, `${patient.firstName} ${patient.lastName}`, `${calculateAge(patient.dateOfBirth)} / ${patient.gender}`, patient.phone, patient.nationalId, patient.bloodGroup, formatDate(patient.createdAt), patient._count?.appointments || 0, patient._count?.encounters || 0]) }],
  });

  return (
    <div className="patients-page space-y-6">
      {/* Header Banner */}
      <div className="patients-page-header flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="patients-title-block">
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight flex items-center gap-2.5">
            <Users className="w-6 h-6 text-teal-600" />
            Patient Records
          </h1>
        </div>
        <div className="patients-page-actions">
          <button type="button" onClick={exportPatients} className="patients-export-button">
            <FileDown aria-hidden="true" /> Export CSV
          </button>
          <button type="button" onClick={() => void exportPatientsPdf()} className="patients-print-button">
            <Printer aria-hidden="true" /> Download PDF
          </button>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="records-search-panel patients-search-panel module-card">
        <form onSubmit={handleSearch} className="records-search-grid">
          <SearchField><input value={filters.mrn} onChange={event => updateFilter("mrn", event.target.value)} placeholder="Medical Record Number" className="input" /></SearchField>
          <SearchField><input value={filters.name} onChange={event => updateFilter("name", event.target.value)} placeholder="Patient Name" className="input" /></SearchField>
          <SearchField><input type="tel" inputMode="numeric" value={filters.phone} onChange={event => updateFilter("phone", event.target.value)} placeholder="Phone Number" className="input" /></SearchField>
          <SearchField><input value={filters.nationalId} onChange={event => updateFilter("nationalId", event.target.value)} placeholder="CNIC / B-form" className="input" /></SearchField>
          <label className="records-search-date"><span>Start Date</span><input type="date" value={filters.from} onChange={event => updateFilter("from", event.target.value)} className="input" /></label>
          <label className="records-search-date"><span>End Date</span><input type="date" value={filters.to} onChange={event => updateFilter("to", event.target.value)} className="input" /></label>
          <div className="records-search-actions"><button type="submit" className="records-search-primary">Search</button><button type="button" onClick={clearFilters} className="records-search-secondary">Clear</button></div>
        </form>
      </div>

      {/* Patients Table */}
      <div className="patients-results module-card bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="patients-results-heading">
          <h2>Search Results</h2>
          <span><Users aria-hidden="true" /> {patients.length} {patients.length === 1 ? "patient" : "patients"}</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200 uppercase tracking-wider text-[10px]">
              <tr>
                <th className="w-14 px-4 py-3 text-center">No.</th>
                <th className="px-5 py-3">Patient / MRN</th>
                <th className="px-4 py-3">Age & Gender</th>
                <th className="px-4 py-3">Contact & CNIC / B-form</th>
                <th className="px-4 py-3">Latest Vitals</th>
                <th className="px-4 py-3">Record Summary</th>
                <th className="px-5 py-3 text-center">Actions</th>
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
                patients.map((patient, index) => {
                  const latestVitals = patient.vitals?.[0];
                  const registrationDate = formatDate(patient.createdAt);
                  const previousDate = index > 0 ? formatDate(patients[index - 1].createdAt) : null;
                  const patientsOnDate = patients.filter(item => formatDate(item.createdAt) === registrationDate).length;

                  return (
                    <React.Fragment key={patient.id}>
                    {registrationDate !== previousDate && (
                      <tr className="patients-date-group">
                        <td colSpan={7}>
                          <span><CalendarDays aria-hidden="true" /> {registrationDate} · {patientsOnDate} {patientsOnDate === 1 ? "patient" : "patients"}</span>
                        </td>
                      </tr>
                    )}
                    <tr className="hover:bg-teal-50/30 transition-colors group">
                      {/* Row Number */}
                      <td className="w-14 px-4 py-3.5 text-center font-semibold text-slate-500 tabular-nums">
                        {index + 1}
                      </td>

                      {/* Name & MRN */}
                      <td className="px-5 py-3.5">
                        <div className="flex items-center">
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

                      {/* Latest Vitals */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        {latestVitals ? (
                          <div>
                            <span className="font-semibold text-slate-800">
                              {latestVitals.systolicBP}/{latestVitals.diastolicBP} mmHg
                            </span>
                            <p className="text-[10px] text-slate-400">
                              HR {latestVitals.heartRate || "--"} • {latestVitals.temperature || "--"}°C
                            </p>
                          </div>
                        ) : (
                          <span className="text-slate-400 text-[11px]">No vitals</span>
                        )}
                      </td>

                      {/* Record Summary */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <p className="font-semibold text-slate-800">{patient._count?.appointments || 0} visits · {patient._count?.encounters || 0} consultations</p>
                        <p className="text-[10px] text-slate-400">{patient._count?.labOrders || 0} labs · {patient._count?.prescriptions || 0} prescriptions</p>
                      </td>

                      {/* Actions */}
                      <td className="px-5 py-3.5 text-center whitespace-nowrap">
                        <Link
                          href={`/patients/${patient.id}`}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 hover:border-teal-500 hover:bg-teal-50 text-slate-700 hover:text-teal-700 font-semibold text-[11px] transition"
                        >
                          View 360
                          <ChevronRight className="w-3.5 h-3.5" />
                        </Link>
                      </td>
                    </tr>
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Registration is intentionally available only from Patient Booking.
      {isRegisterModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="module-card bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95">
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
                  <CimsSelect
                    value={form.gender}
                    onChange={value => setForm({ ...form, gender: value })}
                    options={[{ value: "Male", label: "Male" }, { value: "Female", label: "Female" }, { value: "Other", label: "Other" }]}
                    ariaLabel="Gender"
                  />
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
                  <CimsSelect
                    value={form.bloodGroup}
                    onChange={value => setForm({ ...form, bloodGroup: value })}
                    options={["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"].map(group => ({ value: group, label: group }))}
                    ariaLabel="Blood group"
                  />
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
                    placeholder="0300 1234567 or +92 300 1234567"
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
                    CNIC / B-form (optional)
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={15}
                    aria-label="CNIC or B-form (optional)"
                    value={form.nationalId}
                    onChange={(e) => setForm({ ...form, nationalId: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                    placeholder="35202-1234567-1"
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
                  placeholder="Street / village, city / district, province / territory"
                />
              </div>

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

              <div className="pt-2 border-t border-slate-100">
                <p className="text-xs font-bold text-slate-800 mb-2">Clinical Alerts & Flags</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
      )} */}
    </div>
  );
}

function SearchField({ children }: { children: React.ReactNode }) {
  return <div className="records-search-field"><Search className="records-search-icon" aria-hidden="true" />{children}</div>;
}
