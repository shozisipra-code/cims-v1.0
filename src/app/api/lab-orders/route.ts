import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");

    const where: any = {};
    if (status) where.status = status;

    const labOrders = await prisma.labOrder.findMany({
      where,
      orderBy: { orderedAt: "desc" },
      include: {
        patient: true,
        doctor: true,
        items: true,
        encounter: true,
      },
    });

    return NextResponse.json({ success: true, labOrders });
  } catch (error) {
    console.error("Fetch lab orders error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch lab orders" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { encounterId, patientId, doctorId, tests, priority, technicianNotes } = body;

    if (!patientId || !doctorId || !tests || !tests.length) {
      return NextResponse.json(
        { success: false, error: "Patient ID, Doctor ID, and at least one test are required." },
        { status: 400 }
      );
    }

    const count = await prisma.labOrder.count();
    const currentYear = new Date().getFullYear();
    const orderNumber = `LAB-${currentYear}-${String(count + 1).padStart(4, "0")}`;

    const labOrder = await prisma.labOrder.create({
      data: {
        orderNumber,
        encounterId: encounterId || null,
        patientId,
        doctorId,
        priority: priority || "ROUTINE",
        status: "ORDERED",
        technicianNotes: technicianNotes || null,
        items: {
          create: tests.map((t: any) => ({
            testName: t.testName,
            category: t.category || "General",
            referenceRange: t.referenceRange || null,
            status: "PENDING",
          })),
        },
      },
      include: {
        items: true,
        patient: true,
        doctor: true,
      },
    });

    await prisma.auditLog.create({
      data: {
        action: "CREATE",
        resource: "LAB_ORDER",
        resourceId: labOrder.id,
        details: `Lab order #${orderNumber} created with ${tests.length} tests for ${labOrder.patient.firstName} ${labOrder.patient.lastName}`,
      },
    });

    return NextResponse.json({ success: true, labOrder }, { status: 201 });
  } catch (error) {
    console.error("Create lab order error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to create lab order" },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { orderId, itemsResults, status } = body;

    if (!orderId) {
      return NextResponse.json(
        { success: false, error: "Order ID is required." },
        { status: 400 }
      );
    }

    // Update item results if provided
    if (itemsResults && Array.isArray(itemsResults)) {
      for (const item of itemsResults) {
        await prisma.labOrderItem.update({
          where: { id: item.id },
          data: {
            resultValue: item.resultValue,
            unit: item.unit,
            referenceRange: item.referenceRange,
            isAbnormal: item.isAbnormal ?? false,
            notes: item.notes,
            status: "COMPLETED",
          },
        });
      }
    }

    const updatedOrder = await prisma.labOrder.update({
      where: { id: orderId },
      data: {
        status: status || "COMPLETED",
        completedAt: status === "COMPLETED" ? new Date() : undefined,
      },
      include: {
        items: true,
        patient: true,
      },
    });

    await prisma.auditLog.create({
      data: {
        action: "UPDATE",
        resource: "LAB_ORDER",
        resourceId: orderId,
        details: `Lab order #${updatedOrder.orderNumber} results entered / verified`,
      },
    });

    return NextResponse.json({ success: true, labOrder: updatedOrder });
  } catch (error) {
    console.error("Update lab order error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update lab order results" },
      { status: 500 }
    );
  }
}
