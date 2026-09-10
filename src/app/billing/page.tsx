"use client";

import React, { useState, useEffect } from "react";
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
    <div className="billing-page">
      {/* Page Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Financial Statement & Invoicing</h1>
          <p className="page-subtitle">
            Physician consultations, laboratory investigations, and pharmacy charges ledger.
          </p>
        </div>
      </div>

      {/* Financial Metrics Cards (LIMS grid-3 style) */}
      <div className="grid-3" style={{ marginBottom: 16 }}>
        <div className="stat-card blue">
          <div className="stat-label">Total Invoiced Amount</div>
          <div className="stat-value">{formatCurrency(totalBilled)}</div>
          <div className="stat-sub">{invoices.length} total hospital invoices</div>
        </div>

        <div className="stat-card green">
          <div className="stat-label">Total Revenue Collected</div>
          <div className="stat-value">{formatCurrency(totalCollected)}</div>
          <div className="stat-sub">Settled via Cash / Card / Insurance</div>
        </div>

        <div className="stat-card red">
          <div className="stat-label">Outstanding Dues</div>
          <div className="stat-value">{formatCurrency(totalOutstanding)}</div>
          <div className="stat-sub">Pending patient balances</div>
        </div>
      </div>

      {/* Invoices List Card */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">Invoices Statement ({filteredInvoices.length})</span>
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
              onClick={() => setStatusFilter("UNPAID")}
              className={`btn ${statusFilter === "UNPAID" ? "btn-primary" : "btn-secondary"} btn-sm`}
            >
              Unpaid
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter("PAID")}
              className={`btn ${statusFilter === "PAID" ? "btn-primary" : "btn-secondary"} btn-sm`}
            >
              Paid
            </button>
          </div>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Invoice #</th>
                <th>Patient Name</th>
                <th>Itemized Services</th>
                <th>Total Billed</th>
                <th>Paid / Balance Due</th>
                <th>Status</th>
                <th style={{ textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: "center", padding: "30px", color: "var(--text-muted)" }}>
                    Loading invoices...
                  </td>
                </tr>
              ) : filteredInvoices.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: "center", padding: "30px", color: "var(--text-muted)" }}>
                    No invoices matching filter.
                  </td>
                </tr>
              ) : (
                filteredInvoices.map((inv) => (
                  <tr key={inv.id}>
                    <td>
                      <strong style={{ fontFamily: "var(--font-mono)", color: "var(--primary)" }}>
                        {inv.invoiceNumber}
                      </strong>
                      <div style={{ fontSize: 10.5, color: "var(--text-muted)" }}>
                        {formatDate(inv.createdAt)}
                      </div>
                    </td>

                    <td>
                      <strong>{inv.patient.firstName} {inv.patient.lastName}</strong>
                      <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-muted)" }}>
                        {inv.patient.mrn}
                      </div>
                    </td>

                    <td style={{ maxWidth: 300 }}>
                      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                        {inv.items?.map((item: any) => (
                          <div key={item.id} style={{ fontSize: 11, color: "var(--text-primary)" }}>
                            • {item.description} ({formatCurrency(item.totalPrice)})
                          </div>
                        ))}
                      </div>
                    </td>

                    <td>
                      <strong style={{ fontFamily: "var(--font-mono)", fontSize: 13.5 }}>
                        {formatCurrency(inv.totalAmount)}
                      </strong>
                    </td>

                    <td>
                      <div style={{ color: "var(--success)", fontWeight: 600, fontSize: 11.5 }}>
                        Paid: {formatCurrency(inv.paidAmount)}
                      </div>
                      {inv.balanceDue > 0 ? (
                        <div style={{ color: "var(--danger)", fontWeight: 700, fontSize: 11.5 }}>
                          Due: {formatCurrency(inv.balanceDue)}
                        </div>
                      ) : (
                        <span style={{ fontSize: 10.5, color: "var(--text-muted)" }}>Settled</span>
                      )}
                    </td>

                    <td>
                      <span className={`badge ${inv.status === "PAID" ? "badge-green" : "badge-red"}`}>
                        {inv.status}
                      </span>
                    </td>

                    <td style={{ textAlign: "right" }}>
                      <div style={{ display: "flex", justifyContent: "flex-end", gap: 6 }}>
                        {inv.status !== "PAID" && (
                          <button
                            type="button"
                            onClick={() => openPaymentModal(inv)}
                            className="btn btn-primary btn-sm"
                          >
                            Collect Payment
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setReceiptInvoice(inv)}
                          className="btn btn-secondary btn-sm"
                        >
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
              maxWidth: 440,
              width: "100%",
              boxShadow: "var(--shadow-lg)",
            }}
          >
            <div className="card-header">
              <span className="card-title">Collect Patient Payment</span>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => setSelectedInvoice(null)}
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleCollectPayment} className="card-body">
              <div
                style={{
                  background: "var(--surface-2)",
                  padding: 12,
                  borderRadius: 6,
                  border: "1px solid var(--border)",
                  marginBottom: 14,
                  fontSize: 12,
                }}
              >
                <div>Invoice: <strong style={{ color: "var(--primary)" }}>{selectedInvoice.invoiceNumber}</strong></div>
                <div>Patient: <strong>{selectedInvoice.patient.firstName} {selectedInvoice.patient.lastName}</strong></div>
                <div style={{ marginTop: 6, paddingTop: 6, borderTop: "1px solid var(--border)", display: "flex", justifyContent: "space-between" }}>
                  <span>Outstanding Balance:</span>
                  <strong style={{ color: "var(--danger)", fontSize: 14 }}>
                    {formatCurrency(selectedInvoice.balanceDue)}
                  </strong>
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: 12 }}>
                <label className="form-label required">Payment Amount ($)</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  className="form-input"
                  style={{ fontSize: 16, fontWeight: 700 }}
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                />
              </div>

              <div className="form-group" style={{ marginBottom: 16 }}>
                <label className="form-label">Payment Method</label>
                <select
                  className="form-select"
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                >
                  <option value="Cash">Cash (Counter Cashier)</option>
                  <option value="Credit Card">Credit / Debit Card</option>
                  <option value="Insurance">Insurance / Third-Party Payer</option>
                  <option value="Mobile Banking">Mobile Banking / UPI</option>
                </select>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setSelectedInvoice(null)}
                >
                  Cancel
                </button>
                <button type="submit" disabled={savingPayment} className="btn btn-primary">
                  {savingPayment ? "Processing..." : "Confirm Payment"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Printable Receipt Modal (LIMS print style) */}
      {receiptInvoice && (
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
              maxWidth: 580,
              width: "100%",
              maxHeight: "90vh",
              overflowY: "auto",
              boxShadow: "var(--shadow-lg)",
              background: "white",
              color: "#1a1a2e",
            }}
          >
            <div className="card-header no-print">
              <span className="card-title">Official Receipt Preview</span>
              <div style={{ display: "flex", gap: 6 }}>
                <button type="button" onClick={handlePrint} className="btn btn-primary btn-sm">
                  Print
                </button>
                <button
                  type="button"
                  onClick={() => setReceiptInvoice(null)}
                  className="btn btn-ghost btn-sm"
                >
                  &times;
                </button>
              </div>
            </div>

            <div className="card-body" style={{ padding: 24, fontSize: 12 }}>
              {/* Receipt Header */}
              <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid var(--border)", paddingBottom: 14, marginBottom: 14 }}>
                <div>
                  <h2 style={{ fontSize: 16, fontWeight: 800, color: "var(--primary)" }}>CIMS CLINICAL CARE</h2>
                  <p style={{ fontSize: 11, color: "var(--text-muted)" }}>Clinical Integrated Management System</p>
                  <p style={{ fontSize: 10.5, color: "var(--text-muted)" }}>740 Health Boulevard • Tel: +1 (555) 010-CIMS</p>
                </div>
                <div style={{ textAlign: "right" }}>
                  <strong style={{ fontFamily: "var(--font-mono)", fontSize: 13, color: "var(--primary)" }}>
                    {receiptInvoice.invoiceNumber}
                  </strong>
                  <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{formatDate(receiptInvoice.createdAt)}</div>
                  <span
                    className={`badge ${receiptInvoice.status === "PAID" ? "badge-green" : "badge-red"}`}
                    style={{ marginTop: 4 }}
                  >
                    {receiptInvoice.status}
                  </span>
                </div>
              </div>

              {/* Patient Info */}
              <div style={{ background: "var(--surface-2)", padding: 10, borderRadius: 6, marginBottom: 14, display: "flex", justifyContent: "space-between" }}>
                <div>
                  <span style={{ fontSize: 10, textTransform: "uppercase", color: "var(--text-muted)", fontWeight: 700, display: "block" }}>
                    Patient Name
                  </span>
                  <strong>{receiptInvoice.patient.firstName} {receiptInvoice.patient.lastName}</strong>
                </div>
                <div style={{ textAlign: "right" }}>
                  <span style={{ fontSize: 10, textTransform: "uppercase", color: "var(--text-muted)", fontWeight: 700, display: "block" }}>
                    MRN
                  </span>
                  <strong style={{ fontFamily: "var(--font-mono)", color: "var(--primary)" }}>{receiptInvoice.patient.mrn}</strong>
                </div>
              </div>

              {/* Itemized Table */}
              <table style={{ width: "100%", marginBottom: 14 }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--border)" }}>
                    <th style={{ textAlign: "left", padding: "6px 0", fontSize: 10.5, textTransform: "uppercase", color: "var(--text-muted)" }}>Service</th>
                    <th style={{ textAlign: "center", padding: "6px 0", fontSize: 10.5, textTransform: "uppercase", color: "var(--text-muted)" }}>Qty</th>
                    <th style={{ textAlign: "right", padding: "6px 0", fontSize: 10.5, textTransform: "uppercase", color: "var(--text-muted)" }}>Unit</th>
                    <th style={{ textAlign: "right", padding: "6px 0", fontSize: 10.5, textTransform: "uppercase", color: "var(--text-muted)" }}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {receiptInvoice.items?.map((item: any) => (
                    <tr key={item.id} style={{ borderBottom: "1px solid var(--border)" }}>
                      <td style={{ padding: "6px 0" }}>{item.description}</td>
                      <td style={{ textAlign: "center", padding: "6px 0" }}>{item.quantity}</td>
                      <td style={{ textAlign: "right", padding: "6px 0" }}>{formatCurrency(item.unitPrice)}</td>
                      <td style={{ textAlign: "right", padding: "6px 0", fontWeight: 700 }}>
                        {formatCurrency(item.totalPrice)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Totals Summary */}
              <div style={{ borderTop: "1px solid var(--border)", paddingTop: 10, display: "flex", flexDirection: "column", gap: 4 }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "var(--text-muted)" }}>Subtotal:</span>
                  <span>{formatCurrency(receiptInvoice.subtotal)}</span>
                </div>
                {receiptInvoice.tax > 0 && (
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "var(--text-muted)" }}>Tax:</span>
                    <span>{formatCurrency(receiptInvoice.tax)}</span>
                  </div>
                )}
                <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 800, fontSize: 14, borderTop: "1px solid var(--border)", paddingTop: 6, color: "var(--primary)" }}>
                  <span>Total Amount:</span>
                  <span>{formatCurrency(receiptInvoice.totalAmount)}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", color: "var(--success)", fontWeight: 700 }}>
                  <span>Paid ({receiptInvoice.paymentMethod || "Cash"}):</span>
                  <span>{formatCurrency(receiptInvoice.paidAmount)}</span>
                </div>
                {receiptInvoice.balanceDue > 0 && (
                  <div style={{ display: "flex", justifyContent: "space-between", color: "var(--danger)", fontWeight: 700 }}>
                    <span>Balance Due:</span>
                    <span>{formatCurrency(receiptInvoice.balanceDue)}</span>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div style={{ borderTop: "1px solid #D3E4F1", paddingTop: 16, marginTop: 16, display: "flex", justifyContent: "space-between", fontSize: 10, color: "#6d7c90" }}>
                <span>Thank you for visiting CIMS Clinical Care.</span>
                <span>Authorized Cashier Signature</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
