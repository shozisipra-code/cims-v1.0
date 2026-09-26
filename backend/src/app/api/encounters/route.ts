import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { assertRoomAvailable, clinicalActor, consultationError, ConsultationError, encounterInclude, parseDraft } from "@/lib/consultation";

const comparableVitalFields = ["systolicBP", "diastolicBP", "heartRate", "temperature", "respiratoryRate", "spO2", "weightKg", "heightCm", "bmi", "bloodGlucose", "painScore", "notes"] as const;

function prescriptionSignature(items: any[]) {
  return JSON.stringify(items.map(item => ({
    medicationName: item.medicationName,
    dosage: item.dosage,
    frequency: item.frequency,
    duration: item.duration,
    quantity: item.quantity,
    instructions: item.instructions || "",
  })));
}

function finalizedPayloadMatches(existing: any, draft: ReturnType<typeof parseDraft>) {
  const textMatches = Object.entries(draft.notes).every(([key, value]) => (existing[key] || "") === value);
  const followUpMatches = existing.followUpDate
    ? draft.followUpDate?.getTime() === existing.followUpDate.getTime()
    : draft.followUpDate === null;
  const diagnosis = existing.diagnoses.map((item: any) => item.description).join("\n");
  const currentVitals = existing.vitals[0] || {};
  const submittedVitals = draft.vitals as Record<string, number | string | null>;
  const vitalsMatch = comparableVitalFields.every(key => (currentVitals[key] ?? (key === "notes" ? "" : null)) === submittedVitals[key]);
  const prescription = existing.prescriptions.find((item: any) => item.status === "PENDING") || existing.prescriptions[0];
  const prescriptionMatches = prescriptionSignature(prescription?.items || []) === prescriptionSignature(draft.prescriptionItems);
  return textMatches && followUpMatches && diagnosis === draft.diagnosis && vitalsMatch && prescriptionMatches;
}

export async function GET(req: NextRequest) {
  try {
    const actor = await clinicalActor(req);
    const { searchParams } = new URL(req.url);
    const doctorId = searchParams.get("doctorId");
    const status = searchParams.get("status");
    if (status && !["IN_PROGRESS", "FINALIZED"].includes(status)) throw new ConsultationError("Invalid encounter status.");
    const encounters = await prisma.encounter.findMany({
      where: { ...(actor.role === "ADMIN" || actor.role === "ENGINEER" ? (doctorId ? { doctorId } : {}) : { doctorId: actor.id }), ...(status ? { status: status as "IN_PROGRESS" | "FINALIZED" } : {}) },
      orderBy: { encounterDate: "desc" },
      include: { ...encounterInclude, patient: { include: { vitals: { take: 1, orderBy: { recordedAt: "desc" } } } } },
    });
    return NextResponse.json({ success: true, encounters });
  } catch (error) { return consultationError(error); }
}

// Opening a visit is idempotent: every appointment has exactly one encounter.
export async function POST(req: NextRequest) {
  try {
    const actor = await clinicalActor(req);
    const { patientId, appointmentId } = await req.json();
    if (!patientId) throw new ConsultationError("Select a patient to open a consultation.");
    const encounter = await prisma.$transaction(async tx => {
      const appointment = appointmentId
        ? await tx.appointment.findUnique({ where: { id: appointmentId } })
        : await tx.appointment.findFirst({
          where: { patientId, status: "IN_CONSULTATION" },
          orderBy: { scheduledAt: "desc" },
        });
      if (!appointment || appointment.patientId !== patientId) throw new ConsultationError("No active booking was found for this patient. Book a visit first.", 404);
      if (actor.role !== "ADMIN" && actor.role !== "ENGINEER" && appointment.doctorId !== actor.id) throw new ConsultationError("This patient is assigned to another doctor.", 403);
      const existing = await tx.encounter.findUnique({ where: { appointmentId: appointment.id }, include: encounterInclude });
      if (existing?.status === "FINALIZED") return existing;
      if (appointment.status !== "IN_CONSULTATION") throw new ConsultationError("Call the patient from Patient Calling before opening the consultation.", 409);
      await assertRoomAvailable(tx, appointment.id);
      if (existing) return existing;
      const created = await tx.encounter.create({
        data: { patientId, doctorId: appointment.doctorId, appointmentId: appointment.id, status: "IN_PROGRESS", chiefComplaint: appointment.reason || "" },
        include: encounterInclude,
      });
      await tx.auditLog.create({ data: { userId: actor.id, userName: actor.name, userRole: actor.role, action: "CREATE", resource: "ENCOUNTER", resourceId: created.id, details: `Consultation opened for token #${appointment.tokenNumber}` } });
      return created;
    });
    return NextResponse.json({ success: true, encounter });
  } catch (error) { return consultationError(error); }
}

