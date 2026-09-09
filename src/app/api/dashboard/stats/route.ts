import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

export async function GET() {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [
      totalPatients,
      todayAppointments,
      waitingQueue,
      inConsultation,
      pendingPrescriptions,
      pendingLabOrders,
      totalInvoices,
      recentAuditLogs,
    ] = await Promise.all([
      prisma.patient.count(),
      prisma.appointment.count({
        where: { scheduledAt: { gte: today } },
      }),
      prisma.appointment.count({
        where: { status: "WAITING" },
      }),
      prisma.appointment.count({
        where: { status: "IN_CONSULTATION" },
      }),
      prisma.prescription.count({
        where: { status: "PENDING" },
      }),
      prisma.labOrder.count({
        where: { status: { in: ["ORDERED", "SAMPLE_COLLECTED", "ANALYZING"] } },
      }),
      prisma.invoice.aggregate({
        _sum: {
          totalAmount: true,
          paidAmount: true,
          balanceDue: true,
        },
      }),
      prisma.auditLog.findMany({
        take: 6,
        orderBy: { timestamp: "desc" },
      }),
    ]);

    return NextResponse.json({
      success: true,
      stats: {
        totalPatients,
        todayAppointments,
        waitingQueue,
        inConsultation,
        pendingPrescriptions,
        pendingLabOrders,
        financials: {
          totalBilled: totalInvoices._sum.totalAmount || 0,
          totalCollected: totalInvoices._sum.paidAmount || 0,
          outstandingBalance: totalInvoices._sum.balanceDue || 0,
        },
      },
      recentAuditLogs,
    });
  } catch (error) {
    console.error("Dashboard stats error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to load dashboard metrics" },
      { status: 500 }
    );
  }
}
