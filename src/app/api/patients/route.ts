import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search")?.trim() || "";

    const where = search
      ? {
          OR: [
            { mrn: { contains: search } },
            { firstName: { contains: search } },
            { lastName: { contains: search } },
            { phone: { contains: search } },
            { nationalId: { contains: search } },
          ],
        }
      : {};

    const patients = await prisma.patient.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        appointments: {
          take: 1,
          orderBy: { scheduledAt: "desc" },
        },
        vitals: {
          take: 1,
          orderBy: { recordedAt: "desc" },
        },
      },
    });

    return NextResponse.json({ success: true, patients });
  } catch (error) {
    console.error("Fetch patients error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch patients" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      firstName,
      lastName,
      gender,
      dateOfBirth,
      bloodGroup,
      phone,
      email,
      nationalId,
      address,
      emergencyContactName,
      emergencyContactPhone,
      emergencyContactRelation,
      allergies,
      chronicConditions,
      registeredBy,
    } = body;

    if (!firstName || !lastName || !gender || !dateOfBirth || !phone) {
      return NextResponse.json(
        { success: false, error: "Missing required patient registration fields." },
        { status: 400 }
      );
    }

    // Generate unique MRN: CIMS-YYYY-XXXX
    const currentYear = new Date().getFullYear();
    const count = await prisma.patient.count();
    const mrn = `CIMS-${currentYear}-${String(count + 1).padStart(4, "0")}`;

    const newPatient = await prisma.patient.create({
      data: {
        mrn,
        firstName,
        lastName,
        gender,
        dateOfBirth: new Date(dateOfBirth),
        bloodGroup: bloodGroup || null,
        phone,
        email: email || null,
        nationalId: nationalId || null,
        address: address || null,
        emergencyContactName: emergencyContactName || null,
        emergencyContactPhone: emergencyContactPhone || null,
        emergencyContactRelation: emergencyContactRelation || null,
        allergies: allergies ? JSON.stringify(allergies) : null,
        chronicConditions: chronicConditions ? JSON.stringify(chronicConditions) : null,
      },
    });

    // Record Audit Log
    await prisma.auditLog.create({
      data: {
        userName: registeredBy || "Front Desk",
        userRole: "RECEPTIONIST",
        action: "CREATE",
        resource: "PATIENT",
        resourceId: newPatient.id,
        details: `Registered new patient: ${firstName} ${lastName} (${mrn})`,
      },
    });

    return NextResponse.json({ success: true, patient: newPatient }, { status: 201 });
  } catch (error) {
    console.error("Register patient error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to register patient" },
      { status: 500 }
    );
  }
}
