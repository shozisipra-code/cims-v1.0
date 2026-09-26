import assert from "node:assert/strict";
import { test } from "node:test";
import { closeSync, mkdtempSync, openSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { execFileSync } from "node:child_process";
import { NextRequest } from "next/server";

test("notification center targets workflow alerts and keeps reads per user", async t => {
  const directory = mkdtempSync(join(tmpdir(), "cims-notifications-test-"));
  process.env.DATABASE_URL = `file:${join(directory, "test.db").replaceAll("\\", "/")}`;
  closeSync(openSync(join(directory, "test.db"), "w"));
  execFileSync(process.execPath, [resolve("../node_modules/prisma/build/index.js"), "db", "push", "--skip-generate", "--schema", resolve("prisma/schema.prisma")], { env: process.env, stdio: "pipe" });
  const { prisma } = await import("../src/lib/db/prisma");
  const appointments = await import("../src/app/api/appointments/route");
  const encounters = await import("../src/app/api/encounters/route");
  const notifications = await import("../src/app/api/notifications/route");
  const login = await import("../src/app/api/auth/login/route");

  function request(path: string, method: string, actor?: string, body?: unknown, ipAddress = "10.0.0.8") {
    return new NextRequest(`http://localhost/api/${path}`, {
      method,
      headers: { "Content-Type": "application/json", ...(actor ? { "x-cims-user-id": actor } : {}), "x-forwarded-for": ipAddress },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
  }

  try {
    await prisma.user.createMany({ data: [
      { id: "admin", name: "Admin", username: "admin", email: "admin@notifications.test", role: "ADMIN" },
      { id: "doctor", name: "Doctor", username: "doctor", email: "doctor@notifications.test", role: "DOCTOR" },
      { id: "desk", name: "Reception", username: "desk", email: "desk@notifications.test", role: "RECEPTIONIST" },
      { id: "cashier", name: "Cashier", username: "cashier", email: "cashier@notifications.test", role: "RECEPTIONIST", permissions: '["billing"]' },
      { id: "pharmacy", name: "Pharmacy", username: "pharmacy", email: "pharmacy@notifications.test", role: "PHARMACIST" },
    ] });
    await prisma.patient.create({ data: { id: "patient", mrn: "NOTICE-1", firstName: "Test", lastName: "Patient", gender: "Male", dateOfBirth: new Date("1990-01-01"), phone: "03001234567" } });

    await t.test("issuing a token creates an unread ticket update for relevant staff", async () => {
      const response = await appointments.POST(request("appointments", "POST", "desk", { patientId: "patient", doctorId: "doctor", reason: "Notification test" }));
      assert.equal(response.status, 201);
      const doctorFeed = await (await notifications.GET(request("notifications", "GET", "doctor"))).json();
      const adminFeed = await (await notifications.GET(request("notifications", "GET", "admin"))).json();
      const pharmacyFeed = await (await notifications.GET(request("notifications", "GET", "pharmacy"))).json();
      assert.equal(doctorFeed.workflowAlerts.length, 1);
      assert.match(doctorFeed.workflowAlerts[0].title, /issued/);
      assert.equal(adminFeed.workflowAlerts.length, 1);
      assert.equal(pharmacyFeed.workflowAlerts.length, 0);
    });

    await t.test("reading a ticket does not clear it for another user", async () => {
      const feed = await (await notifications.GET(request("notifications", "GET", "doctor"))).json();
      assert.equal((await notifications.PATCH(request("notifications", "PATCH", "doctor", { action: "READ_ALERT", id: feed.workflowAlerts[0].id }))).status, 200);
      assert.equal((await (await notifications.GET(request("notifications", "GET", "doctor"))).json()).workflowAlerts.length, 0);
      assert.equal((await (await notifications.GET(request("notifications", "GET", "admin"))).json()).workflowAlerts.length, 1);
    });

    await t.test("calling the patient creates a fresh ticket update", async () => {
      const appointment = await prisma.appointment.findFirstOrThrow();
      assert.equal((await appointments.PATCH(request("appointments", "PATCH", "doctor", { action: "CALL", id: appointment.id }))).status, 200);
      const feed = await (await notifications.GET(request("notifications", "GET", "doctor"))).json();
      assert.equal(feed.workflowAlerts.length, 1);
      assert.match(feed.workflowAlerts[0].title, /called/);
    });

    await t.test("finishing a visit targets reception, pharmacy and billing without duplicate handoffs", async () => {
      const appointment = await prisma.appointment.findFirstOrThrow();
      const openedResponse = await encounters.POST(request("encounters", "POST", "doctor", { patientId: "patient", appointmentId: appointment.id }));
      assert.equal(openedResponse.status, 200);
      const opened = (await openedResponse.json()).encounter;
      const final = {
        id: opened.id,
        revision: opened.revision,
        status: "FINALIZED",
        chiefComplaint: "Notification workflow test",
        hpi: "",
        physicalExam: "",
        clinicalNotes: "",
        assessmentPlan: "",
        diagnosis: "Test diagnosis",
        followUpDate: "",
        vitals: {},
        prescriptionItems: [{ medicationName: "Test medicine", dosage: "1 tablet", frequency: "Daily", duration: "3 days", instructions: "After food", quantity: 3 }],
      };
      assert.equal((await encounters.PATCH(request("encounters", "PATCH", "doctor", final))).status, 200);

      const doctorFeed = await (await notifications.GET(request("notifications", "GET", "doctor"))).json();
      const deskFeed = await (await notifications.GET(request("notifications", "GET", "desk"))).json();
      const cashierFeed = await (await notifications.GET(request("notifications", "GET", "cashier"))).json();
      const pharmacyFeed = await (await notifications.GET(request("notifications", "GET", "pharmacy"))).json();
      const adminFeed = await (await notifications.GET(request("notifications", "GET", "admin"))).json();

      assert.equal(doctorFeed.workflowAlerts.some((item: any) => ["CONSULTATION_COMPLETED", "PRESCRIPTION_READY", "BILLING_REVIEW_REQUIRED"].includes(item.type)), false);
      assert.equal(deskFeed.workflowAlerts.filter((item: any) => item.type === "CONSULTATION_COMPLETED").length, 1);
      assert.equal(deskFeed.workflowAlerts.filter((item: any) => item.type === "BILLING_REVIEW_REQUIRED").length, 1);
      assert.deepEqual(cashierFeed.workflowAlerts.map((item: any) => item.type), ["BILLING_REVIEW_REQUIRED"]);
      assert.equal(pharmacyFeed.workflowAlerts.length, 1);
      assert.equal(pharmacyFeed.workflowAlerts[0].type, "PRESCRIPTION_READY");
      assert.equal(pharmacyFeed.workflowAlerts[0].audience, "PHARMACY");
      assert.equal(adminFeed.workflowAlerts.filter((item: any) => ["CONSULTATION_COMPLETED", "PRESCRIPTION_READY", "BILLING_REVIEW_REQUIRED"].includes(item.type)).length, 3);

      const pharmacyAlertId = pharmacyFeed.workflowAlerts[0].id;
      assert.equal((await notifications.PATCH(request("notifications", "PATCH", "doctor", { action: "READ_ALERT", id: pharmacyAlertId }))).status, 404);
      assert.equal((await notifications.PATCH(request("notifications", "PATCH", "pharmacy", { action: "READ_ALERT", id: pharmacyAlertId }))).status, 200);
      assert.equal((await (await notifications.GET(request("notifications", "GET", "pharmacy"))).json()).workflowAlerts.length, 0);

      assert.equal(await prisma.notification.count({ where: { appointmentId: appointment.id, type: { in: ["CONSULTATION_COMPLETED", "PRESCRIPTION_READY", "BILLING_REVIEW_REQUIRED"] } } }), 3);

      await prisma.patient.create({ data: { id: "patient-no-rx", mrn: "NOTICE-2", firstName: "No", lastName: "Prescription", gender: "Female", dateOfBirth: new Date("1992-02-02"), phone: "03007654321" } });
      const noRxAppointment = await prisma.appointment.create({ data: { id: "appointment-no-rx", patientId: "patient-no-rx", doctorId: "doctor", scheduledAt: new Date(), checkedInAt: new Date(), tokenNumber: 2, status: "WAITING" } });
      assert.equal((await appointments.PATCH(request("appointments", "PATCH", "doctor", { action: "CALL", id: noRxAppointment.id }))).status, 200);
      const noRxOpenedResponse = await encounters.POST(request("encounters", "POST", "doctor", { patientId: "patient-no-rx", appointmentId: noRxAppointment.id }));
      assert.equal(noRxOpenedResponse.status, 200);
      const noRxOpened = (await noRxOpenedResponse.json()).encounter;
      assert.equal((await encounters.PATCH(request("encounters", "PATCH", "doctor", { ...final, id: noRxOpened.id, revision: noRxOpened.revision, prescriptionItems: [] }))).status, 200);
      assert.equal(await prisma.notification.count({ where: { appointmentId: noRxAppointment.id, type: "PRESCRIPTION_READY" } }), 0);
      assert.equal((await (await notifications.GET(request("notifications", "GET", "pharmacy"))).json()).workflowAlerts.length, 0);
    });

    await t.test("security feed appears after three failures and only to privileged staff", async () => {
      for (let attempt = 1; attempt <= 2; attempt += 1) {
        assert.equal((await login.POST(request("auth/login", "POST", undefined, { username: "doctor", password: "wrong" }))).status, 401);
      }
      assert.equal((await (await notifications.GET(request("notifications", "GET", "admin"))).json()).securityAlerts.length, 0);
      assert.equal((await login.POST(request("auth/login", "POST", undefined, { username: "doctor", password: "wrong" }))).status, 401);
      const adminFeed = await (await notifications.GET(request("notifications", "GET", "admin"))).json();
      const doctorFeed = await (await notifications.GET(request("notifications", "GET", "doctor"))).json();
      assert.equal(adminFeed.securityAlerts.length, 1);
      assert.equal(adminFeed.securityAlerts[0].failedCount, 3);
      assert.equal(doctorFeed.securityAlerts.length, 0);
      assert.equal(doctorFeed.isPrivileged, false);
      assert.equal((await notifications.PATCH(request("notifications", "PATCH", "doctor", { action: "READ_SECURITY", id: adminFeed.securityAlerts[0].id }))).status, 403);
      assert.equal((await notifications.PATCH(request("notifications", "PATCH", "admin", { action: "READ_SECURITY", id: adminFeed.securityAlerts[0].id }))).status, 200);
      assert.equal((await (await notifications.GET(request("notifications", "GET", "admin"))).json()).securityAlerts.length, 0);
    });
  } finally {
    await prisma.$disconnect();
    rmSync(directory, { recursive: true, force: true });
  }
});
