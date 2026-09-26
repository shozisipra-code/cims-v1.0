// Browser verification against mocked API data; never writes to clinic records.
// Set PLAYWRIGHT_MODULE to a local Playwright installation if it isn't installed here.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const assert = require("node:assert/strict");
const { mkdirSync } = require("node:fs");
const { join } = require("node:path");

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: "reduce" });
  const page = await context.newPage();
  const user = { id: "test-doctor", name: "Test Doctor", email: "test@example.test", role: "DOCTOR", permissions: ["dashboard", "patients", "clinical", "appointments", "patient_calling"] };
  const patient = { id: "test-patient", firstName: "Test", lastName: "Patient", mrn: "TEST-360", dateOfBirth: "1980-01-01", gender: "Male", phone: "03001234567", chronicConditions: '["Recorded condition"]', vitals: [], encounters: [], prescriptions: [], invoices: [], appointments: [] };
  const appointment = { id: "test-appointment", patientId: patient.id, patient, doctorId: user.id, tokenNumber: 3, status: "IN_CONSULTATION", department: "General Practice", scheduledAt: new Date().toISOString(), type: "OPD" };
  let encounter = { id: "test-visit", patientId: patient.id, appointmentId: appointment.id, doctor: user, appointment, revision: 0, status: "IN_PROGRESS", encounterDate: new Date().toISOString(), updatedAt: new Date().toISOString(), vitals: [], diagnoses: [], prescriptions: [], chiefComplaint: "", clinicalNotes: "", draftData: null };
  let saveCount = 0;
  let delayNextSave = 0;
  let failNextSave = false;
  let forceConflict = false;
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.route("https://fonts.googleapis.com/**", route => route.abort());
  await context.addInitScript(value => { sessionStorage.setItem("cims-user", JSON.stringify(value)); localStorage.setItem("cims-theme", "light"); }, user);
  await page.route("**/api/**", async route => {
    const url = new URL(route.request().url());
    const method = route.request().method();
    let result;
    if (url.pathname === "/api/encounters" && method === "POST") result = { success: true, encounter };
    else if (url.pathname === "/api/encounters" && method === "PATCH") {
      const body = route.request().postDataJSON();
      const delay = delayNextSave; delayNextSave = 0;
      if (delay) await new Promise(resolve => setTimeout(resolve, delay));
      if (failNextSave || forceConflict) {
        const conflict = forceConflict; failNextSave = false;
        return route.fulfill({ status: conflict ? 409 : 500, contentType: "application/json", body: JSON.stringify({ success: false, error: conflict ? "This visit was updated in another window. Reload the visit before making more changes." : "Test save failure. Please retry." }) });
      }
      assert.equal(body.revision, encounter.revision, "Saves must be serialized using the latest revision");
      saveCount++;
      encounter = { ...encounter, ...body, revision: encounter.revision + 1, updatedAt: new Date().toISOString(), vitals: [{ ...body.vitals, id: "test-vitals", patientId: patient.id, encounterId: encounter.id, recordedAt: new Date().toISOString(), recordedBy: user.name }], draftData: JSON.stringify({ diagnosis: body.diagnosis, prescriptionItems: body.prescriptionItems }) };
      if (body.status === "FINALIZED") {
        encounter.draftData = null;
        encounter.diagnoses = body.diagnosis ? [{ id: "test-diagnosis", description: body.diagnosis, type: "FINAL" }] : [];
        appointment.status = "COMPLETED";
      }
      patient.encounters = [encounter]; patient.vitals = encounter.vitals;
      result = { success: true, encounter };
    } else if (url.pathname === `/api/patients/${patient.id}`) result = { success: true, patient: { ...patient, encounters: patient.encounters.map(visit => ({ ...visit, appointment: undefined })) } };
    else if (url.pathname === "/api/appointments") result = { success: true, appointments: [appointment] };
    else result = { success: true };
    // Omit cyclic mock references (real API returns plain patient snapshots).
    await route.fulfill({ contentType: "application/json", body: JSON.stringify(result, (key, value) => key === "appointment" && value ? { ...value, patient: undefined } : value) });
  });
  const visitUrl = `${process.env.CIMS_TEST_URL || "http://localhost:3000"}/clinical?patientId=${patient.id}&appointmentId=${appointment.id}`;
  try {
    await page.goto(visitUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.getByLabel("Systolic BP (mmHg)").waitFor();
    assert.equal(await page.getByLabel("Systolic BP (mmHg)").inputValue(), "");
    assert.equal(await page.getByLabel("Examination findings").inputValue(), "");
    assert.equal(await page.getByText(/allerg/i).count(), 0);
    await page.getByLabel("Chief complaint *", { exact: true }).fill("Browser test complaint");
    await page.getByLabel("Systolic BP (mmHg)").fill("125");
    await page.getByLabel("Pain score (/10)").fill("0");
    await page.getByLabel("Clinical notes", { exact: true }).fill("Draft survives refresh");
    await page.getByLabel("Follow-up date").fill("2027-02-01");
    await page.getByRole("button", { name: "Add medicine" }).click();
    await page.getByLabel("Medicine name 1", { exact: true }).fill("Test medicine");
    await page.getByLabel("Dosage 1", { exact: true }).fill("Test dosage");
    await page.getByLabel("Frequency 1", { exact: true }).fill("Test frequency");
    await page.getByLabel("Duration 1", { exact: true }).fill("Test duration");
    await page.getByText("Draft saved", { exact: true }).waitFor();
    assert.ok(saveCount > 0);
    await page.reload();
    await page.getByLabel("Systolic BP (mmHg)").waitFor();
    assert.equal(await page.getByLabel("Systolic BP (mmHg)").inputValue(), "125");
    assert.equal(await page.getByLabel("Pain score (/10)").inputValue(), "0");
    assert.equal(await page.getByLabel("Clinical notes", { exact: true }).inputValue(), "Draft survives refresh");
    assert.equal(await page.getByLabel("Medicine name 1", { exact: true }).inputValue(), "Test medicine");
    assert.equal(await page.getByLabel("Follow-up date").inputValue(), "2027-02-01");
    delayNextSave = 1800;
    await page.getByLabel("Clinical notes", { exact: true }).fill("First edit while saving");
    await page.getByText("Saving draft…", { exact: true }).waitFor();
    await page.getByLabel("Clinical notes", { exact: true }).fill("Latest edit must win");
    await page.getByText("Draft saved", { exact: true }).waitFor();
    assert.equal(encounter.clinicalNotes, "Latest edit must win");
    failNextSave = true;
    await page.getByLabel("Plan and advice").fill("Retry this plan");
    await page.getByRole("alert").filter({ hasText: "Test save failure" }).waitFor();
    assert.equal(await page.getByLabel("Plan and advice").inputValue(), "Retry this plan");
    await page.getByRole("button", { name: "Save Draft", exact: true }).click();
    await page.getByText("Draft saved", { exact: true }).waitFor();
    const artifactDirectory = join(__dirname, "..", ".artifacts", "consultation"); mkdirSync(artifactDirectory, { recursive: true });
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: join(artifactDirectory, "desktop.png"), fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth), false, "Mobile page must not overflow");
    await page.screenshot({ path: join(artifactDirectory, "mobile.png"), fullPage: true });
    await page.setViewportSize({ width: 1440, height: 1000 });
    delayNextSave = 1500;
    await page.getByLabel("Diagnosis", { exact: true }).fill("Browser diagnosis");
    await page.getByText("Saving draft…", { exact: true }).waitFor();
    await page.getByRole("button", { name: "Finish Consultation", exact: true }).click();
    await page.getByRole("heading", { name: "Consultation completed" }).waitFor();
    assert.equal(encounter.status, "FINALIZED");
    assert.equal(appointment.status, "COMPLETED");
    await page.getByRole("button", { name: "Edit consultation", exact: true }).click();
    await page.getByLabel("Clinical notes", { exact: true }).fill("Corrected after completion");
    await page.getByRole("button", { name: "Save corrections", exact: true }).click();
    await page.getByRole("heading", { name: "Consultation completed" }).waitFor();
    assert.equal(encounter.status, "FINALIZED");
    assert.equal(encounter.clinicalNotes, "Corrected after completion");
    assert.equal(appointment.status, "COMPLETED");
    await page.getByRole("link", { name: "View Patient 360", exact: true }).click();
    await page.getByRole("button", { name: /Clinical Visits/ }).click();
    await page.getByText("Corrected after completion", { exact: true }).waitFor();
    await page.getByText("Browser diagnosis (FINAL)", { exact: true }).waitFor();
    await page.getByText(/Follow-up:/).waitFor();
    await page.getByRole("button", { name: /Vitals History/ }).click();
    assert.equal(await page.getByRole("button", { name: /Record.*Vitals|Record New Reading/ }).count(), 0);
    assert.equal(await page.getByText(/allerg/i).count(), 0);
    assert.equal(errors.length, 0, errors.join("\n"));
    console.log("Browser checks passed: blank vitals, no allergies, autosave, refresh recovery, medicine and follow-up recovery, edits during saves, retry, responsive layout, finish during autosave, finalized corrections, and Patient 360 history.");
  } catch (error) {
    const directory = join(__dirname, "..", ".artifacts", "consultation"); mkdirSync(directory, { recursive: true });
    await page.screenshot({ path: join(directory, "failure.png"), fullPage: true });
    console.error("Browser page errors:", errors);
    throw error;
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