// All entries and the queue transition commit together. Draft medicines aren't issued.
export async function PATCH(req: NextRequest) {
  try {
    const actor = await clinicalActor(req);
    const body = await req.json();
    if (!body.id || !Number.isInteger(body.revision) || !["IN_PROGRESS", "FINALIZED"].includes(body.status)) throw new ConsultationError("Encounter, revision and save status are required.");
    const finalizing = body.status === "FINALIZED";
    const draft = parseDraft(body, finalizing);
    const encounter = await prisma.$transaction(async tx => {
      const existing = await tx.encounter.findUnique({ where: { id: body.id }, include: encounterInclude });
      if (!existing) throw new ConsultationError("Consultation not found.", 404);
      if (actor.role !== "ADMIN" && actor.role !== "ENGINEER" && existing.doctorId !== actor.id) throw new ConsultationError("This consultation is assigned to another doctor.", 403);
      const correcting = existing.status === "FINALIZED";
      if (existing.status === "FINALIZED") {
        if (!finalizing) throw new ConsultationError("Completed consultations must remain finalized while corrections are saved.", 409);
        // Retried writes are idempotent only when every submitted clinical value
        // already matches the finalized record. A different stale payload must
        // report a conflict instead of being silently accepted.
        if ((existing.revision === body.revision || existing.revision === body.revision + 1) && finalizedPayloadMatches(existing, draft)) return existing;
      }
      if (!correcting && existing.appointment && existing.appointment.status !== "IN_CONSULTATION") throw new ConsultationError("This visit is no longer in consultation. Reopen it from the queue.", 409);
      const changed = await tx.encounter.updateMany({
        where: { id: existing.id, revision: body.revision, status: existing.status },
        data: { ...draft.notes, followUpDate: draft.followUpDate, draftData: finalizing ? null : JSON.stringify({ diagnosis: draft.diagnosis, prescriptionItems: draft.prescriptionItems }), status: correcting ? "FINALIZED" : body.status, revision: { increment: 1 } },
      });
      if (changed.count !== 1) throw new ConsultationError("This visit was updated in another window. Reload the visit before making more changes.", 409);
      const vitalData = { ...draft.vitals, patientId: existing.patientId, encounterId: existing.id, recordedBy: actor.name };
      const hasVitals = Object.entries(draft.vitals).some(([key, value]) => key !== "bmi" && value !== null && value !== "");
      if (existing.vitals[0]) await tx.vitals.update({ where: { id: existing.vitals[0].id }, data: vitalData });
      else if (hasVitals) await tx.vitals.create({ data: vitalData });
      if (finalizing) {
        await tx.diagnosis.deleteMany({ where: { encounterId: existing.id } });
        if (draft.diagnosis) await tx.diagnosis.create({ data: { encounterId: existing.id, description: draft.diagnosis, icdCode: "", type: "FINAL" } });
        let prescription: { id: string } | null = null;
        let correctedPrescriptionEvent: "PRESCRIPTION_READY" | "PRESCRIPTION_UPDATED" | null = null;
        if (correcting) {
          const pending = existing.prescriptions.find(item => item.status === "PENDING");
          const locked = existing.prescriptions.find(item => item.status === "PARTIALLY_DISPENSED" || item.status === "DISPENSED");
          if (pending) {
            if (draft.prescriptionItems.length) {
              if (prescriptionSignature(pending.items) !== prescriptionSignature(draft.prescriptionItems)) {
                await tx.prescriptionItem.deleteMany({ where: { prescriptionId: pending.id } });
                prescription = await tx.prescription.update({ where: { id: pending.id }, data: { items: { create: draft.prescriptionItems } } });
                correctedPrescriptionEvent = "PRESCRIPTION_UPDATED";
              }
            } else {
              await tx.prescription.delete({ where: { id: pending.id } });
            }
          } else if (locked) {
            if (prescriptionSignature(locked.items) !== prescriptionSignature(draft.prescriptionItems)) throw new ConsultationError("A dispensed prescription cannot be changed. Other consultation corrections can still be saved.", 409);
          } else if (draft.prescriptionItems.length) {
            prescription = await tx.prescription.create({ data: { encounterId: existing.id, patientId: existing.patientId, doctorId: existing.doctorId, status: "PENDING", notes: "Consultation prescription", items: { create: draft.prescriptionItems } } });
            correctedPrescriptionEvent = "PRESCRIPTION_READY";
          }
        } else if (draft.prescriptionItems.length) {
          prescription = await tx.prescription.create({ data: { encounterId: existing.id, patientId: existing.patientId, doctorId: existing.doctorId, status: "PENDING", notes: "Consultation prescription", items: { create: draft.prescriptionItems } } });
        }
        // Handoffs belong only to the first IN_PROGRESS -> FINALIZED transition.
        // Later corrections to a finalized encounter must not notify staff again.
        if (existing.status === "IN_PROGRESS" && existing.appointmentId) {
          const appointment = await tx.appointment.update({ where: { id: existing.appointmentId }, data: { status: "COMPLETED" }, include: { patient: true } });
          const patientName = `${appointment.patient.firstName} ${appointment.patient.lastName}`.trim();
          await tx.notification.createMany({ data: [
            {
              type: "CONSULTATION_COMPLETED",
              audience: "RECEPTION",
              title: `Patient ticket #${appointment.tokenNumber} completed`,
              message: `${patientName}'s consultation has been completed.`,
              href: "/appointments",
              appointmentId: appointment.id,
            },
            {
              type: "BILLING_REVIEW_REQUIRED",
              audience: "BILLING",
              title: `Billing review for ticket #${appointment.tokenNumber}`,
              message: `Review charges and any payment due for ${patientName} after the completed consultation.`,
              href: `/billing?patientId=${appointment.patientId}&encounterId=${existing.id}`,
              appointmentId: appointment.id,
            },
            ...(prescription ? [{
              type: "PRESCRIPTION_READY",
              audience: "PHARMACY",
              title: `Prescription ready for ticket #${appointment.tokenNumber}`,
              message: `${patientName} (${appointment.patient.mrn}) has a prescription ready for pharmacy review.`,
              href: `/pharmacy?prescriptionId=${prescription.id}`,
              appointmentId: appointment.id,
            }] : []),
          ] });
        } else if (correcting && correctedPrescriptionEvent && existing.appointmentId && prescription) {
          await tx.notification.create({ data: {
            type: correctedPrescriptionEvent,
            audience: "PHARMACY",
            title: correctedPrescriptionEvent === "PRESCRIPTION_READY" ? "Prescription added after consultation" : "Prescription updated after consultation",
            message: "A finalized consultation prescription needs pharmacy review.",
            href: `/pharmacy?prescriptionId=${prescription.id}`,
            appointmentId: existing.appointmentId,
          } });
        }
      }
      await tx.auditLog.create({ data: { userId: actor.id, userName: actor.name, userRole: actor.role, action: correcting ? "CORRECT" : finalizing ? "FINALIZE" : "SAVE_DRAFT", resource: "ENCOUNTER", resourceId: existing.id, details: correcting ? "Completed consultation corrected directly; clinical entries remain finalized." : finalizing ? "Consultation finalized; vitals, notes and prescription saved." : "Consultation draft saved." } });
      return tx.encounter.findUniqueOrThrow({ where: { id: existing.id }, include: encounterInclude });
    });
    return NextResponse.json({ success: true, encounter });
  } catch (error) { return consultationError(error); }
}
