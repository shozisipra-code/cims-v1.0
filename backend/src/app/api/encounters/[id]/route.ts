import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { authorizationErrorResponse, requireActor } from "@/lib/auth";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireActor(req, { anyOf: ["patients", "clinical", "appointments", "billing", "payments"] });
    const { id } = await params;

    const encounter = await prisma.encounter.findUnique({
      where: { id },
      include: {
        patient: {
          include: {
            vitals: {
              orderBy: { recordedAt: "desc" },
            },
          },
        },
        doctor: true,
        appointment: true,
        diagnoses: true,
        prescriptions: {
          include: { items: true },
        },
        labOrders: {
          include: { items: true },
        },
        invoices: {
          include: { items: true },
        },
      },
    });

    if (!encounter) {
      return NextResponse.json(
        { success: false, error: "Encounter not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, encounter });
  } catch (error) {
    const authorization = authorizationErrorResponse(error);
    if (authorization) return authorization;
    console.error("Get encounter error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch encounter details" },
      { status: 500 }
    );
  }
}
