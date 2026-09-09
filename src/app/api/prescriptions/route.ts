import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");

    const where: any = {};
    if (status) where.status = status;

    const prescriptions = await prisma.prescription.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        patient: true,
        doctor: true,
        items: true,
        encounter: true,
      },
    });

    return NextResponse.json({ success: true, prescriptions });
  } catch (error) {
    console.error("Fetch prescriptions error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch prescriptions" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { encounterId, patientId, doctorId, items, notes } = body;

    if (!encounterId || !patientId || !doctorId || !items || !items.length) {
      return NextResponse.json(
        { success: false, error: "Prescription requires patient, doctor, and at least one medication item." },
        { status: 400 }
      );
    }

    const prescription = await prisma.prescription.create({
      data: {
        encounterId,
        patientId,
        doctorId,
        notes: notes || null,
        status: "PENDING",
        items: {
          create: items.map((item: any) => ({
            medicationName: item.medicationName,
            genericName: item.genericName || null,
            dosage: item.dosage || "As directed",
            route: item.route || "Oral",
            frequency: item.frequency || "TDS",
            duration: item.duration || "5 days",
            quantity: item.quantity ? parseInt(item.quantity) : 1,
            instructions: item.instructions || null,
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
        resource: "PRESCRIPTION",
        resourceId: prescription.id,
        details: `Prescription created with ${items.length} items for ${prescription.patient.firstName} ${prescription.patient.lastName}`,
      },
    });

    return NextResponse.json({ success: true, prescription }, { status: 201 });
  } catch (error) {
    console.error("Create prescription error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to create prescription" },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, dispensedBy } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: "Prescription ID is required." },
        { status: 400 }
      );
    }

    // Mark all items as dispensed & reduce inventory where matching
    const prescription = await prisma.prescription.findUnique({
      where: { id },
      include: { items: true, patient: true },
    });

    if (!prescription) {
      return NextResponse.json(
        { success: false, error: "Prescription not found" },
        { status: 404 }
      );
    }

    // Update prescription status
    const updated = await prisma.prescription.update({
      where: { id },
      data: {
        status: "DISPENSED",
        dispensedAt: new Date(),
        dispensedBy: dispensedBy || "Pharmacist",
      },
      include: { items: true },
    });

    // Mark items as dispensed
    await prisma.prescriptionItem.updateMany({
      where: { prescriptionId: id },
      data: { isDispensed: true },
    });

    // Attempt to decrement medication inventory if found
    for (const item of prescription.items) {
      const med = await prisma.medication.findFirst({
        where: {
          brandName: { contains: item.medicationName.split(" ")[0] },
        },
      });
      if (med && med.stockQuantity >= item.quantity) {
        await prisma.medication.update({
          where: { id: med.id },
          data: { stockQuantity: med.stockQuantity - item.quantity },
        });
      }
    }

    await prisma.auditLog.create({
      data: {
        action: "DISPENSE",
        resource: "PRESCRIPTION",
        resourceId: id,
        details: `Dispensed medication for ${prescription.patient.firstName} ${prescription.patient.lastName}`,
      },
    });

    return NextResponse.json({ success: true, prescription: updated });
  } catch (error) {
    console.error("Dispense prescription error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to dispense prescription" },
      { status: 500 }
    );
  }
}
