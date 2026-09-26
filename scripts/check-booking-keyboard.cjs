// Browser-only booking checks with mocked APIs; no clinic records are written.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const assert = require("node:assert/strict");

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: "reduce" });
  const page = await context.newPage();
  const user = { id: "keyboard-user", name: "Keyboard Tester", email: "keyboard@example.test", role: "RECEPTIONIST", permissions: ["dashboard", "booking", "appointments", "patient_calling", "patients"] };
  await context.addInitScript(value => sessionStorage.setItem("cims-user", JSON.stringify(value)), user);
  await page.route("https://fonts.googleapis.com/**", route => route.abort());
  const existingPatient = { id: "existing-patient", mrn: "CIMS-TEST-1", firstName: "Existing", lastName: "Patient", phone: "03001234567", nationalId: "3520212345671" };
  await page.route("**/api/**", route => route.fulfill({ contentType: "application/json", body: JSON.stringify({ success: true, patients: [existingPatient] }) }));

  const focused = async locator => {
    const element = await locator.elementHandle();
    assert.ok(element);
    await page.waitForFunction(target => target === document.activeElement, element, { timeout: 2000 });
  };
  const chooseCurrentAndAdvance = async locator => { await locator.press("Enter"); await locator.press("Enter"); };
  try {
    await page.goto(`${process.env.CIMS_TEST_URL || "http://localhost:3000"}/booking`, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForTimeout(750);
    await page.getByRole("button", { name: "Future appointment" }).click();
    assert.equal(await page.getByLabel("Appointment date").isVisible(), true);
    assert.equal(await page.getByLabel("Appointment time").isVisible(), true);
    await page.getByRole("button", { name: "Today / walk-in" }).click();
    const patientSearch = page.getByPlaceholder("Name, MRN, phone, or CNIC");
    await patientSearch.fill("Existing");
    await patientSearch.press("Enter");
    await focused(page.locator("form .cims-select-trigger").first());
    assert.equal(await page.getByText(/Selected: Existing Patient/).isVisible(), true);
    await page.getByRole("button", { name: "Register new patient" }).click();

    const phone = page.locator("input[aria-describedby='booking-phone-limit']");
    const cnic = page.locator("input[aria-describedby='booking-cnic-limit']");
    await phone.fill("0333333333333333333");
    await cnic.fill("3520212345671123456");
    assert.equal(await phone.inputValue(), "03333333333");
    assert.equal(await cnic.inputValue(), "3520212345671");
    assert.equal(await phone.getAttribute("maxlength"), "11");
    assert.equal(await cnic.getAttribute("maxlength"), "13");

    const selects = page.locator("form .cims-select-trigger");
    const name = page.getByPlaceholder("Full patient name");
    const relation = page.getByPlaceholder("Father or husband name");
    const age = page.getByPlaceholder("Age");
    const reason = page.getByPlaceholder("e.g. Fever, follow-up, BP check");
    const amount = page.getByPlaceholder("0", { exact: true });
    const description = page.getByLabel("Charge description");
    const reference = page.getByPlaceholder("Bank, card, Raast or wallet reference");
    const note = page.getByPlaceholder("Custom note for this receipt");
    const address = page.getByPlaceholder("Street, city, district");
    const submit = page.getByRole("button", { name: "Register & check in" });

    await selects.nth(0).focus();
    await chooseCurrentAndAdvance(selects.nth(0)); await focused(name);
    await name.press("Enter"); await focused(relation);
    await relation.press("Enter"); await focused(age);
    await age.press("Enter"); await focused(selects.nth(1));
    await chooseCurrentAndAdvance(selects.nth(1)); await focused(selects.nth(2));
    await chooseCurrentAndAdvance(selects.nth(2)); await focused(phone);
    await phone.press("Enter"); await focused(cnic);
    await cnic.press("Enter"); await focused(address);
    await address.press("Enter"); await focused(selects.nth(3));
    await chooseCurrentAndAdvance(selects.nth(3)); await focused(reason);
    await reason.press("Enter"); await focused(amount);
    await amount.press("Enter"); await focused(selects.nth(4));
    await chooseCurrentAndAdvance(selects.nth(4)); await focused(description);
    await description.press("Enter"); await focused(reference);
    await reference.press("Enter"); await focused(note);
    await note.press("Enter"); await focused(submit);

    console.log("Booking checks passed: schedule controls, existing-patient selection, phone/CNIC digit limits, and Enter navigation through every visible field and dropdown.");
  } catch (error) {
    console.error("Current URL:", page.url());
    console.error("Visible page text:\n", (await page.locator("body").innerText()).slice(0, 2500));
    throw error;
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
