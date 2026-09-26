import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { pakistanDateKey, pakistanDayBounds, PAYMENT_METHODS } from "@/lib/pakistan";
import { roundRupees } from "@/lib/billing";
import { assertRoomAvailable, ConsultationError } from "@/lib/consultation";
import { authorizationErrorResponse, requestIp, requireActor } from "@/lib/auth";
import { parsePermissions } from "@/lib/permissions";

const appointmentStatuses = ["SCHEDULED", "WAITING", "IN_CONSULTATION", "COMPLETED", "CANCELLED", "NO_SHOW"];
const queuePermissions = ["booking", "appointments", "patient_calling", "clinical"] as const;

function scheduledDateFrom(value: unknown) {
  if (value === undefined || value === null || value === "") return new Date();
  const text = String(value).trim();
  const localized = /^\d{4}-\d{2}-\d{2}$/.test(text)
    ? `${text}T09:00:00+05:00`
    : /(?:Z|[+-]\d{2}:\d{2})$/.test(text) ? text : `${text}+05:00`;
  const date = new Date(localized);
  if (Number.isNaN(date.getTime())) throw new ConsultationError("Invalid appointment date.");
  return date;
}

function scheduleLabel(value: Date) {
  return new Intl.DateTimeFormat("en-PK", {
    timeZone: "Asia/Karachi",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(value);
}

function queueNotification(data: Record<string, unknown>) {
  // Kept compatible while the notification audience migration and generated
  // Prisma client are applied together across the workspace.
  return { audience: "QUEUE", ...data } as any;
}

export async function GET(req: NextRequest) {
  try {
    await requireActor(req, { anyOf: [...queuePermissions] });
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const doctorId = searchParams.get("doctorId");
    const view = searchParams.get("view") || (searchParams.get("today") === "1" ? "today" : "all");
    if (status && !appointmentStatuses.includes(status)) throw new ConsultationError("Invalid appointment status.");
    if (!["all", "today", "upcoming"].includes(view)) throw new ConsultationError("Invalid appointment view.");

    const where: any = {};
    if (status) where.status = status;
    if (doctorId) where.doctorId = doctorId;
    const { start, end } = pakistanDayBounds(new Date());
    if (view === "today") {
      where.OR = [{ scheduledAt: { gte: start, lt: end } }, { status: "IN_CONSULTATION" }];
    } else if (view === "upcoming") {
      where.scheduledAt = { gte: end };
      if (!status) where.status = "SCHEDULED";
    }

    const appointments = await prisma.appointment.findMany({
      where,
      orderBy: view === "upcoming"
        ? [{ scheduledAt: "asc" }, { tokenNumber: "asc" }]
        : [{ status: "asc" }, { tokenNumber: "asc" }, { scheduledAt: "asc" }],
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
    const authorization = authorizationErrorResponse(error);
    if (authorization) return authorization;
    if (error instanceof ConsultationError) return NextResponse.json({ success: false, error: error.message }, { status: error.status });
    console.error("Fetch appointments error:", error);
    return NextResponse.json({ success: false, error: "Failed to fetch appointments" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const actor = await requireActor(req, { allOf: ["booking"] });
    const body = await req.json();
    const { patientId, department, scheduledAt, reason, type, payment } = body;
    if (!patientId) throw new ConsultationError("Patient is required.");

    const scheduledDate = scheduledDateFrom(scheduledAt);
    const appointmentDay = pakistanDateKey(scheduledDate);
    const today = pakistanDateKey();
    if (appointmentDay < today) throw new ConsultationError("Appointments cannot be booked for a past date.");
    const status = appointmentDay === today ? "WAITING" : "SCHEDULED";

    const receivedAmount = roundRupees(Number(payment?.amount || 0));
    if (!Number.isFinite(receivedAmount) || receivedAmount < 0) throw new ConsultationError("Enter a valid received amount.");
    if (receivedAmount > 0 && !PAYMENT_METHODS.includes(payment?.method || "Cash")) throw new ConsultationError("Select a valid payment method.");

    const { start, end } = pakistanDayBounds(scheduledDate);
    const result = await prisma.$transaction(async transaction => {
      const patient = await transaction.patient.findUnique({ where: { id: patientId } });
      if (!patient) throw new ConsultationError("Patient not found.", 404);

      const requestedClinician = body.doctorId
        ? await transaction.user.findFirst({ where: { id: String(body.doctorId), isActive: true, role: { in: ["DOCTOR", "NURSE"] } } })
        : null;
      const requestedCanPractice = requestedClinician
        ? parsePermissions(requestedClinician.permissions, requestedClinician.role).includes("clinical")
        : false;
      const clinicianCandidates = requestedCanPractice ? [] : await transaction.user.findMany({
        where: { isActive: true, role: { in: ["DOCTOR", "NURSE"] } },
        orderBy: [{ role: "asc" }, { createdAt: "asc" }, { id: "asc" }],
      });
      const clinician = (requestedCanPractice ? requestedClinician : null)
        || clinicianCandidates.find(candidate => parsePermissions(candidate.permissions, candidate.role).includes("clinical"))
        || (actor.grantedPermissions.includes("clinical") ? actor : null);
      if (!clinician) throw new ConsultationError("No active doctor is available for this booking.", 409);

      const tokenAggregate = await transaction.appointment.aggregate({
        where: { scheduledAt: { gte: start, lt: end } },
        _max: { tokenNumber: true },
      });
      const appointment = await transaction.appointment.create({
        data: {
          patientId,
          doctorId: clinician.id,
          department: department || clinician.department || "General Medicine",
          scheduledAt: scheduledDate,
          checkedInAt: status === "WAITING" ? new Date() : null,
          tokenNumber: (tokenAggregate._max.tokenNumber || 0) + 1,
          status,
          reason: reason || "Routine Consultation",
          type: type || "OPD",
        },
        include: { patient: true, doctor: true },
      });

      let receipt = null;
      if (receivedAmount > 0) {
        const invoiceCount = await transaction.invoice.count();
        const invoiceNumber = `INV-${new Date().getFullYear()}-${String(invoiceCount + 1).padStart(4, "0")}`;
        const method = payment?.method || "Cash";
        receipt = await transaction.invoice.create({
          data: {
            invoiceNumber,
            patientId,
            subtotal: receivedAmount,
            totalAmount: receivedAmount,
            paidAmount: receivedAmount,
            balanceDue: 0,
            status: "PAID",
            paymentMethod: method,
            paidAt: new Date(),
            notes: String(payment?.notes || "Booking payment").trim() || null,
            items: { create: [{ description: String(payment?.description || "Booking / consultation fee").trim(), category: "CONSULTATION", quantity: 1, unitPrice: receivedAmount, totalPrice: receivedAmount }] },
            payments: { create: [{ amount: receivedAmount, method, reference: String(payment?.reference || "").trim() || null, receivedBy: actor.name }] },
          },
          include: { items: true, payments: true },
        });
      }

      const fullName = `${appointment.patient.firstName} ${appointment.patient.lastName}`.trim();
      const isWaiting = appointment.status === "WAITING";
      await transaction.auditLog.create({ data: {
        userId: actor.id,
        userName: actor.name,
        userRole: actor.role,
        action: isWaiting ? "CREATE" : "SCHEDULE",
        resource: "APPOINTMENT",
        resourceId: appointment.id,
        details: isWaiting
          ? `Token #${appointment.tokenNumber} issued and checked in for ${fullName}${receivedAmount > 0 ? `; PKR ${receivedAmount.toFixed(2)} received` : ""}`
          : `Token #${appointment.tokenNumber} scheduled for ${fullName} on ${scheduleLabel(appointment.scheduledAt)}${receivedAmount > 0 ? `; PKR ${receivedAmount.toFixed(2)} received` : ""}`,
        ipAddress: requestIp(req),
      } });
      await transaction.notification.create({ data: queueNotification({
        type: isWaiting ? "PATIENT_CHECKED_IN" : "APPOINTMENT_SCHEDULED",
        title: isWaiting ? `Patient ticket #${appointment.tokenNumber} issued` : `Appointment #${appointment.tokenNumber} scheduled`,
        message: isWaiting
          ? `${fullName} is waiting for consultation.`
          : `${fullName} is scheduled for ${scheduleLabel(appointment.scheduledAt)}.`,
        href: isWaiting ? "/appointments?view=today" : "/appointments?view=upcoming",
        appointmentId: appointment.id,
      }) });
      return { appointment, receipt };
    });

    return NextResponse.json({ success: true, ...result }, { status: 201 });
  } catch (error) {
    const authorization = authorizationErrorResponse(error);
    if (authorization) return authorization;
    if (error instanceof ConsultationError) return NextResponse.json({ success: false, error: error.message }, { status: error.status });
    console.error("Create appointment error:", error);
    return NextResponse.json({ success: false, error: "Failed to schedule appointment" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, status, action } = body;

    if (action === "CALL" || action === "CALL_NEXT") {
      const actor = await requireActor(req, { allOf: ["clinical", "patient_calling"] });
      const { start, end } = pakistanDayBounds(new Date());
      const canCallAnyDoctor = actor.role === "ADMIN" || actor.role === "ENGINEER";
      const called = await prisma.$transaction(async transaction => {
        const target = id
          ? await transaction.appointment.findFirst({ where: { id, status: "WAITING", scheduledAt: { gte: start, lt: end } }, include: { patient: true, doctor: true } })
          : await transaction.appointment.findFirst({ where: { status: "WAITING", scheduledAt: { gte: start, lt: end }, ...(!canCallAnyDoctor ? { doctorId: actor.id } : {}) }, orderBy: [{ tokenNumber: "asc" }, { scheduledAt: "asc" }], include: { patient: true, doctor: true } });
        if (!target) throw new ConsultationError("There are no waiting patients to call.", 409);
        if (!canCallAnyDoctor && target.doctorId !== actor.id) throw new ConsultationError("Only the assigned doctor can call this patient.", 403);

        await assertRoomAvailable(transaction, target.id);
        const claimed = await transaction.appointment.updateMany({ where: { id: target.id, status: "WAITING" }, data: { status: "IN_CONSULTATION" } });
        if (claimed.count !== 1) throw new ConsultationError("This patient has already been called.", 409);
        const appointment = await transaction.appointment.findUniqueOrThrow({ where: { id: target.id }, include: { patient: true, doctor: true } });
        const fullName = `${appointment.patient.firstName} ${appointment.patient.lastName}`.trim();
        await transaction.auditLog.create({ data: {
          userId: actor.id,
          userName: actor.name,
          userRole: actor.role,
          action: "CALL",
          resource: "APPOINTMENT",
          resourceId: appointment.id,
          details: `Called token #${appointment.tokenNumber}: ${fullName}`,
          ipAddress: requestIp(req),
        } });
        await transaction.notification.create({ data: queueNotification({
          type: "PATIENT_CALLED",
          title: `Patient ticket #${appointment.tokenNumber} called`,
          message: `${fullName} has been called into the doctor's room.`,
          href: `/clinical?patientId=${appointment.patientId}&appointmentId=${appointment.id}`,
          appointmentId: appointment.id,
        }) });
        return appointment;
      });
      return NextResponse.json({ success: true, appointment: called });
    }

    if (action === "CHECK_IN") {
      const actor = await requireActor(req, { allOf: ["booking"] });
      if (!id) throw new ConsultationError("Appointment ID is required.");
      const { start, end } = pakistanDayBounds(new Date());
      const checkedIn = await prisma.$transaction(async transaction => {
        const target = await transaction.appointment.findUnique({ where: { id }, include: { patient: true, doctor: true } });
        if (!target) throw new ConsultationError("Appointment not found.", 404);
        if (target.status !== "SCHEDULED") throw new ConsultationError("Only a scheduled appointment can be checked in.", 409);
        if (target.scheduledAt < start || target.scheduledAt >= end) throw new ConsultationError("Only appointments scheduled for today can be checked in.", 409);

        const checkedInAt = new Date();
        const claimed = await transaction.appointment.updateMany({
          where: { id: target.id, status: "SCHEDULED", scheduledAt: { gte: start, lt: end } },
          data: { status: "WAITING", checkedInAt },
        });
        if (claimed.count !== 1) throw new ConsultationError("This appointment has already been checked in.", 409);
        const appointment = await transaction.appointment.findUniqueOrThrow({ where: { id: target.id }, include: { patient: true, doctor: true } });
        const fullName = `${appointment.patient.firstName} ${appointment.patient.lastName}`.trim();
        await transaction.auditLog.create({ data: {
          userId: actor.id,
          userName: actor.name,
          userRole: actor.role,
          action: "CHECK_IN",
          resource: "APPOINTMENT",
          resourceId: appointment.id,
          details: `Checked in token #${appointment.tokenNumber}: ${fullName}`,
          ipAddress: requestIp(req),
        } });
        await transaction.notification.create({ data: queueNotification({
          type: "PATIENT_CHECKED_IN",
          title: `Patient ticket #${appointment.tokenNumber} checked in`,
          message: `${fullName} is now waiting for consultation.`,
          href: "/appointments?view=today",
          appointmentId: appointment.id,
        }) });
        return appointment;
      });
      return NextResponse.json({ success: true, appointment: checkedIn });
    }

    const actor = await requireActor(req, { allOf: ["booking"] });
    if (!id || !status) throw new ConsultationError("Appointment ID and status are required.");
    if (!["CANCELLED", "NO_SHOW"].includes(status)) throw new ConsultationError("Use Call patient to start a visit and Finish Consultation to complete it.", 409);

    const updated = await prisma.$transaction(async transaction => {
      const appointment = await transaction.appointment.findUnique({ where: { id } });
      if (!appointment || !["WAITING", "SCHEDULED"].includes(appointment.status)) throw new ConsultationError("Only a waiting or scheduled booking can be cancelled or marked absent.", 409);
      if (status === "NO_SHOW") {
        const { end } = pakistanDayBounds(new Date());
        if (appointment.scheduledAt >= end) throw new ConsultationError("A future appointment cannot be marked as a no-show.", 409);
      }
      const changed = await transaction.appointment.update({ where: { id }, data: { status }, include: { patient: true, doctor: true } });
      const label = status === "NO_SHOW" ? "marked absent" : "cancelled";
      const fullName = `${changed.patient.firstName} ${changed.patient.lastName}`.trim();
      await transaction.notification.create({ data: queueNotification({
        type: status === "NO_SHOW" ? "PATIENT_NO_SHOW" : "APPOINTMENT_CANCELLED",
        title: `Patient ticket #${changed.tokenNumber} ${label}`,
        message: `${fullName}'s appointment was ${label}.`,
        href: "/appointments",
        appointmentId: changed.id,
      }) });
      await transaction.auditLog.create({ data: {
        userId: actor.id,
        userName: actor.name,
        userRole: actor.role,
        action: status,
        resource: "APPOINTMENT",
        resourceId: changed.id,
        details: `Token #${changed.tokenNumber} ${label}: ${fullName}`,
        ipAddress: requestIp(req),
      } });
      return changed;
    });

    return NextResponse.json({ success: true, appointment: updated });
  } catch (error) {
    const authorization = authorizationErrorResponse(error);
    if (authorization) return authorization;
    if (error instanceof ConsultationError) return NextResponse.json({ success: false, error: error.message }, { status: error.status });
    console.error("Update appointment error:", error);
    return NextResponse.json({ success: false, error: "Failed to update appointment status" }, { status: 500 });
  }
}
