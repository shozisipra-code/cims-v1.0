import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { pakistanDayBounds, pakistanDateKey } from "@/lib/pakistan";
import { authorizationErrorResponse, requireActor } from "@/lib/auth";

export async function GET(req: NextRequest) {
  try {
    await requireActor(req, { anyOf: ["daily_statement", "billing", "payments"] });
    const date = new URL(req.url).searchParams.get("date") || pakistanDateKey();
    const { start, end } = pakistanDayBounds(date);
    const range = { gte: start, lt: end };
    const [patients, appointments, invoices, payments] = await Promise.all([
      prisma.patient.findMany({ where: { createdAt: range }, orderBy: { createdAt: "asc" } }),
      prisma.appointment.findMany({ where: { scheduledAt: range }, orderBy: { scheduledAt: "asc" }, include: { patient: true, doctor: true } }),
      prisma.invoice.findMany({ where: { issuedAt: range }, orderBy: { issuedAt: "asc" }, include: { patient: true, items: true, encounter: { include: { doctor: true } } } }),
      prisma.payment.findMany({ where: { receivedAt: range }, orderBy: { receivedAt: "asc" }, include: { invoice: { include: { patient: true } } } }),
    ]);
    const billed = invoices.reduce((sum, item) => sum + item.totalAmount, 0);
    const collected = payments.reduce((sum, item) => sum + item.amount, 0);
    const newInvoiceCollections = payments.filter(item => item.invoice.issuedAt >= start && item.invoice.issuedAt < end).reduce((sum, item) => sum + item.amount, 0);
    const duesRecovered = collected - newInvoiceCollections;
    const outstanding = invoices.reduce((sum, item) => sum + item.balanceDue, 0);
    return NextResponse.json({ success: true, statement: { date, patients, appointments, invoices, payments, summary: { newPatients: patients.length, appointments: appointments.length, billed, collected, newInvoiceCollections, duesRecovered, outstanding } } });
  } catch (error) {
    const authorizationResponse = authorizationErrorResponse(error);
    if (authorizationResponse) return authorizationResponse;
    console.error("Daily statement error:", error);
    return NextResponse.json({ success: false, error: "Failed to load the daily clinic statement." }, { status: 500 });
  }
}
