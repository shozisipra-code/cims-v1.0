"use client";

import React, { useState, useEffect } from "react";
import {
  CreditCard,
  Search,
  CheckCircle2,
  Clock,
  Printer,
  DollarSign,
  Plus,
  X,
  FileText,
  Building2,
  Calendar,
} from "lucide-react";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/utils";
import { useRole } from "@/components/layout/RoleContext";

export default function BillingPage() {
  const { currentUser } = useRole();
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("ALL");

  // Payment Modal
  const [selectedInvoice, setSelectedInvoice] = useState<any | null>(null);
  const [paymentAmount, setPaymentAmount] = useState<string>("");
  const [paymentMethod, setPaymentMethod] = useState<string>("Cash");
  const [savingPayment, setSavingPayment] = useState(false);

  // Print Receipt Modal
  const [receiptInvoice, setReceiptInvoice] = useState<any | null>(null);

  const fetchInvoices = () => {
    setLoading(true);
    fetch("/api/billing")
      .then((res) => res.json())
      .then((data) => {
        if (data.success) setInvoices(data.invoices);
      })
      .catch((e) => console.error(e))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchInvoices();
  }, []);

  const openPaymentModal = (inv: any) => {
    setSelectedInvoice(inv);
    setPaymentAmount(inv.balanceDue.toString());
    setPaymentMethod("Cash");
  };

  const handleCollectPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInvoice) return;
    setSavingPayment(true);
    try {
      const res = await fetch("/api/billing", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: selectedInvoice.id,
          paymentAmount: parseFloat(paymentAmount),
          paymentMethod,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setSelectedInvoice(null);
        fetchInvoices();
      } else {
        alert(data.error || "Failed to process payment");
      }
    } catch (e) {
      console.error(e);
      alert("Error processing payment.");
    } finally {
      setSavingPayment(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const totalBilled = invoices.reduce((acc, inv) => acc + (inv.totalAmount || 0), 0);
  const totalCollected = invoices.reduce((acc, inv) => acc + (inv.paidAmount || 0), 0);
  const totalOutstanding = invoices.reduce((acc, inv) => acc + (inv.balanceDue || 0), 0);

  const filteredInvoices = invoices.filter((inv) => {
    if (statusFilter === "ALL") return true;
    return inv.status === statusFilter;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight flex items-center gap-2.5">
            <CreditCard className="w-6 h-6 text-blue-600" />
            Point-of-Care Billing & Invoices
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Collate physician consultations, laboratory investigations, and pharmacy charges into unified receipts.
          </p>
        </div>
      </div>

      {/* KPI Financial Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <span className="text-xs font-semibold text-slate-500 block">Total Invoiced Amount</span>
          <p className="text-2xl font-bold text-slate-900 mt-1">{formatCurrency(totalBilled)}</p>
          <p className="text-[11px] text-slate-400 mt-0.5">{invoices.length} total hospital bills</p>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <span className="text-xs font-semibold text-emerald-600 block">Total Revenue Collected</span>
          <p className="text-2xl font-bold text-emerald-700 mt-1">{formatCurrency(totalCollected)}</p>
          <p className="text-[11px] text-emerald-600/80 mt-0.5">Cleared via Cash / Card / Insurance</p>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <span className="text-xs font-semibold text-red-600 block">Outstanding Receivables</span>
          <p className="text-2xl font-bold text-red-700 mt-1">{formatCurrency(totalOutstanding)}</p>
          <p className="text-[11px] text-red-600/80 mt-0.5">Pending patient co-pays & dues</p>
        </div>
      </div>

      {/* Invoices List */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 bg-slate-50/50">
          <div className="flex items-center gap-2 text-xs">
            <button
              onClick={() => setStatusFilter("ALL")}
              className={`px-3 py-1.5 rounded-lg font-bold transition ${
                statusFilter === "ALL" ? "bg-blue-600 text-white" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              All Invoices ({invoices.length})
            </button>
            <button
              onClick={() => setStatusFilter("UNPAID")}
              className={`px-3 py-1.5 rounded-lg font-bold transition ${
                statusFilter === "UNPAID" ? "bg-red-600 text-white" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Unpaid
            </button>
            <button
              onClick={() => setStatusFilter("PAID")}
              className={`px-3 py-1.5 rounded-lg font-bold transition ${
                statusFilter === "PAID" ? "bg-emerald-600 text-white" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Paid
            </button>
          </div>

          <span className="text-[11px] text-slate-400">Integrated Financial Ledger</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200 uppercase tracking-wider text-[10px]">
              <tr>
                <th className="px-5 py-3">Invoice #</th>
                <th className="px-4 py-3">Patient</th>
                <th className="px-4 py-3">Line Items</th>
                <th className="px-4 py-3">Total Amount</th>
                <th className="px-4 py-3">Paid / Balance Due</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-slate-400">
                    Loading invoices...
                  </td>
                </tr>
              ) : filteredInvoices.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-slate-400">
                    No invoices found.
                  </td>
                </tr>
              ) : (
                filteredInvoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-slate-50/80 transition">
                    <td className="px-5 py-3.5 whitespace-nowrap">
                      <span className="font-mono font-bold text-blue-700">{inv.invoiceNumber}</span>
                      <p className="text-[10px] text-slate-400">{formatDate(inv.createdAt)}</p>
                    </td>

                    <td className="px-4 py-3.5">
                      <p className="font-bold text-slate-900">
                        {inv.patient.firstName} {inv.patient.lastName}
                      </p>
                      <p className="text-[11px] font-mono text-teal-700">{inv.patient.mrn}</p>
                    </td>

                    <td className="px-4 py-3.5 max-w-xs">
                      <div className="space-y-0.5">
                        {inv.items?.map((item: any) => (
                          <p key={item.id} className="text-[11px] text-slate-700 truncate">
                            • {item.description} ({formatCurrency(item.totalPrice)})
                          </p>
                        ))}
                      </div>
                    </td>

                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <span className="text-sm font-bold text-slate-900">
                        {formatCurrency(inv.totalAmount)}
                      </span>
                    </td>

                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <p className="text-emerald-700 font-semibold">
                        Paid: {formatCurrency(inv.paidAmount)}
                      </p>
                      {inv.balanceDue > 0 ? (
                        <p className="text-red-600 font-bold text-[11px]">
                          Due: {formatCurrency(inv.balanceDue)}
                        </p>
                      ) : (
                        <p className="text-slate-400 text-[10px]">Settled</p>
                      )}
                    </td>

                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <span
                        className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${
                          inv.status === "PAID"
                            ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                            : "bg-red-100 text-red-800 border border-red-200"
                        }`}
                      >
                        {inv.status}
                      </span>
                    </td>

                    <td className="px-5 py-3.5 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-2">
                        {inv.status !== "PAID" && (
                          <button
                            onClick={() => openPaymentModal(inv)}
                            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold text-xs transition shadow-sm"
                          >
                            Collect Payment
                          </button>
                        )}

                        <button
                          onClick={() => setReceiptInvoice(inv)}
                          className="px-2.5 py-1.5 border border-slate-200 hover:border-slate-400 text-slate-700 rounded-lg text-xs font-semibold transition flex items-center gap-1"
                        >
                          <Printer className="w-3.5 h-3.5" />
                          Receipt
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Collect Payment Modal */}
      {selectedInvoice && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3 mb-4">
              <h2 className="text-base font-bold text-slate-800">Collect Patient Payment</h2>
              <button onClick={() => setSelectedInvoice(null)} className="text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCollectPayment} className="space-y-4 text-xs">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                <p className="text-slate-500">
                  Invoice: <strong className="text-blue-700">{selectedInvoice.invoiceNumber}</strong>
                </p>
                <p className="text-slate-500">
                  Patient:{" "}
                  <strong>
                    {selectedInvoice.patient.firstName} {selectedInvoice.patient.lastName}
                  </strong>
                </p>
                <div className="flex justify-between pt-1 font-bold text-slate-800 text-sm">
                  <span>Balance Outstanding:</span>
                  <span className="text-red-600">{formatCurrency(selectedInvoice.balanceDue)}</span>
                </div>
              </div>

              <div>
                <label className="font-semibold text-slate-700 mb-1 block">Payment Amount ($) *</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-base font-bold text-slate-900"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 mb-1 block">Payment Channel</label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-slate-50"
                >
                  <option value="Cash">Cash (Counter Cashier)</option>
                  <option value="Credit Card">Credit / Debit Card</option>
                  <option value="Insurance">Insurance / Third-Party Payer</option>
                  <option value="Mobile Banking">Mobile Banking / UPI</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setSelectedInvoice(null)}
                  className="px-4 py-2 font-semibold text-slate-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingPayment}
                  className="px-5 py-2 font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl transition shadow-sm disabled:opacity-50"
                >
                  {savingPayment ? "Processing..." : "Confirm Payment"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Printable Receipt Modal */}
      {receiptInvoice && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-xl w-full max-h-[90vh] overflow-y-auto p-8 shadow-2xl border border-slate-200 animate-in fade-in">
            {/* Action buttons (hidden when printing) */}
            <div className="flex justify-between items-center no-print mb-6 border-b border-slate-200 pb-4">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Official Clinical Receipt Preview
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={handlePrint}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow-sm"
                >
                  <Printer className="w-3.5 h-3.5" />
                  Print Receipt
                </button>
                <button
                  onClick={() => setReceiptInvoice(null)}
                  className="text-slate-400 hover:text-slate-700"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Printable Receipt Content */}
            <div className="space-y-6 text-slate-800">
              {/* Header */}
              <div className="flex items-start justify-between border-b border-slate-200 pb-4">
                <div>
                  <h2 className="text-lg font-black tracking-tight text-teal-800">
                    CIMS CENTRAL HOSPITAL
                  </h2>
                  <p className="text-xs text-slate-500">Clinical Integrated Management System</p>
                  <p className="text-[11px] text-slate-400">740 Health Boulevard, Medical District</p>
                  <p className="text-[11px] text-slate-400">Tel: +1 (555) 010-CIMS</p>
                </div>
                <div className="text-right">
                  <span className="font-mono text-xs font-bold text-slate-900 block">
                    {receiptInvoice.invoiceNumber}
                  </span>
                  <span className="text-[11px] text-slate-500 block">
                    Date: {formatDate(receiptInvoice.createdAt)}
                  </span>
                  <span
                    className={`inline-block mt-2 px-2 py-0.5 rounded text-[10px] font-extrabold uppercase border ${
                      receiptInvoice.status === "PAID"
                        ? "border-emerald-500 text-emerald-700 bg-emerald-50"
                        : "border-red-500 text-red-700 bg-red-50"
                    }`}
                  >
                    {receiptInvoice.status}
                  </span>
                </div>
              </div>

              {/* Patient Demographics */}
              <div className="grid grid-cols-2 gap-4 text-xs bg-slate-50 p-3 rounded-lg">
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Patient Name:</span>
                  <p className="font-bold text-slate-900">
                    {receiptInvoice.patient.firstName} {receiptInvoice.patient.lastName}
                  </p>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Medical Record No:</span>
                  <p className="font-mono font-bold text-teal-800">{receiptInvoice.patient.mrn}</p>
                </div>
              </div>

              {/* Itemized Table */}
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-300 font-bold text-slate-700 uppercase text-[10px]">
                  <tr>
                    <th className="py-2">Item Description</th>
                    <th className="py-2 text-center">Qty</th>
                    <th className="py-2 text-right">Unit Price</th>
                    <th className="py-2 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {receiptInvoice.items?.map((item: any) => (
                    <tr key={item.id}>
                      <td className="py-2.5 text-slate-800 font-medium">{item.description}</td>
                      <td className="py-2.5 text-center text-slate-600">{item.quantity}</td>
                      <td className="py-2.5 text-right text-slate-600">{formatCurrency(item.unitPrice)}</td>
                      <td className="py-2.5 text-right font-bold text-slate-900">
                        {formatCurrency(item.totalPrice)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Total Calculation */}
              <div className="border-t border-slate-300 pt-3 space-y-1.5 text-xs text-right">
                <div className="flex justify-between">
                  <span className="text-slate-500">Subtotal:</span>
                  <span className="font-semibold">{formatCurrency(receiptInvoice.subtotal)}</span>
                </div>
                {receiptInvoice.discount > 0 && (
                  <div className="flex justify-between text-emerald-700">
                    <span>Discount:</span>
                    <span>-{formatCurrency(receiptInvoice.discount)}</span>
                  </div>
                )}
                {receiptInvoice.tax > 0 && (
                  <div className="flex justify-between text-slate-500">
                    <span>Applicable Tax:</span>
                    <span>{formatCurrency(receiptInvoice.tax)}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm font-black border-t border-slate-200 pt-2 text-slate-900">
                  <span>Total Due:</span>
                  <span>{formatCurrency(receiptInvoice.totalAmount)}</span>
                </div>
                <div className="flex justify-between text-emerald-700 font-bold">
                  <span>Amount Paid ({receiptInvoice.paymentMethod || "Cash"}):</span>
                  <span>{formatCurrency(receiptInvoice.paidAmount)}</span>
                </div>
                <div className="flex justify-between text-red-600 font-bold">
                  <span>Remaining Balance:</span>
                  <span>{formatCurrency(receiptInvoice.balanceDue)}</span>
                </div>
              </div>

              {/* Footer */}
              <div className="pt-6 border-t border-slate-200 flex items-center justify-between text-[11px] text-slate-400">
                <p>Thank you for choosing CIMS Central Hospital.</p>
                <p>Authorized Cashier Signature: __________________</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
