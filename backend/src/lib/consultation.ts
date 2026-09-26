import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@cims/prisma-client";
import { prisma } from "./db/prisma";
import { parsePermissions } from "./permissions";

export class ConsultationError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}

export function consultationError(error: unknown) {
  if (error instanceof ConsultationError) return NextResponse.json({ success: false, error: error.message }, { status: error.status });
  console.error("Consultation error:", error);
  return NextResponse.json({ success: false, error: "Unable to save the consultation. Your changes have not been confirmed; please retry." }, { status: 500 });
}

export async function clinicalActor(req: NextRequest) {
  const id = req.headers.get("x-cims-user-id");
  const actor = id ? await prisma.user.findUnique({ where: { id } }) : null;
  if (!actor?.isActive || !parsePermissions(actor.permissions, actor.role).includes("clinical")) {
    throw new ConsultationError("A staff account with consultation permission is required.", 403);
  }
  return actor;
}

export const encounterInclude = {
  doctor: { select: { id: true, name: true } },
  appointment: true,
  vitals: { orderBy: { recordedAt: "desc" as const } },
  diagnoses: true,
  prescriptions: { include: { items: true } },
} satisfies Prisma.EncounterInclude;

export async function assertRoomAvailable(tx: Prisma.TransactionClient, appointmentId: string) {
  const target = await tx.appointment.findUnique({ where: { id: appointmentId }, select: { doctorId: true } });
  if (!target) throw new ConsultationError("Appointment not found.", 404);
  const active = await tx.appointment.findFirst({ where: { doctorId: target.doctorId, status: "IN_CONSULTATION", id: { not: appointmentId } } });
  if (active) throw new ConsultationError(`Finish the current consultation (token #${active.tokenNumber}) before calling another patient.`, 409);
}

const vitalRules = {
  systolicBP: [0, 400, true], diastolicBP: [0, 300, true], heartRate: [0, 400, true],
  temperature: [20, 50, false], respiratoryRate: [0, 150, true], spO2: [0, 100, true],
  weightKg: [0.1, 700, false], heightCm: [1, 300, false], bloodGlucose: [0, 2000, false], painScore: [0, 10, true],
} as const;

export function parseVitals(input: Record<string, unknown>) {
  const result: Record<string, number | null> = {};
  for (const [key, [min, max, integer]] of Object.entries(vitalRules)) {
    const raw = input[key];
    const value = raw === undefined || raw === null || raw === "" ? null : Number(raw);
    if (value !== null && ((typeof raw !== "string" && typeof raw !== "number") || !Number.isFinite(value) || value < min || value > max || (integer && !Number.isInteger(value)))) {
      throw new ConsultationError(`Enter a valid ${key} between ${min} and ${max}.`);
    }
    result[key] = value;
  }
  return {
    ...result,
    bmi: result.weightKg && result.heightCm ? Math.round(result.weightKg / (result.heightCm / 100) ** 2 * 10) / 10 : null,
    notes: cleanText(input.notes),
  };
}

export function cleanText(value: unknown) {
  if (value == null) return "";
  if (typeof value !== "string" || value.length > 20000) throw new ConsultationError("A text entry is invalid or too long.");
  return value.trim();
}

export function parseDraft(body: any, finalizing: boolean) {
  const notes = {
    chiefComplaint: cleanText(body.chiefComplaint), hpi: cleanText(body.hpi),
    physicalExam: cleanText(body.physicalExam), clinicalNotes: cleanText(body.clinicalNotes),
    assessmentPlan: cleanText(body.assessmentPlan),
  };
  if (finalizing && !notes.chiefComplaint) throw new ConsultationError("Enter the chief complaint before finishing the consultation.");
  const followUp = cleanText(body.followUpDate);
  const followUpDate = followUp ? new Date(`${followUp}T12:00:00+05:00`) : null;
  if (followUp && (!/^\d{4}-\d{2}-\d{2}$/.test(followUp) || Number.isNaN(followUpDate!.getTime()) || followUpDate!.toISOString().slice(0, 10) !== followUp)) throw new ConsultationError("Enter a valid follow-up date.");
  if (!Array.isArray(body.prescriptionItems) || body.prescriptionItems.length > 100) throw new ConsultationError("Invalid prescription items.");
  const prescriptionItems = body.prescriptionItems.map((item: any) => {
    const row = { medicationName: cleanText(item.medicationName), dosage: cleanText(item.dosage), frequency: cleanText(item.frequency), duration: cleanText(item.duration), instructions: cleanText(item.instructions), quantity: Number(item.quantity) };
    if (!Number.isInteger(row.quantity) || row.quantity < 1 || row.quantity > 10000) throw new ConsultationError("Medicine quantity must be a positive whole number.");
    if (finalizing && (!row.medicationName || !row.dosage || !row.frequency || !row.duration)) throw new ConsultationError("Complete the name, dosage, frequency and duration for each medicine, or remove the empty row.");
    return row;
  });
  return { notes, followUpDate, diagnosis: cleanText(body.diagnosis), prescriptionItems, vitals: parseVitals(body.vitals || {}) };
}
