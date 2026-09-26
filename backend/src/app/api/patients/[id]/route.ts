import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { authorizationErrorResponse, requireActor } from "@/lib/auth";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireActor(req, { anyOf: ["patients", "clinical", "booking", "appointments", "billing", "payments"] });
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
          include: { items: true, payments: { orderBy: { receivedAt: "desc" } } },
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
    const authorizationResponse = authorizationErrorResponse(error);
    if (authorizationResponse) return authorizationResponse;
    console.error("Get patient 360 error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to retrieve patient records" },
      { status: 500 }
    );
  }
}
