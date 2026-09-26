import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtempSync, rmSync, openSync, closeSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, basename } from "node:path";
import { execFileSync } from "node:child_process";
import { NextRequest } from "next/server";

test("doctor consultation lifecycle uses an isolated database", async t => {
  const directory = mkdtempSync(join(tmpdir(), "cims-consultation-test-"));
  process.env.DATABASE_URL = `file:${join(directory, "test.db").replaceAll("\\", "/")}`;
  closeSync(openSync(join(directory, "test.db"), "w"));
  execFileSync(process.execPath, [resolve("../node_modules/prisma/build/index.js"), "db", "push", "--skip-generate", "--schema", resolve("prisma/schema.prisma")], { env: process.env, stdio: "pipe" });
  const { prisma } = await import("../src/lib/db/prisma");
  const encounters = await import("../src/app/api/encounters/route");
  const appointments = await import("../src/app/api/appointments/route");
  const patients = await import("../src/app/api/patients/[id]/route");
  const vitals = await import("../src/app/api/vitals/route");
  const diagnoses = await import("../src/app/api/diagnoses/route");
  const prescriptions = await import("../src/app/api/prescriptions/route");
  function req(path: string, method: string, body?: unknown, actor = "doctor") {
    return new NextRequest(`http://localhost/api/${path}`, { method, headers: { "Content-Type": "application/json", "x-cims-user-id": actor }, ...(body ? { body: JSON.stringify(body) } : {}) });
  }
  try {
    await prisma.user.create({ data: { id: "doctor", name: "Test Doctor", email: "doctor@example.test", role: "DOCTOR" } });
    await prisma.user.create({ data: { id: "other-doctor", name: "Other Doctor", email: "other-doctor@example.test", role: "DOCTOR" } });
    await prisma.user.create({ data: { id: "desk", name: "Test Desk", email: "desk@example.test", role: "RECEPTIONIST" } });
    for (const number of [1, 2]) {
      await prisma.patient.create({ data: { id: `patient${number}`, mrn: `TEST-${number}`, firstName: "Test", lastName: `Patient ${number}`, gender: "Male", dateOfBirth: new Date("1990-01-01"), phone: "+923001234567" } });
      await prisma.appointment.create({ data: { id: `appointment${number}`, patientId: `patient${number}`, doctorId: "doctor", scheduledAt: new Date(), tokenNumber: number, status: "WAITING", reason: "Test complaint" } });
    }
    let visit: any;
    let draft: any;
    await t.test("only clinical staff can open, and patient/appointment identities must match", async () => {
      assert.equal((await encounters.POST(req("encounters", "POST", { patientId: "patient1", appointmentId: "appointment1" }, "desk"))).status, 403);
      assert.equal((await encounters.POST(req("encounters", "POST", { patientId: "patient1", appointmentId: "appointment1" }, "other-doctor"))).status, 403);
      assert.equal((await encounters.POST(req("encounters", "POST", { patientId: "patient2", appointmentId: "appointment1" }))).status, 404);
      assert.equal(await prisma.encounter.count(), 0);
    });
    await t.test("calling and repeated opening create one encounter", async () => {
      assert.equal((await appointments.PATCH(req("appointments", "PATCH", { action: "CALL", id: "appointment1" }))).status, 200);
      const [response, reopened] = await Promise.all([
        encounters.POST(req("encounters", "POST", { patientId: "patient1", appointmentId: "appointment1" })),
        encounters.POST(req("encounters", "POST", { patientId: "patient1", appointmentId: "appointment1" })),
      ]);
      assert.equal(response.status, 200); visit = (await response.json()).encounter;
      assert.equal(reopened.status, 200);
      assert.equal((await reopened.json()).encounter.id, visit.id);
      assert.equal(await prisma.encounter.count(), 1);
      assert.equal(visit.physicalExam, null);
      assert.equal(visit.vitals.length, 0);
    });
    await t.test("next patient and direct completion cannot bypass consultation", async () => {
      assert.equal((await appointments.PATCH(req("appointments", "PATCH", { action: "CALL_NEXT" }))).status, 409);
      assert.equal((await appointments.PATCH(req("appointments", "PATCH", { id: "appointment1", status: "COMPLETED" }))).status, 403);
      assert.equal((await encounters.POST(req("encounters", "POST", { patientId: "patient2", appointmentId: "appointment2" }))).status, 409);
      assert.equal((await prisma.appointment.findUniqueOrThrow({ where: { id: "appointment1" } })).status, "IN_CONSULTATION");
    });
    await t.test("draft persists all fields without issuing medicines", async () => {
      draft = { id: visit.id, revision: visit.revision, status: "IN_PROGRESS", chiefComplaint: "Headache", hpi: "Since yesterday", clinicalNotes: "Visit note", physicalExam: "Recorded examination", diagnosis: "Test diagnosis", assessmentPlan: "Test advice", followUpDate: "2027-01-20", vitals: { systolicBP: "120", diastolicBP: "80", temperature: "37", weightKg: "70", heightCm: "175", painScore: "0", notes: "Seated" }, prescriptionItems: [{ medicationName: "Test medicine", dosage: "Test dose", frequency: "Test schedule", duration: "Test duration", instructions: "Test instructions", quantity: 2 }] };
      assert.equal((await encounters.PATCH(req("encounters", "PATCH", draft, "other-doctor"))).status, 403);
      assert.equal((await prisma.encounter.findUniqueOrThrow({ where: { id: visit.id } })).revision, visit.revision);
      const response = await encounters.PATCH(req("encounters", "PATCH", draft));
      assert.equal(response.status, 200); visit = (await response.json()).encounter;
      assert.equal(visit.vitals[0].patientId, "patient1");
      assert.equal(visit.vitals[0].encounterId, visit.id);
      assert.equal(visit.vitals[0].painScore, 0);
      assert.equal(visit.vitals[0].heartRate, null);
      assert.equal(visit.vitals[0].recordedBy, "Test Doctor");
      assert.equal(visit.vitals[0].bmi, 22.9);
      assert.equal(JSON.parse(visit.draftData).prescriptionItems[0].quantity, 2);
      assert.equal(await prisma.prescription.count(), 0);
      const resumed = (await (await encounters.POST(req("encounters", "POST", { patientId: "patient1" }))).json()).encounter;
      assert.equal(resumed.clinicalNotes, "Visit note");
      assert.equal(resumed.revision, visit.revision);
    });
    await t.test("stale saves and invalid measurements preserve the saved draft", async () => {
      assert.equal((await encounters.PATCH(req("encounters", "PATCH", draft))).status, 409);
      assert.equal((await encounters.PATCH(req("encounters", "PATCH", { ...draft, revision: visit.revision, vitals: { spO2: 101 } }))).status, 400);
      assert.equal((await prisma.encounter.findUniqueOrThrow({ where: { id: visit.id } })).revision, visit.revision);
      const response = await encounters.PATCH(req("encounters", "PATCH", { ...draft, revision: visit.revision, clinicalNotes: "Updated draft" }));
      assert.equal(response.status, 200); visit = (await response.json()).encounter;
      assert.equal(await prisma.vitals.count(), 1);
    });
    await t.test("invalid finish cannot complete the queue or issue a partial prescription", async () => {
      assert.equal((await encounters.PATCH(req("encounters", "PATCH", { ...draft, revision: visit.revision, status: "FINALIZED", chiefComplaint: "" }))).status, 400);
      assert.equal((await encounters.PATCH(req("encounters", "PATCH", { ...draft, revision: visit.revision, status: "FINALIZED", prescriptionItems: [{ ...draft.prescriptionItems[0], dosage: "" }] }))).status, 400);
      assert.equal((await prisma.appointment.findUniqueOrThrow({ where: { id: "appointment1" } })).status, "IN_CONSULTATION");
      assert.equal(await prisma.prescription.count(), 0);
    });
    await t.test("a database error during finish rolls back notes, vitals and queue", async () => {
      await prisma.$executeRawUnsafe(`CREATE TRIGGER test_fail_prescription BEFORE INSERT ON Prescription BEGIN SELECT RAISE(ABORT, 'TEST_FAILURE'); END`);
      const response = await encounters.PATCH(req("encounters", "PATCH", { ...draft, revision: visit.revision, status: "FINALIZED", clinicalNotes: "Should roll back" }));
      assert.equal(response.status, 500);
      const unchanged = await prisma.encounter.findUniqueOrThrow({ where: { id: visit.id } });
      assert.equal(unchanged.clinicalNotes, "Updated draft");
      assert.equal(unchanged.revision, visit.revision);
      assert.equal(unchanged.status, "IN_PROGRESS");
      assert.equal((await prisma.appointment.findUniqueOrThrow({ where: { id: "appointment1" } })).status, "IN_CONSULTATION");
      await prisma.$executeRawUnsafe("DROP TRIGGER test_fail_prescription");
    });
    await t.test("finish is atomic and repeated requests do not duplicate entries", async () => {
      const final = { ...draft, revision: visit.revision, status: "FINALIZED" };
      const response = await encounters.PATCH(req("encounters", "PATCH", final));
      assert.equal(response.status, 200); visit = (await response.json()).encounter;
      assert.equal(visit.status, "FINALIZED");
      assert.equal(visit.draftData, null);
      assert.equal((await encounters.PATCH(req("encounters", "PATCH", final))).status, 200);
      assert.equal(await prisma.prescription.count(), 1);
      assert.equal(await prisma.diagnosis.count(), 1);
      assert.equal(await prisma.vitals.count(), 1);
      assert.equal((await prisma.appointment.findUniqueOrThrow({ where: { id: "appointment1" } })).status, "COMPLETED");
      assert.equal(await prisma.notification.count({ where: { appointmentId: "appointment1", title: { contains: "completed" } } }), 1);
      assert.equal((await encounters.PATCH(req("encounters", "PATCH", { ...draft, revision: visit.revision }))).status, 409);

      const handoffCount = await prisma.notification.count({ where: { appointmentId: "appointment1", type: { in: ["CONSULTATION_COMPLETED", "BILLING_REVIEW_REQUIRED", "PRESCRIPTION_READY"] } } });
      const correction = {
        ...draft,
        revision: visit.revision,
        status: "FINALIZED",
        clinicalNotes: "Corrected visit note",
        diagnosis: "Corrected diagnosis",
        vitals: { ...draft.vitals, systolicBP: "122" },
        prescriptionItems: [{ ...draft.prescriptionItems[0], dosage: "Corrected dose" }],
      };
      const correctedResponse = await encounters.PATCH(req("encounters", "PATCH", correction));
      assert.equal(correctedResponse.status, 200);
      visit = (await correctedResponse.json()).encounter;
      assert.equal(visit.status, "FINALIZED");
      assert.equal(visit.clinicalNotes, "Corrected visit note");
      assert.equal(visit.vitals[0].systolicBP, 122);
      assert.equal(visit.diagnoses[0].description, "Corrected diagnosis");
      assert.equal(visit.prescriptions[0].items[0].dosage, "Corrected dose");
      assert.equal(await prisma.notification.count({ where: { appointmentId: "appointment1", type: { in: ["CONSULTATION_COMPLETED", "BILLING_REVIEW_REQUIRED", "PRESCRIPTION_READY"] } } }), handoffCount);
      assert.equal(await prisma.auditLog.count({ where: { resourceId: visit.id, action: "CORRECT" } }), 1);
      assert.equal(await prisma.notification.count({ where: { appointmentId: "appointment1", type: "PRESCRIPTION_UPDATED", audience: "PHARMACY" } }), 1);
      assert.equal((await encounters.PATCH(req("encounters", "PATCH", correction))).status, 200);
      assert.equal((await encounters.PATCH(req("encounters", "PATCH", { ...correction, clinicalNotes: "Conflicting stale correction" }))).status, 409);
      const reopened = await encounters.POST(req("encounters", "POST", { patientId: "patient1", appointmentId: "appointment1" }));
      assert.equal(reopened.status, 200);
      assert.equal((await reopened.json()).encounter.id, visit.id);
    });
    await t.test("dispensed medicine is immutable while other corrections remain safe", async () => {
      await prisma.prescription.updateMany({ where: { encounterId: visit.id }, data: { status: "DISPENSED", dispensedAt: new Date(), dispensedBy: "Test Pharmacy" } });
      const noteOnly = { ...draft, revision: visit.revision, status: "FINALIZED", clinicalNotes: "Safe note after dispensing", diagnosis: "Corrected diagnosis", vitals: { ...draft.vitals, systolicBP: "122" }, prescriptionItems: [{ ...draft.prescriptionItems[0], dosage: "Corrected dose" }] };
      const noteResponse = await encounters.PATCH(req("encounters", "PATCH", noteOnly));
      assert.equal(noteResponse.status, 200);
      visit = (await noteResponse.json()).encounter;
      const beforeRejectedChange = await prisma.encounter.findUniqueOrThrow({ where: { id: visit.id }, include: { diagnoses: true, vitals: true } });
      const rejected = await encounters.PATCH(req("encounters", "PATCH", { ...noteOnly, revision: visit.revision, clinicalNotes: "Must roll back", diagnosis: "Must roll back", vitals: { ...noteOnly.vitals, systolicBP: "199" }, prescriptionItems: [{ ...noteOnly.prescriptionItems[0], dosage: "Unsafe changed dose" }] }));
      assert.equal(rejected.status, 409);
      const afterRejectedChange = await prisma.encounter.findUniqueOrThrow({ where: { id: visit.id }, include: { diagnoses: true, vitals: true } });
      assert.equal(afterRejectedChange.revision, beforeRejectedChange.revision);
      assert.equal(afterRejectedChange.clinicalNotes, beforeRejectedChange.clinicalNotes);
      assert.equal(afterRejectedChange.diagnoses[0].description, beforeRejectedChange.diagnoses[0].description);
      assert.equal(afterRejectedChange.vitals[0].systolicBP, beforeRejectedChange.vitals[0].systolicBP);
    });
    await t.test("patient 360 contains visit data with no allergy field", async () => {
      const response = await patients.GET(req("patients/patient1", "GET"), { params: Promise.resolve({ id: "patient1" }) });
      const patient = (await response.json()).patient;
      assert.equal(Object.hasOwn(patient, "allergies"), false);
      assert.equal(patient.encounters[0].clinicalNotes, "Safe note after dispensing");
      assert.equal(patient.encounters[0].followUpDate.slice(0, 10), "2027-01-20");
      assert.equal(patient.vitals[0].encounterId, visit.id);
      assert.equal(patient.prescriptions[0].items[0].medicationName, "Test medicine");
      assert.equal(patient.prescriptions[0].items[0].dosage, "Corrected dose");
    });
    await t.test("next visit starts fresh and history cannot be mutated through old endpoints", async () => {
      assert.equal((await appointments.PATCH(req("appointments", "PATCH", { action: "CALL_NEXT" }))).status, 200);
      const next = (await (await encounters.POST(req("encounters", "POST", { patientId: "patient2", appointmentId: "appointment2" }))).json()).encounter;
      assert.notEqual(next.id, visit.id);
      assert.equal(next.vitals.length, 0);
      assert.equal(next.clinicalNotes, null);
      assert.equal((await vitals.POST()).status, 409);
      assert.equal((await diagnoses.POST()).status, 409);
      assert.equal((await diagnoses.DELETE()).status, 409);
      assert.equal((await prescriptions.POST()).status, 409);
    });
  } finally {
    await prisma.$disconnect();
    if (basename(directory).startsWith("cims-consultation-test-") && resolve(directory).startsWith(resolve(tmpdir()))) rmSync(directory, { recursive: true, force: true });
  }
});
