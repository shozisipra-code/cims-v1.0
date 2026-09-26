import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { normalizeCnic, normalizePakistanPhone, pakistanDateKey } from "@/lib/pakistan";
import { authorizationErrorResponse, requestIp, requireActor } from "@/lib/auth";

const patientTitles = ["MR", "MRS", "MISS"];
const ageUnits = ["YEARS", "MONTHS", "DAYS"];
const toNameCase = (value: string) => value.trim().replace(/\s+/g, " ").split(" ").map(part => part ? part.charAt(0).toUpperCase() + part.slice(1).toLowerCase() : "").join(" ");
function birthDateFromAge(value: number, unit: string) {
  const [year, month, day] = pakistanDateKey().split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day, 12));
  if (unit === "YEARS") date.setUTCFullYear(date.getUTCFullYear() - value);
  if (unit === "MONTHS") date.setUTCMonth(date.getUTCMonth() - value);
  if (unit === "DAYS") date.setUTCDate(date.getUTCDate() - value);
  return date;
}

export async function GET(req: NextRequest) {
  try {
    await requireActor(req, { anyOf: ["booking", "appointments", "patient_calling", "patients", "clinical"] });
    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search")?.trim() || "";
    const mrn = searchParams.get("mrn")?.trim() || "";
    const name = searchParams.get("name")?.trim() || "";
    const phoneDigits = searchParams.get("phone")?.replace(/\D/g, "") || "";
    const phone = phoneDigits.startsWith("92") ? phoneDigits.slice(2) : phoneDigits.startsWith("0") ? phoneDigits.slice(1) : phoneDigits;
    const rawNationalId = searchParams.get("nationalId")?.trim() || "";
    const nationalId = rawNationalId ? normalizeCnic(rawNationalId) || rawNationalId : "";
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const fromDate = from ? new Date(`${from}T00:00:00.000`) : null;
    const toDate = to ? new Date(`${to}T23:59:59.999`) : null;
    const hasDateRange = (fromDate && !Number.isNaN(fromDate.getTime())) || (toDate && !Number.isNaN(toDate.getTime()));

    const where: any = {
      AND: [
        search ? { OR: [
          { mrn: { contains: search } },
          { firstName: { contains: search } },
          { lastName: { contains: search } },
          { fatherHusbandName: { contains: search } },
          { phone: { contains: search } },
          { nationalId: { contains: search } },
        ] } : {},
        mrn ? { mrn: { contains: mrn } } : {},
        name ? { AND: name.split(/\s+/).filter(Boolean).map(term => ({ OR: [{ firstName: { contains: term } }, { lastName: { contains: term } }, { fatherHusbandName: { contains: term } }] })) } : {},
        phone ? { phone: { contains: phone } } : {},
        nationalId ? { nationalId: { contains: nationalId } } : {},
        hasDateRange ? { appointments: { some: { scheduledAt: {
          ...(fromDate && !Number.isNaN(fromDate.getTime()) ? { gte: fromDate } : {}),
          ...(toDate && !Number.isNaN(toDate.getTime()) ? { lte: toDate } : {}),
        } } } } : {},
      ],
    };

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
        invoices: {
          select: { id: true, totalAmount: true, paidAmount: true, balanceDue: true, status: true },
        },
        _count: {
          select: { appointments: true, encounters: true, labOrders: true, prescriptions: true, invoices: true },
        },
      },
    });

    return NextResponse.json({ success: true, patients });
  } catch (error) {
    const authorization = authorizationErrorResponse(error);
    if (authorization) return authorization;
    console.error("Fetch patients error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch patients" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const actor = await requireActor(req, { allOf: ["booking"] });
    const body = await req.json();
    const {
      firstName,
      lastName,
      name,
      title,
      fatherHusbandName,
      gender,
      dateOfBirth,
      ageValue,
      ageUnit,
      bloodGroup,
      phone,
      email,
      nationalId,
      address,
      emergencyContactName,
      emergencyContactPhone,
      emergencyContactRelation,
      chronicConditions,
    } = body;

    const formattedName = toNameCase(String(name || [firstName, lastName].filter(Boolean).join(" ")));
    const formattedFatherHusbandName = fatherHusbandName ? toNameCase(String(fatherHusbandName)) : "";
    const [formattedFirstName = "", ...formattedRemainingNames] = formattedName.split(" ");
    const formattedLastName = formattedRemainingNames.join(" ");
    const normalizedTitle = String(title || "").toUpperCase();
    const normalizedAgeUnit = String(ageUnit || "").toUpperCase();
    const numericAge = ageValue === "" || ageValue === null || ageValue === undefined ? null : Number(ageValue);
    const hasAge = numericAge !== null && Number.isInteger(numericAge) && numericAge >= 0 && ageUnits.includes(normalizedAgeUnit);

    if (!formattedName || !formattedFatherHusbandName || !gender || (!dateOfBirth && !hasAge) || !phone) {
      return NextResponse.json(
        { success: false, error: "Patient name, father / husband name, age, gender and WhatsApp number are required." },
        { status: 400 }
      );
    }
    if (normalizedTitle && !patientTitles.includes(normalizedTitle)) return NextResponse.json({ success: false, error: "Select a valid patient title." }, { status: 400 });
    if (numericAge !== null && (!Number.isInteger(numericAge) || numericAge < 0 || !ageUnits.includes(normalizedAgeUnit))) return NextResponse.json({ success: false, error: "Enter a valid age and select Years, Months or Days." }, { status: 400 });

    const phoneDigits = typeof phone === "string" ? phone.replace(/\D/g, "") : "";
    const emergencyPhoneDigits = typeof emergencyContactPhone === "string" ? emergencyContactPhone.replace(/\D/g, "") : "";
    const nationalIdDigits = typeof nationalId === "string" ? nationalId.replace(/\D/g, "") : "";
    if (phoneDigits.length > 11 || emergencyPhoneDigits.length > 11) {
      return NextResponse.json({ success: false, error: "WhatsApp and contact numbers cannot exceed 11 digits." }, { status: 400 });
    }
    if (nationalIdDigits.length > 13) {
      return NextResponse.json({ success: false, error: "CNIC / B-form cannot exceed 13 digits." }, { status: 400 });
    }
    const normalizedPhone = typeof phone === "string" ? normalizePakistanPhone(phone) : null;
    const normalizedEmergencyPhone = typeof emergencyContactPhone === "string" && emergencyContactPhone.trim() ? normalizePakistanPhone(emergencyContactPhone) : null;
    const normalizedId = typeof nationalId === "string" && nationalId.trim() ? normalizeCnic(nationalId) : null;
    if (!normalizedPhone || (emergencyContactPhone && !normalizedEmergencyPhone)) {
      return NextResponse.json({ success: false, error: "Enter a valid Pakistan phone number containing no more than 11 digits, e.g. 03001234567." }, { status: 400 });
    }
    if (nationalId && !normalizedId) {
      return NextResponse.json({ success: false, error: "CNIC / B-form must contain 13 digits, or leave it blank." }, { status: 400 });
    }
    const dob = hasAge ? birthDateFromAge(numericAge!, normalizedAgeUnit) : new Date(dateOfBirth);
    if (Number.isNaN(dob.getTime()) || dob.toISOString().slice(0, 10) > pakistanDateKey()) {
      return NextResponse.json({ success: false, error: "Enter a valid date of birth that is not in the future." }, { status: 400 });
    }
    // Generate unique MRN: CIMS-YYYY-XXXX
    const currentYear = new Date().getFullYear();
    const count = await prisma.patient.count();
    const mrn = `CIMS-${currentYear}-${String(count + 1).padStart(4, "0")}`;

    const newPatient = await prisma.patient.create({
      data: {
        mrn,
        title: normalizedTitle || null,
        firstName: formattedFirstName,
        lastName: formattedLastName,
        fatherHusbandName: formattedFatherHusbandName || null,
        gender,
        dateOfBirth: dob,
        ageValue: hasAge ? numericAge : null,
        ageUnit: hasAge ? normalizedAgeUnit : null,
        bloodGroup: bloodGroup || null,
        phone: normalizedPhone,
        email: email || null,
        nationalId: normalizedId,
        address: address || null,
        emergencyContactName: emergencyContactName || null,
        emergencyContactPhone: normalizedEmergencyPhone,
        emergencyContactRelation: emergencyContactRelation || null,
        chronicConditions: chronicConditions ? JSON.stringify(chronicConditions) : null,
      },
    });

    // Record Audit Log
    await prisma.auditLog.create({
      data: {
        userId: actor.id,
        userName: actor.name,
        userRole: actor.role,
        action: "CREATE",
        resource: "PATIENT",
        resourceId: newPatient.id,
        details: `Registered new patient: ${formattedName} (${mrn})`,
        ipAddress: requestIp(req),
      },
    });

    return NextResponse.json({ success: true, patient: newPatient }, { status: 201 });
  } catch (error) {
    const authorization = authorizationErrorResponse(error);
    if (authorization) return authorization;
    console.error("Register patient error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to register patient" },
      { status: 500 }
    );
  }
}
