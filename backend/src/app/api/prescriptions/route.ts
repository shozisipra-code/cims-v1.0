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
        patient: { select: { id: true, mrn: true, firstName: true, lastName: true, dateOfBirth: true } },
        doctor: { select: { id: true, name: true, department: true, licenseNumber: true } },
        items: true,
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

export async function POST() {
  return NextResponse.json({ success: false, error: "Add medicines in the patient's active consultation. Prescriptions are issued when the visit is finished." }, { status: 409 });
}
