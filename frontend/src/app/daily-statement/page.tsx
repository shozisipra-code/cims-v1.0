"use client";

import { useEffect, useState } from "react";
import { Banknote, CalendarDays, FileText, Printer, ScrollText, UserPlus, Users } from "lucide-react";
import { pakistanDateKey } from "@/lib/pakistan";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import { useRole } from "@/components/layout/RoleContext";
import { downloadPdfDocument } from "@/lib/pdf";

export default function DailyStatementPage() {
  const { currentUser, ready } = useRole();
  const [date, setDate] = useState(pakistanDateKey());
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  function load(selected = date) {
    if (!ready) return;
    setLoading(true); setError("");
    fetch(`/api/daily-statement?date=${encodeURIComponent(selected)}`, { headers: { "x-cims-user-id": currentUser.id } }).then(async response => {
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || "Unable to load statement.");
      setData(result.statement);
    }).catch(cause => setError(cause.message || "Unable to load statement.")).finally(() => setLoading(false));
  }
  useEffect(() => { load(); }, [currentUser.id, ready]);

  const summary = data?.summary || {};
  const downloadStatement = () => data && downloadPdfDocument({
    filename: `daily-clinic-statement-${date}.pdf`,
    title: "Daily Clinic Statement",
    subtitle: `Clinic activity and completed payment collections for ${date}`,
    orientation: "landscape",
    metrics: [{ label: "Appointments", value: summary.appointments }, { label: "New patients", value: summary.newPatients }, { label: "Clinic billing", value: formatCurrency(summary.billed) }, { label: "Collected", value: formatCurrency(summary.collected) }],
    sections: [
      { title: "Patient appointments", columns: ["Time / token", "Patient", "MRN", "Doctor", "Status", "Reason"], rows: data.appointments.map((item: any) => [`${formatDateTime(item.scheduledAt)} / #${item.tokenNumber}`, `${item.patient.firstName} ${item.patient.lastName}`, item.patient.mrn, item.doctor.name, item.status.replaceAll("_", " "), item.reason]) },
      { title: "New patient registrations", columns: ["Registered", "Patient", "MRN", "Phone", "Gender"], rows: data.patients.map((item: any) => [formatDateTime(item.createdAt), `${item.firstName} ${item.lastName}`, item.mrn, item.phone, item.gender]) },
      { title: "Patient receipts", columns: ["Receipt", "Patient", "MRN", "Doctor", "Services", "Amount received"], rows: data.invoices.map((item: any) => [item.invoiceNumber, `${item.patient.firstName} ${item.patient.lastName}`, item.patient.mrn, item.encounter?.doctor?.name || "Booking desk", item.items.map((line: any) => line.description).join("; "), formatCurrency(item.paidAmount)]) },
      { title: "Payments received", columns: ["Received", "Invoice", "Patient", "Method", "Reference", "Received by", "Amount"], rows: data.payments.map((item: any) => [formatDateTime(item.receivedAt), item.invoice.invoiceNumber, `${item.invoice.patient.firstName} ${item.invoice.patient.lastName} (${item.invoice.patient.mrn})`, item.method, item.reference, item.receivedBy || "Billing Desk", formatCurrency(item.amount)]) },
    ],
  });
  return <div className="daily-statement-page space-y-5">
    <header className="page-header"><div><h1 className="page-title flex items-center gap-2"><ScrollText size={23} /> Daily Clinic Statement</h1><p className="page-subtitle">Patient activity and completed payment collections for one clinic day.</p></div><div className="page-actions no-print"><input className="input statement-date-input" type="date" value={date} onChange={event => setDate(event.target.value)} /><button className="btn btn-primary" onClick={() => load(date)}>Load statement</button><button className="btn" disabled={!data || loading} onClick={() => void downloadStatement()}><Printer size={15} />Download PDF</button></div></header>
    {error && <div className="pharmacy-alert error">{error}</div>}{loading && <section className="card card-body">Loading daily statement…</section>}
    {!loading && data && <>
      <div className="clinic-statement-stats">
        <Stat icon={<Users />} label="Appointments" value={summary.appointments} note={`${summary.newPatients} new patient registrations`} />
        <Stat icon={<FileText />} label="Clinic billing" value={formatCurrency(summary.billed)} note={`${data.invoices.length} invoices issued`} />
        <Stat icon={<Banknote />} label="Collected" value={formatCurrency(summary.collected)} note="Completed payments received" />
      </div>
      <div className="clinic-statement-grid">
        <StatementTable title="Patient appointments" icon={<CalendarDays />} empty="No appointments on this date." headings={["Time / Token", "Patient", "Doctor", "Status", "Reason"]} rows={data.appointments.map((item: any) => [<><strong>{formatDateTime(item.scheduledAt)}</strong><small>Token {item.tokenNumber}</small></>, <><strong>{item.patient.firstName} {item.patient.lastName}</strong><small>{item.patient.mrn}</small></>, item.doctor.name, item.status.replaceAll("_", " "), item.reason || "—"])} />
        <StatementTable title="New patient registrations" icon={<UserPlus />} empty="No patients registered on this date." headings={["Registered", "Patient", "Phone", "Gender"]} rows={data.patients.map((item: any) => [formatDateTime(item.createdAt), <><strong>{item.firstName} {item.lastName}</strong><small>{item.mrn}</small></>, item.phone, item.gender])} />
      </div>
      <StatementTable title="Patient receipts" icon={<FileText />} empty="No receipts issued on this date." headings={["Receipt", "Patient", "Doctor", "Services", "Amount received"]} rows={data.invoices.map((item: any) => [<strong>{item.invoiceNumber}</strong>, <><strong>{item.patient.firstName} {item.patient.lastName}</strong><small>{item.patient.mrn}</small></>, item.encounter?.doctor?.name || "Booking desk", item.items.map((line: any) => line.description).join(", "), <span className="statement-positive">{formatCurrency(item.paidAmount)}</span>])} />
      <StatementTable title="Payments received" icon={<Banknote />} empty="No payments received on this date." headings={["Received", "Invoice", "Patient", "Method", "Reference", "Received by", "Amount"]} rows={data.payments.map((item: any) => [formatDateTime(item.receivedAt), <strong>{item.invoice.invoiceNumber}</strong>, <><strong>{item.invoice.patient.firstName} {item.invoice.patient.lastName}</strong><small>{item.invoice.patient.mrn}</small></>, item.method, item.reference || "—", item.receivedBy || "Billing Desk", <strong className="statement-positive">{formatCurrency(item.amount)}</strong>])} />
    </>}
  </div>;
}

function Stat({ icon, label, value, note, warning }: any) { return <div className={`stat-card ${warning ? "warning" : ""}`}><div className="stat-label">{label}{icon}</div><div className="stat-value">{value}</div><div className="stat-sub">{note}</div></div>; }
function StatementTable({ title, icon, empty, headings, rows }: any) { return <section className="card clinic-statement-table"><div className="card-header"><h2>{icon}{title}</h2><span>{rows.length} entries</span></div><div className="table-scroll"><table><thead><tr>{headings.map((heading: string) => <th key={heading}>{heading}</th>)}</tr></thead><tbody>{rows.length ? rows.map((row: any[], index: number) => <tr key={index}>{row.map((cell, cellIndex) => <td key={cellIndex}>{cell}</td>)}</tr>) : <tr><td className="statement-empty" colSpan={headings.length}>{empty}</td></tr>}</tbody></table></div></section>; }
