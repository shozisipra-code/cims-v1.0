import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

export async function GET(req: NextRequest) {
  try {
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
        encounter: {
          include: { doctor: true },
        },
      },
    });

    return NextResponse.json({ success: true, invoices });
  } catch (error) {
    console.error("Fetch invoices error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch invoices" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { patientId, encounterId, items, discount, tax, paymentMethod, notes } = body;

    if (!patientId || !items || !items.length) {
      return NextResponse.json(
        { success: false, error: "Patient ID and at least one billable item are required." },
        { status: 400 }
      );
    }

    const count = await prisma.invoice.count();
    const currentYear = new Date().getFullYear();
    const invoiceNumber = `INV-${currentYear}-${String(count + 1).padStart(4, "0")}`;

    const subtotal = items.reduce(
      (acc: number, item: any) => acc + (parseFloat(item.totalPrice) || 0),
      0
    );
    const discountVal = parseFloat(discount) || 0;
    const taxVal = parseFloat(tax) || 0;
    const totalAmount = Math.max(0, subtotal - discountVal + taxVal);

    const invoice = await prisma.invoice.create({
      data: {
        invoiceNumber,
        patientId,
        encounterId: encounterId || null,
        subtotal,
        discount: discountVal,
        tax: taxVal,
        totalAmount,
        paidAmount: 0.0,
        balanceDue: totalAmount,
        status: "UNPAID",
        paymentMethod: paymentMethod || "Cash",
        notes: notes || null,
        items: {
          create: items.map((i: any) => ({
            description: i.description,
            category: i.category || "SERVICE",
            quantity: i.quantity ? parseInt(i.quantity) : 1,
            unitPrice: parseFloat(i.unitPrice) || 0,
            totalPrice: parseFloat(i.totalPrice) || 0,
          })),
        },
      },
      include: {
        items: true,
        patient: true,
      },
    });

    await prisma.auditLog.create({
      data: {
        action: "CREATE",
        resource: "INVOICE",
        resourceId: invoice.id,
        details: `Invoice #${invoiceNumber} issued for $${totalAmount.toFixed(2)} to ${invoice.patient.firstName} ${invoice.patient.lastName}`,
      },
    });

    return NextResponse.json({ success: true, invoice }, { status: 201 });
  } catch (error) {
    console.error("Create invoice error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to create invoice" },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, paymentAmount, paymentMethod } = body;

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

    const newPaidAmount = existing.paidAmount + parseFloat(paymentAmount);
    const newBalanceDue = Math.max(0, existing.totalAmount - newPaidAmount);
    const newStatus = newBalanceDue <= 0 ? "PAID" : "PARTIALLY_PAID";

    const updated = await prisma.invoice.update({
      where: { id },
      data: {
        paidAmount: newPaidAmount,
        balanceDue: newBalanceDue,
        status: newStatus,
        paymentMethod: paymentMethod || existing.paymentMethod,
        paidAt: newStatus === "PAID" ? new Date() : existing.paidAt,
      },
      include: {
        patient: true,
        items: true,
      },
    });

    await prisma.auditLog.create({
      data: {
        action: "UPDATE",
        resource: "INVOICE",
        resourceId: id,
        details: `Collected payment of $${parseFloat(paymentAmount).toFixed(2)} for Invoice #${updated.invoiceNumber}. Status: ${newStatus}`,
      },
    });

    return NextResponse.json({ success: true, invoice: updated });
  } catch (error) {
    console.error("Record payment error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to record payment" },
      { status: 500 }
    );
  }
}
