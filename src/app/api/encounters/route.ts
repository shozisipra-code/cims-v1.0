import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const doctorId = searchParams.get("doctorId");
    const status = searchParams.get("status");

    const where: any = {};
    if (doctorId) where.doctorId = doctorId;
    if (status) where.status = status;

    const encounters = await prisma.encounter.findMany({
      where,
      orderBy: { encounterDate: "desc" },
      include: {
        patient: {
          include: {
            vitals: {
              take: 1,
              orderBy: { recordedAt: "desc" },
            },
          },
        },
        doctor: true,
        diagnoses: true,
        prescriptions: {
          include: { items: true },
        },
        labOrders: {
          include: { items: true },
        },
      },
    });

    return NextResponse.json({ success: true, encounters });
  } catch (error) {
    console.error("Fetch encounters error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch encounters" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { patientId, doctorId, appointmentId, chiefComplaint, hpi } = body;

    if (!patientId || !doctorId) {
      return NextResponse.json(
        { success: false, error: "Patient ID and Doctor ID are required." },
        { status: 400 }
      );
    }

    const encounter = await prisma.encounter.create({
      data: {
        patientId,
        doctorId,
        appointmentId: appointmentId || null,
        status: "IN_PROGRESS",
        chiefComplaint: chiefComplaint || null,
        hpi: hpi || null,
      },
      include: {
        patient: true,
        doctor: true,
      },
    });

    if (appointmentId) {
      await prisma.appointment.update({
        where: { id: appointmentId },
        data: { status: "IN_CONSULTATION" },
      });
    }

    await prisma.auditLog.create({
      data: {
        action: "CREATE",
        resource: "ENCOUNTER",
        resourceId: encounter.id,
        details: `Encounter opened for patient ${encounter.patient.firstName} ${encounter.patient.lastName}`,
      },
    });

    return NextResponse.json({ success: true, encounter }, { status: 201 });
  } catch (error) {
    console.error("Create encounter error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to initiate encounter" },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      id,
      chiefComplaint,
      hpi,
      physicalExam,
      assessmentPlan,
      clinicalNotes,
      status,
      followUpDate,
    } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: "Encounter ID is required." },
        { status: 400 }
      );
    }

    const encounter = await prisma.encounter.update({
      where: { id },
      data: {
        chiefComplaint,
        hpi,
        physicalExam,
        assessmentPlan,
        clinicalNotes,
        status: status || undefined,
        followUpDate: followUpDate ? new Date(followUpDate) : undefined,
      },
      include: {
        patient: true,
        doctor: true,
      },
    });

    if (status === "FINALIZED" && encounter.appointmentId) {
      await prisma.appointment.update({
        where: { id: encounter.appointmentId },
        data: { status: "COMPLETED" },
      });

      await prisma.auditLog.create({
        data: {
          action: "FINALIZE",
          resource: "ENCOUNTER",
          resourceId: encounter.id,
          details: `Encounter finalized by ${encounter.doctor.name} for ${encounter.patient.firstName} ${encounter.patient.lastName}`,
        },
      });
    }

    return NextResponse.json({ success: true, encounter });
  } catch (error) {
    console.error("Update encounter error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update encounter" },
      { status: 500 }
    );
  }
}
