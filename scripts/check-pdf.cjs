// Browser-only PDF check with mocked APIs; no clinic records are written.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const assert = require("node:assert/strict");
const fs = require("node:fs");

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true });
  const page = await context.newPage();
  const user = {
    id: "test-doctor",
    name: "Dr. PDF Test",
    email: "doctor@example.test",
    role: "DOCTOR",
    permissions: ["patients", "clinical"],
  };
  const patient = {
    id: "test-patient",
    mrn: "TEST-360",
    firstName: "Ali",
    lastName: "Raza",
    dateOfBirth: "1988-04-14T00:00:00.000Z",
    gender: "Male",
    phone: "03001234567",
    nationalId: "3520212345671",
    bloodGroup: "B+",
    address: "Model Town, Lahore",
    emergencyContactName: "Sara Raza",
    emergencyContactRelation: "Spouse",
    emergencyContactPhone: "03007654321",
    chronicConditions: JSON.stringify(["Hypertension"]),
    vitals: [{
      id: "vital-1",
      encounterId: "encounter-1",
      recordedAt: "2026-09-26T08:30:00.000Z",
      systolicBP: 128,
      diastolicBP: 82,
      heartRate: 74,
      temperature: 36.8,
      spO2: 98,
      weightKg: 72,
      heightCm: 174,
      bmi: 23.8,
      bloodGlucose: 102,
      respiratoryRate: 16,
      painScore: 2,
      recordedBy: "Dr. PDF Test",
    }],
    encounters: [{
      id: "encounter-1",
      appointmentId: "appointment-1",
      encounterDate: "2026-09-26T08:30:00.000Z",
      status: "FINALIZED",
      doctor: { name: "Dr. PDF Test", department: "General Medicine" },
      chiefComplaint: "Headache",
      hpi: "Mild headache for two days.",
      physicalExam: "Stable and comfortable.",
      assessmentPlan: "Hydration and symptomatic treatment.",
      clinicalNotes: "Review if symptoms persist.",
      followUpDate: "2026-10-03T00:00:00.000Z",
      diagnoses: [{ id: "diagnosis-1", description: "Tension headache", type: "PRIMARY" }],
    }],
    prescriptions: [{
      id: "prescription-1",
      createdAt: "2026-09-26T08:45:00.000Z",
      status: "PENDING",
      doctor: { name: "Dr. PDF Test" },
      items: [{ id: "item-1", medicationName: "Paracetamol 500mg", dosage: "500 mg", frequency: "Twice daily", duration: "3 days", route: "Oral", quantity: 6, instructions: "After food" }],
    }],
    invoices: [{
      id: "invoice-1",
      encounterId: "encounter-1",
      invoiceNumber: "INV-TEST-360",
      createdAt: "2026-09-26T08:50:00.000Z",
      totalAmount: 1500,
      paidAmount: 1500,
      status: "PAID",
      items: [{ description: "Consultation", category: "CONSULTATION", quantity: 1, unitPrice: 1500, totalPrice: 1500 }],
      payments: [{ id: "payment-1", method: "CASH", amount: 1500, receivedAt: "2026-09-26T08:50:00.000Z", receivedBy: "Reception", reference: "" }],
    }],
  };

  await context.addInitScript(value => sessionStorage.setItem("cims-user", JSON.stringify(value)), user);
  await page.route("https://fonts.googleapis.com/**", route => route.abort());
  await page.route("**/api/**", async route => {
    const url = new URL(route.request().url());
    if (url.pathname === "/api/patients/test-patient") {
      return route.fulfill({ contentType: "application/json", body: JSON.stringify({ success: true, patient }) });
    }
    if (url.pathname === "/api/notifications") {
      return route.fulfill({ contentType: "application/json", body: JSON.stringify({ success: true, workflowAlerts: [], securityAlerts: [], total: 0, isPrivileged: false }) });
    }
    return route.fulfill({ contentType: "application/json", body: JSON.stringify({ success: true }) });
  });

  try {
    await page.goto(`${process.env.CIMS_TEST_URL || "http://localhost:3000"}/patients/test-patient`, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.getByRole("heading", { name: "Ali Raza" }).waitFor();
    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "Print Patient 360 PDF" }).click();
    const download = await downloadPromise;
    assert.equal(download.suggestedFilename(), "patient-360-TEST-360.pdf");
    const downloadedPath = await download.path();
    assert.ok(downloadedPath, "Expected a downloaded PDF path.");
    const pdf = fs.readFileSync(downloadedPath);
    assert.equal(pdf.subarray(0, 5).toString("ascii"), "%PDF-");
    assert.ok(pdf.length > 5000, `Expected a populated PDF, received ${pdf.length} bytes.`);
    console.log(`PDF check passed: ${download.suggestedFilename()} is a valid ${pdf.length}-byte PDF generated from Patient 360.`);
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
