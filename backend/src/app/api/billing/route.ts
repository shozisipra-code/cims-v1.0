import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { invoiceTotals, roundRupees } from "@/lib/billing";
import { PAYMENT_METHODS } from "@/lib/pakistan";
import { authorizationErrorResponse, requireActor } from "@/lib/auth";

export async function GET(req: NextRequest) {
  try {
    await requireActor(req, { anyOf: ["billing", "payments"] });
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const patientId = searchParams.get("patientId");

    const where: any = {};
    if (status) where.status = status;
    if (patientId) where.patientId = patientId;

    const invoices = await prisma.invoice.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        patient: true,
        items: true,
        payments: { orderBy: { receivedAt: "desc" } },
        encounter: {
          include: { doctor: true },
        },
      },
    });

    return NextResponse.json({ success: true, invoices });
  } catch (error) {
    const authorizationResponse = authorizationErrorResponse(error);
    if (authorizationResponse) return authorizationResponse;
    console.error("Fetch invoices error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch invoices" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const actor = await requireActor(req, { anyOf: ["billing", "payments"] });
    const body = await req.json();
    const { patientId, encounterId, items, discount, tax, paymentMethod, paymentReference, receivedBy, notes } = body;

    if (!patientId || !Array.isArray(items) || !items.length) {
      return NextResponse.json(
        { success: false, error: "Patient ID and at least one billable item are required." },
        { status: 400 }
      );
    }

    const count = await prisma.invoice.count();
    const currentYear = new Date().getFullYear();
    const invoiceNumber = `INV-${currentYear}-${String(count + 1).padStart(4, "0")}`;

    let totals;
    try {
      totals = invoiceTotals(items.map((item: any) => ({ quantity: Number(item.quantity ?? 1), unitPrice: Number(item.unitPrice) })), Number(discount ?? 0), Number(tax ?? 0));
      if (paymentMethod && !PAYMENT_METHODS.includes(paymentMethod)) throw new Error("Unsupported payment method.");
    } catch (error) {
      return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Invalid invoice." }, { status: 400 });
    }
    const { subtotal, discount: discountVal, tax: taxVal, totalAmount } = totals;

    const receivedAt = new Date();
    const invoice = await prisma.invoice.create({
      data: {
        invoiceNumber,
        patientId,
        encounterId: encounterId || null,
        subtotal,
        discount: discountVal,
        tax: taxVal,
        totalAmount,
        paidAmount: totalAmount,
        balanceDue: 0,
        status: "PAID",
        paymentMethod: paymentMethod || "Cash",
        paidAt: receivedAt,
        notes: notes || null,
        items: {
          create: items.map((i: any) => ({
            description: i.description,
            category: i.category || "SERVICE",
            quantity: i.quantity ? parseInt(i.quantity) : 1,
            unitPrice: parseFloat(i.unitPrice) || 0,
            totalPrice: roundRupees(Number(i.quantity ?? 1) * Number(i.unitPrice)),
          })),
        },
        payments: totalAmount > 0 ? { create: [{ amount: totalAmount, method: paymentMethod || "Cash", reference: String(paymentReference || "").trim() || null, receivedBy: String(receivedBy || "Billing Desk").trim(), receivedAt }] } : undefined,
      },
      include: {
        items: true,
        patient: true,
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: actor.id,
        userName: actor.name,
        userRole: actor.role,
        action: "CREATE",
        resource: "INVOICE",
        resourceId: invoice.id,
        details: `Invoice #${invoiceNumber} issued for PKR ${totalAmount.toFixed(2)} to ${invoice.patient.firstName} ${invoice.patient.lastName}`,
      },
    });

    return NextResponse.json({ success: true, invoice }, { status: 201 });
  } catch (error) {
    const authorizationResponse = authorizationErrorResponse(error);
    if (authorizationResponse) return authorizationResponse;
    console.error("Create invoice error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to create invoice" },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  return NextResponse.json(
    { success: false, error: "Payment updates are disabled. Record received payments during patient booking." },
    { status: 405, headers: { Allow: "GET, POST" } }
  );
  /* Legacy balance-update implementation retained below only for historical
     migration context; it is unreachable and cannot create pending dues.
  try {
    const body = await req.json();
    const { id, paymentAmount, paymentMethod, paymentReference, receivedBy, notes } = body;

    if (!id || paymentAmount === undefined) {
      return NextResponse.json(
        { success: false, error: "Invoice ID and payment amount are required." },
        { status: 400 }
      );
    }

    const existing = await prisma.invoice.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ success: false, error: "Invoice not found" }, { status: 404 });
    }

    const amount = Number(paymentAmount);
    if (!Number.isFinite(amount) || amount <= 0 || roundRupees(amount) <= 0 || amount > existing.balanceDue || (paymentMethod && !PAYMENT_METHODS.includes(paymentMethod))) {
      return NextResponse.json({ success: false, error: "Enter a positive payment within the outstanding PKR balance and select a valid payment channel." }, { status: 400 });
    }
    const newPaidAmount = roundRupees(existing.paidAmount + amount);
    const newBalanceDue = roundRupees(Math.max(0, existing.totalAmount - newPaidAmount));
    const newStatus = newBalanceDue <= 0 ? "PAID" : "UNPAID";

    const receivedAt = new Date();
    let updated;
    try {
      updated = await prisma.$transaction(async transaction => {
        const changed = await transaction.invoice.updateMany({
          where: { id, paidAmount: existing.paidAmount, balanceDue: existing.balanceDue },
          data: {
            paidAmount: newPaidAmount,
            balanceDue: newBalanceDue,
            status: newStatus,
            paymentMethod: paymentMethod || existing.paymentMethod,
            paidAt: newStatus === "PAID" ? receivedAt : existing.paidAt,
          },
        });
        if (changed.count !== 1) throw new Error("PAYMENT_BALANCE_CHANGED");

        await transaction.payment.create({
          data: {
            invoiceId: id,
            amount: roundRupees(amount),
            method: paymentMethod || existing.paymentMethod || "Cash",
            reference: String(paymentReference || "").trim() || null,
            receivedBy: String(receivedBy || "").trim() || null,
            notes: String(notes || "").trim() || null,
            receivedAt,
          },
        });

        await transaction.auditLog.create({
          data: {
            userName: String(receivedBy || "Billing Desk"),
            userRole: "BILLING_OFFICER",
            action: "UPDATE",
            resource: "INVOICE",
            resourceId: id,
            details: `Payment PKR ${amount.toFixed(2)} received via ${paymentMethod || existing.paymentMethod || "Cash"} for Invoice #${existing.invoiceNumber}. Balance: PKR ${newBalanceDue.toFixed(2)}`,
          },
        });

        return transaction.invoice.findUniqueOrThrow({
          where: { id },
          include: {
            patient: true,
            items: true,
            payments: { orderBy: { receivedAt: "desc" } },
          },
        });
      });
    } catch (error) {
      if (error instanceof Error && error.message === "PAYMENT_BALANCE_CHANGED") {
        return NextResponse.json({ success: false, error: "The balance changed. Refresh and try again." }, { status: 409 });
      }
      throw error;
    }

    return NextResponse.json({ success: true, invoice: updated });
  } catch (error) {
    console.error("Record payment error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to record payment" },
      { status: 500 }
    );
  }
  */
}
