"use client";
import React, { useEffect, useState } from "react";
import Link from "next/link";
import { CreditCard, Printer, ReceiptText } from "lucide-react";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/utils";
import { PAKISTAN } from "@/lib/pakistan";
import { useRole } from "@/components/layout/RoleContext";
import { downloadPdfDocument, downloadReceiptPdf } from "@/lib/pdf";

export default function BillingPage() {
  const { currentUser, ready } = useRole();
  const [invoices, setInvoices] = useState<any[]>([]), [loading, setLoading] = useState(true), [receipt, setReceipt] = useState<any>(null);
  useEffect(() => {
    if (!ready) return;
    const patientId = new URLSearchParams(window.location.search).get("patientId");
    const url = patientId ? `/api/billing?patientId=${encodeURIComponent(patientId)}` : "/api/billing";
    fetch(url, { headers: { "x-cims-user-id": currentUser.id } }).then(r => r.json()).then(d => d.success && setInvoices(d.invoices)).finally(() => setLoading(false));
  }, [currentUser.id, ready]);
  const received = invoices.reduce((sum, inv) => sum + Number(inv.paidAmount || 0), 0);
  const downloadLedger = () => downloadPdfDocument({
    filename: `billing-receipt-ledger-${new Date().toISOString().slice(0, 10)}.pdf`, title: "Billing and Receipt Ledger", subtitle: "Completed patient receipts", orientation: "landscape",
    metrics: [{ label: "Total receipts", value: invoices.length }, { label: "Total received", value: formatCurrency(received) }],
    sections: [{ title: "Receipt ledger", columns: ["Receipt", "Date", "Patient", "MRN", "Description", "Method", "Amount received"], rows: invoices.map(inv => [inv.invoiceNumber, formatDate(inv.createdAt), `${inv.patient.firstName} ${inv.patient.lastName}`, inv.patient.mrn, inv.items?.map((item: any) => item.description).join("; "), inv.paymentMethod || "Cash", formatCurrency(inv.paidAmount)]) }],
  });
  return <div className="space-y-6">
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4"><div><h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2.5"><CreditCard className="w-6 h-6 text-teal-600" />Billing &amp; Receipts</h1><p className="text-xs text-slate-500 mt-1">Read-only ledger of completed patient receipts. Payments are entered during booking.</p></div><div className="flex flex-wrap gap-2"><button type="button" className="btn" disabled={loading || !invoices.length} onClick={() => void downloadLedger()}><Printer className="w-4 h-4" />Download ledger PDF</button><Link href="/booking" className="btn btn-primary"><ReceiptText className="w-4 h-4" />Open Patient Booking</Link></div></div>
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4"><Summary label="Total receipts" value={String(invoices.length)} note="Recorded transactions" /><Summary label="Total received" value={formatCurrency(received)} note="Completed collections" /></div>
    <div className="module-card bg-white"><div className="module-heading"><h2 className="font-bold">Receipt ledger</h2><span className="text-xs">Completed records only</span></div><div className="overflow-x-auto"><table className="w-full text-left text-xs"><thead><tr><th className="px-5">Receipt #</th><th className="px-4">Patient</th><th className="px-4">Description</th><th className="px-4">Method</th><th className="px-4 text-right">Amount received</th><th className="px-5 text-center">Action</th></tr></thead><tbody className="divide-y">{loading ? <Empty>Loading receipts...</Empty> : !invoices.length ? <Empty>No receipts recorded.</Empty> : invoices.map(inv => <tr key={inv.id}><td className="px-5 py-3"><strong className="font-mono text-teal-700">{inv.invoiceNumber}</strong><small className="block text-slate-400">{formatDate(inv.createdAt)}</small></td><td className="px-4 py-3"><strong>{inv.patient.firstName} {inv.patient.lastName}</strong><small className="block text-teal-700">{inv.patient.mrn}</small></td><td className="px-4 py-3">{inv.items?.map((item: any) => item.description).join(", ") || "Payment receipt"}</td><td className="px-4 py-3">{inv.paymentMethod || "Cash"}</td><td className="px-4 py-3 text-right font-bold text-emerald-700">{formatCurrency(inv.paidAmount)}</td><td className="px-5 py-3 text-center"><button onClick={() => setReceipt(inv)} className="btn"><Printer className="w-4 h-4" />Receipt</button></td></tr>)}</tbody></table></div></div>
    {receipt && <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4"><div className="module-card bg-white max-w-xl w-full p-8"><div className="no-print flex justify-between mb-6"><strong>Receipt Preview</strong><div className="flex gap-2"><button className="btn btn-primary" onClick={() => void downloadReceiptPdf(receipt)}><Printer className="w-4 h-4" />Download PDF</button><button className="btn" onClick={() => setReceipt(null)}>Close</button></div></div><div className="space-y-5 text-slate-800"><div className="flex justify-between border-b pb-4"><div><h2 className="text-lg font-black text-teal-800">{PAKISTAN.facilityName}</h2><p className="text-xs text-slate-500">{PAKISTAN.facilityAddress}</p></div><div className="text-right"><strong className="font-mono">{receipt.invoiceNumber}</strong><p className="text-xs">{formatDate(receipt.createdAt)}</p></div></div><div><p className="text-xs text-slate-500">Patient</p><strong>{receipt.patient.firstName} {receipt.patient.lastName} · {receipt.patient.mrn}</strong></div>{receipt.items?.map((item: any) => <div key={item.id} className="flex justify-between border-b py-2"><span>{item.description}</span><strong>{formatCurrency(item.totalPrice)}</strong></div>)}<div className="flex justify-between text-lg"><strong>Amount received</strong><strong className="text-emerald-700">{formatCurrency(receipt.paidAmount)}</strong></div><p className="text-xs text-slate-500">{receipt.paymentMethod || "Cash"}{receipt.payments?.[0]?.reference ? ` · ${receipt.payments[0].reference}` : ""}{receipt.payments?.[0] ? ` · ${formatDateTime(receipt.payments[0].receivedAt)}` : ""}</p></div></div></div>}
  </div>;
}
function Summary({ label, value, note }: { label: string; value: string; note: string }) { return <div className="module-card bg-white p-5"><span className="text-xs font-semibold text-slate-500">{label}</span><p className="text-2xl font-bold text-emerald-700">{value}</p><small className="text-slate-400">{note}</small></div>; }
function Empty({ children }: { children: React.ReactNode }) { return <tr><td colSpan={6} className="p-10 text-center text-slate-400">{children}</td></tr>; }
