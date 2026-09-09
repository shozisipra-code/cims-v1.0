import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const doctorId = searchParams.get("doctorId");

    const where: any = {};
    if (status) where.status = status;
    if (doctorId) where.doctorId = doctorId;

    const appointments = await prisma.appointment.findMany({
      where,
      orderBy: [
        { status: "asc" },
        { tokenNumber: "asc" },
        { scheduledAt: "asc" },
      ],
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
        encounter: true,
      },
    });

    return NextResponse.json({ success: true, appointments });
  } catch (error) {
    console.error("Fetch appointments error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch appointments" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { patientId, doctorId, department, scheduledAt, reason, type } = body;

    if (!patientId || !doctorId) {
      return NextResponse.json(
        { success: false, error: "Patient and Doctor are required." },
        { status: 400 }
      );
    }

    // Auto-compute token number for today
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const todaysTokens = await prisma.appointment.count({
      where: {
        scheduledAt: { gte: startOfDay },
      },
    });

    const appointment = await prisma.appointment.create({
      data: {
        patientId,
        doctorId,
        department: department || "General Medicine",
        scheduledAt: scheduledAt ? new Date(scheduledAt) : new Date(),
        tokenNumber: todaysTokens + 1,
        status: "WAITING",
        reason: reason || "Routine Consultation",
        type: type || "OPD",
      },
      include: {
        patient: true,
        doctor: true,
      },
    });

    await prisma.auditLog.create({
      data: {
        action: "CREATE",
        resource: "APPOINTMENT",
        resourceId: appointment.id,
        details: `Token #${appointment.tokenNumber} issued to ${appointment.patient.firstName} ${appointment.patient.lastName}`,
      },
    });

    return NextResponse.json({ success: true, appointment }, { status: 201 });
  } catch (error) {
    console.error("Create appointment error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to schedule appointment" },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, status } = body;

    if (!id || !status) {
      return NextResponse.json(
        { success: false, error: "Appointment ID and status are required." },
        { status: 400 }
      );
    }

    const updated = await prisma.appointment.update({
      where: { id },
      data: { status },
      include: {
        patient: true,
        doctor: true,
      },
    });

    return NextResponse.json({ success: true, appointment: updated });
  } catch (error) {
    console.error("Update appointment error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update appointment status" },
      { status: 500 }
    );
  }
}
