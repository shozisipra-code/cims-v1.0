"use client";
import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Banknote, FileText, History, Printer, Search } from "lucide-react";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import { useRole } from "@/components/layout/RoleContext";
import { downloadPdfDocument } from "@/lib/pdf";

const empty = { invoice: "", name: "", phone: "", nationalId: "", from: "", to: "" };
export default function PaymentRecordsPage() {
  const { currentUser, ready } = useRole();
  const [invoices, setInvoices] = useState<any[]>([]), [draft, setDraft] = useState(empty), [filters, setFilters] = useState(empty);
  const [loading, setLoading] = useState(true), [error, setError] = useState("");
  useEffect(() => { if (!ready) return; fetch("/api/billing", { headers: { "x-cims-user-id": currentUser.id } }).then(r => r.json()).then(d => d.success ? setInvoices(d.invoices) : setError(d.error)).catch(() => setError("Unable to load payment records.")).finally(() => setLoading(false)); }, [currentUser.id, ready]);
  const filtered = useMemo(() => invoices.filter(inv => {
    const name = `${inv.patient.firstName} ${inv.patient.lastName}`.toLowerCase(), created = new Date(inv.createdAt).getTime();
    const digits = (value: unknown) => String(value || "").replace(/\D/g, "");
    return (!filters.invoice || inv.invoiceNumber.toLowerCase().includes(filters.invoice.toLowerCase())) && (!filters.name || name.includes(filters.name.toLowerCase())) && (!filters.phone || digits(inv.patient.phone).includes(digits(filters.phone))) && (!filters.nationalId || digits(inv.patient.nationalId).includes(digits(filters.nationalId))) && (!filters.from || created >= new Date(`${filters.from}T00:00:00`).getTime()) && (!filters.to || created <= new Date(`${filters.to}T23:59:59.999`).getTime());
  }), [invoices, filters]);
  const payments = filtered.flatMap(inv => (inv.payments || []).map((payment: any) => ({ ...payment, invoice: inv })));
  const received = payments.reduce((sum, payment) => sum + Number(payment.amount), 0);
  const update = (key: keyof typeof empty, value: string) => setDraft(current => ({ ...current, [key]: value }));
  const downloadPayments = () => downloadPdfDocument({
    filename: `payment-records-${new Date().toISOString().slice(0, 10)}.pdf`, title: "Payment Records", subtitle: "Filtered completed payment receipts", orientation: "landscape",
    metrics: [{ label: "Payments received", value: formatCurrency(received) }, { label: "Receipt entries", value: payments.length }],
    sections: [{ title: "Payments", columns: ["Received", "Receipt", "Patient", "MRN", "Method", "Reference", "Received by", "Amount"], rows: payments.map(payment => [formatDateTime(payment.receivedAt), payment.invoice.invoiceNumber, `${payment.invoice.patient.firstName} ${payment.invoice.patient.lastName}`, payment.invoice.patient.mrn, payment.method, payment.reference, payment.receivedBy || "Booking Desk", formatCurrency(payment.amount)]) }],
  });
  return <div className="space-y-6">
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4"><div><h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2.5"><Banknote className="w-6 h-6 text-emerald-600" />Payment Records</h1><p className="text-xs text-slate-500 mt-1">Read-only record of payments received at patient booking.</p></div><div className="flex flex-wrap gap-2"><button type="button" className="btn" disabled={loading || !payments.length} onClick={() => void downloadPayments()}><Printer className="w-4 h-4" />Download PDF</button><Link href="/billing" className="btn"><FileText className="w-4 h-4" />Invoice ledger</Link></div></div>
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4"><Summary label="Payments received" value={formatCurrency(received)} note={`${payments.length} receipt entries`} /><Summary label="Paid receipts" value={String(filtered.filter(inv => inv.status === "PAID").length)} note="No pending-dues workflow" /></div>
    <div className="records-search-panel module-card"><div className="records-search-header"><Search size={18} /><div><h2>Search Payment Records</h2><p>Filter completed receipts only</p></div></div><form className="records-search-grid" onSubmit={e => { e.preventDefault(); setFilters(draft); }}>
      <SearchField><input className="input" placeholder="Invoice Number" value={draft.invoice} onChange={e => update("invoice", e.target.value)} /></SearchField><SearchField><input className="input" placeholder="Patient Name" value={draft.name} onChange={e => update("name", e.target.value)} /></SearchField><SearchField><input className="input" placeholder="Phone Number" value={draft.phone} onChange={e => update("phone", e.target.value)} /></SearchField><SearchField><input className="input" placeholder="CNIC / B-form" value={draft.nationalId} onChange={e => update("nationalId", e.target.value)} /></SearchField>
      <label className="records-search-date"><span>Start Date</span><input className="input" type="date" value={draft.from} onChange={e => update("from", e.target.value)} /></label><label className="records-search-date"><span>End Date</span><input className="input" type="date" value={draft.to} onChange={e => update("to", e.target.value)} /></label><div className="records-search-actions"><button className="records-search-primary">Search</button><button type="button" className="records-search-secondary" onClick={() => { setDraft(empty); setFilters(empty); }}>Clear</button></div>
    </form></div>
    {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-red-700">{error}</div>}
    <div className="module-card bg-white"><div className="module-heading p-4 flex items-center justify-between"><div className="flex items-center gap-2"><History className="w-4 h-4" /><h2 className="text-sm font-bold">Completed payment receipts</h2></div><span className="text-xs">{payments.length} entries</span></div><div className="overflow-x-auto"><table className="w-full text-left text-xs"><thead><tr><th className="px-4">Received</th><th className="px-4">Receipt</th><th className="px-4">Patient</th><th className="px-4">Method / Reference</th><th className="px-4">Received by</th><th className="px-4 text-right">Amount</th></tr></thead><tbody className="divide-y">{loading ? <Empty>Loading payment records...</Empty> : !payments.length ? <Empty>No payment receipts found.</Empty> : payments.map(p => <tr key={p.id}><td className="px-4 py-3 whitespace-nowrap">{formatDateTime(p.receivedAt)}</td><td className="px-4 py-3 font-mono font-bold text-teal-700">{p.invoice.invoiceNumber}</td><td className="px-4 py-3"><Link href={`/patients/${p.invoice.patient.id}`} className="font-bold">{p.invoice.patient.firstName} {p.invoice.patient.lastName}</Link><small className="block">{p.invoice.patient.mrn}</small></td><td className="px-4 py-3"><strong>{p.method}</strong><small className="block">{p.reference || "No reference"}</small></td><td className="px-4 py-3">{p.receivedBy || "Booking Desk"}</td><td className="px-4 py-3 text-right font-bold text-emerald-700">{formatCurrency(p.amount)}</td></tr>)}</tbody></table></div></div>
  </div>;
}
function Summary({ label, value, note }: { label: string; value: string; note: string }) { return <div className="module-card bg-white p-5"><span className="text-xs font-semibold text-emerald-700">{label}</span><p className="text-2xl font-bold text-emerald-700 mt-1">{value}</p><p className="text-[11px] text-slate-400">{note}</p></div>; }
function Empty({ children }: { children: React.ReactNode }) { return <tr><td colSpan={6} className="px-6 py-10 text-center text-slate-400">{children}</td></tr>; }
function SearchField({ children }: { children: React.ReactNode }) { return <div className="records-search-field"><Search className="records-search-icon" />{children}</div>; }
