import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const patient = await prisma.patient.findUnique({
      where: { id },
      include: {
        appointments: {
          orderBy: { scheduledAt: "desc" },
          include: { doctor: true },
        },
        vitals: {
          orderBy: { recordedAt: "desc" },
        },
        encounters: {
          orderBy: { encounterDate: "desc" },
          include: {
            doctor: true,
            diagnoses: true,
            prescriptions: {
              include: { items: true },
            },
            labOrders: {
              include: { items: true },
            },
          },
        },
        prescriptions: {
          orderBy: { createdAt: "desc" },
          include: {
            doctor: true,
            items: true,
          },
        },
        labOrders: {
          orderBy: { orderedAt: "desc" },
          include: {
            doctor: true,
            items: true,
          },
        },
        invoices: {
          orderBy: { createdAt: "desc" },
          include: { items: true },
        },
      },
    });

    if (!patient) {
      return NextResponse.json(
        { success: false, error: "Patient not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, patient });
  } catch (error) {
    console.error("Get patient 360 error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to retrieve patient records" },
      { status: 500 }
    );
  }
}
