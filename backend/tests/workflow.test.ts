import assert from "node:assert/strict";
import { test } from "node:test";
import { closeSync, mkdtempSync, openSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { execFileSync } from "node:child_process";
import { NextRequest } from "next/server";

test("appointment scheduling and queue transitions are authorized and state driven", async t => {
  const directory = mkdtempSync(join(tmpdir(), "cims-workflow-test-"));
  process.env.DATABASE_URL = `file:${join(directory, "test.db").replaceAll("\\", "/")}`;
  closeSync(openSync(join(directory, "test.db"), "w"));
  execFileSync(process.execPath, [resolve("../node_modules/prisma/build/index.js"), "db", "push", "--skip-generate", "--schema", resolve("prisma/schema.prisma")], { env: process.env, stdio: "pipe" });

  const { prisma } = await import("../src/lib/db/prisma");
  const appointments = await import("../src/app/api/appointments/route");
  const dashboard = await import("../src/app/api/dashboard/stats/route");
  const { pakistanDayBounds } = await import("../src/lib/pakistan");

  function request(path: string, method: string, actor?: string, body?: unknown) {
    return new NextRequest(`http://localhost/api/${path}`, {
      method,
      headers: { "Content-Type": "application/json", ...(actor ? { "x-cims-user-id": actor } : {}), "x-forwarded-for": "10.20.30.40" },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
  }

  const { start, end } = pakistanDayBounds(new Date());
  const todayAt = new Date(start.getTime() + 10 * 60 * 60 * 1000);
  const futureAt = new Date(end.getTime() + 10 * 60 * 60 * 1000);
  const pastAt = new Date(start.getTime() - 14 * 60 * 60 * 1000);

  try {
    await prisma.user.createMany({ data: [
      { id: "doctor", name: "Test Doctor", email: "doctor@workflow.test", role: "DOCTOR", department: "General Medicine" },
      { id: "other-doctor", name: "Other Doctor", email: "other-doctor@workflow.test", role: "DOCTOR", department: "General Medicine" },
      { id: "desk", name: "Reception Desk", email: "desk@workflow.test", role: "RECEPTIONIST" },
      { id: "pharmacy", name: "Pharmacy", email: "pharmacy@workflow.test", role: "PHARMACIST" },
    ] });
    await prisma.patient.createMany({ data: [
      { id: "patient1", mrn: "FLOW-1", firstName: "Today", lastName: "Patient", gender: "Male", dateOfBirth: new Date("1990-01-01"), phone: "03001234567" },
      { id: "patient2", mrn: "FLOW-2", firstName: "Future", lastName: "Patient", gender: "Female", dateOfBirth: new Date("1991-01-01"), phone: "03001234568" },
      { id: "patient3", mrn: "FLOW-3", firstName: "Checkin", lastName: "Patient", gender: "Male", dateOfBirth: new Date("1992-01-01"), phone: "03001234569" },
    ] });

    await t.test("booking and queue reads require the relevant permissions", async () => {
      const body = { patientId: "patient1", scheduledAt: todayAt.toISOString() };
      assert.equal((await appointments.POST(request("appointments", "POST", undefined, body))).status, 401);
      assert.equal((await appointments.POST(request("appointments", "POST", "pharmacy", body))).status, 403);
      assert.equal((await appointments.GET(request("appointments?view=today", "GET"))).status, 401);
      assert.equal((await appointments.GET(request("appointments?view=today", "GET", "pharmacy"))).status, 403);
      assert.equal((await appointments.GET(request("appointments?view=today", "GET", "doctor"))).status, 200);
      assert.equal(await prisma.appointment.count(), 0);
    });

    let todayId = "";
    await t.test("a same-day booking is checked in and assigned to an active clinician", async () => {
      const response = await appointments.POST(request("appointments", "POST", "desk", {
        patientId: "patient1",
        doctorId: "desk",
        scheduledAt: todayAt.toISOString(),
        reason: "Same-day visit",
      }));
      assert.equal(response.status, 201);
      const result = await response.json();
      todayId = result.appointment.id;
      assert.equal(result.appointment.status, "WAITING");
      assert.equal(result.appointment.doctorId, "doctor");
      assert.ok(result.appointment.checkedInAt);
      assert.equal(result.receipt, null);
      const alert = await prisma.notification.findFirstOrThrow({ where: { appointmentId: todayId } });
      assert.equal(alert.type, "PATIENT_CHECKED_IN");
      assert.equal(alert.audience, "QUEUE");
    });

    await t.test("past dates are rejected without side effects", async () => {
      const before = await prisma.appointment.count();
      const response = await appointments.POST(request("appointments", "POST", "desk", { patientId: "patient2", scheduledAt: pastAt.toISOString() }));
      assert.equal(response.status, 400);
      assert.match((await response.json()).error, /past date/i);
      assert.equal(await prisma.appointment.count(), before);
    });

    let futureId = "";
    await t.test("a future booking stays scheduled and appears only in upcoming", async () => {
      const response = await appointments.POST(request("appointments", "POST", "desk", {
        patientId: "patient2",
        doctorId: "desk",
        scheduledAt: futureAt.toISOString(),
        payment: { amount: 0 },
      }));
      assert.equal(response.status, 201);
      const result = await response.json();
      futureId = result.appointment.id;
      assert.equal(result.appointment.status, "SCHEDULED");
      assert.equal(result.appointment.checkedInAt, null);
      assert.equal(result.appointment.doctorId, "doctor");

      const today = await (await appointments.GET(request("appointments?view=today", "GET", "desk"))).json();
      const upcoming = await (await appointments.GET(request("appointments?view=upcoming", "GET", "desk"))).json();
      assert.equal(today.appointments.some((item: any) => item.id === futureId), false);
      assert.equal(upcoming.appointments.some((item: any) => item.id === futureId), true);
      assert.equal((await prisma.notification.findFirstOrThrow({ where: { appointmentId: futureId } })).type, "APPOINTMENT_SCHEDULED");
    });

    await t.test("future appointments cannot be checked in, called, or marked no-show", async () => {
      assert.equal((await appointments.PATCH(request("appointments", "PATCH", "desk", { action: "CHECK_IN", id: futureId }))).status, 409);
      assert.equal((await appointments.PATCH(request("appointments", "PATCH", "doctor", { action: "CALL", id: futureId }))).status, 409);
      assert.equal((await appointments.PATCH(request("appointments", "PATCH", "desk", { id: futureId, status: "NO_SHOW" }))).status, 409);
      assert.equal((await prisma.appointment.findUniqueOrThrow({ where: { id: futureId } })).status, "SCHEDULED");
    });

    let dueId = "";
    await t.test("reception checks in today's scheduled appointment exactly once", async () => {
      const due = await prisma.appointment.create({ data: {
        patientId: "patient3",
        doctorId: "doctor",
        scheduledAt: todayAt,
        tokenNumber: 99,
        status: "SCHEDULED",
      } });
      dueId = due.id;
      const response = await appointments.PATCH(request("appointments", "PATCH", "desk", { action: "CHECK_IN", id: due.id }));
      assert.equal(response.status, 200);
      const checkedIn = (await response.json()).appointment;
      assert.equal(checkedIn.status, "WAITING");
      assert.ok(checkedIn.checkedInAt);
      assert.equal((await appointments.PATCH(request("appointments", "PATCH", "desk", { action: "CHECK_IN", id: due.id }))).status, 409);
      assert.equal(await prisma.auditLog.count({ where: { action: "CHECK_IN", resourceId: due.id, userId: "desk" } }), 1);
      assert.equal(await prisma.notification.count({ where: { appointmentId: due.id, type: "PATIENT_CHECKED_IN", audience: "QUEUE" } }), 1);
    });

    await t.test("calling requires both clinical and patient-calling permission", async () => {
      const anotherDoctorsPatient = await prisma.appointment.create({ data: {
        patientId: "patient2",
        doctorId: "other-doctor",
        scheduledAt: todayAt,
        checkedInAt: new Date(),
        tokenNumber: 100,
        status: "WAITING",
      } });
      assert.equal((await appointments.PATCH(request("appointments", "PATCH", "desk", { action: "CALL", id: dueId }))).status, 403);
      assert.equal((await appointments.PATCH(request("appointments", "PATCH", "doctor", { action: "CALL", id: anotherDoctorsPatient.id }))).status, 403);
      assert.equal((await appointments.PATCH(request("appointments", "PATCH", "desk", { id: anotherDoctorsPatient.id, status: "NO_SHOW" }))).status, 200);
      assert.equal((await appointments.PATCH(request("appointments", "PATCH", "doctor", { action: "CALL", id: dueId }))).status, 200);
      assert.equal((await prisma.appointment.findUniqueOrThrow({ where: { id: dueId } })).status, "IN_CONSULTATION");
      assert.equal(await prisma.notification.count({ where: { appointmentId: dueId, type: "PATIENT_CALLED", audience: "QUEUE" } }), 1);
    });

    await t.test("booking permission controls cancellation and future cancellation remains allowed", async () => {
      assert.equal((await appointments.PATCH(request("appointments", "PATCH", "doctor", { id: futureId, status: "CANCELLED" }))).status, 403);
      assert.equal((await appointments.PATCH(request("appointments", "PATCH", "desk", { id: futureId, status: "CANCELLED" }))).status, 200);
      assert.equal((await prisma.appointment.findUniqueOrThrow({ where: { id: futureId } })).status, "CANCELLED");
    });

    await t.test("dashboard waiting count is limited to today's queue", async () => {
      await prisma.appointment.create({ data: { patientId: "patient2", doctorId: "doctor", scheduledAt: futureAt, tokenNumber: 88, status: "WAITING" } });
      const data = await (await dashboard.GET()).json();
      assert.equal(data.stats.waitingQueue, 1);
      assert.equal((await prisma.appointment.findUniqueOrThrow({ where: { id: todayId } })).status, "WAITING");
    });
  } finally {
    await prisma.$disconnect();
    if (resolve(directory).startsWith(resolve(tmpdir()))) rmSync(directory, { recursive: true, force: true });
  }
});
