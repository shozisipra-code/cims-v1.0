import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

export async function GET() {
  try {
    const [auditLogs, users, totalEncounters, totalPrescriptions, totalLabOrders] =
      await Promise.all([
        prisma.auditLog.findMany({
          orderBy: { timestamp: "desc" },
          take: 50,
          include: { user: true },
        }),
        prisma.user.findMany({
          orderBy: { role: "asc" },
        }),
        prisma.encounter.count(),
        prisma.prescription.count(),
        prisma.labOrder.count(),
      ]);

    return NextResponse.json({
      success: true,
      auditLogs,
      users,
      metrics: {
        totalEncounters,
        totalPrescriptions,
        totalLabOrders,
      },
    });
  } catch (error) {
    console.error("Fetch audit logs error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch audit logs" },
      { status: 500 }
    );
  }
}
