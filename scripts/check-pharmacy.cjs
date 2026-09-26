// Browser-only pharmacy checks with mocked APIs; no clinic records are written.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const assert = require("node:assert/strict");

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: "reduce" });
  const page = await context.newPage();
  const user = { id: "test-pharmacist", name: "Test Pharmacist", email: "pharmacy@example.test", role: "PHARMACIST", permissions: ["pharmacy"] };
  const medications = [
    { id: "syrup", brandName: "Cough Calm", genericName: "Dextromethorphan", form: "Syrup", strength: "120 mg/5 ml", stockUnit: "SYRUP_BOTTLE", stockQuantity: 12, minStockLevel: 3, unitPrice: 250, batchNumber: "SY-1", manufacturer: "Clinic Pharma", expiryDate: "2028-12-31T07:00:00.000Z" },
    { id: "tablet", brandName: "Pain Away", genericName: "Paracetamol", form: "Tablet", strength: "500 mg", stockUnit: "PIECE", stockQuantity: 80, minStockLevel: 10, unitPrice: 5, batchNumber: "TB-1", manufacturer: "Clinic Pharma", expiryDate: null },
  ];
  let stockRequest;
  await context.addInitScript(value => sessionStorage.setItem("cims-user", JSON.stringify(value)), user);
  await page.route("https://fonts.googleapis.com/**", route => route.abort());
  await page.route("**/api/**", async route => {
    const url = new URL(route.request().url());
    if (url.pathname === "/api/pharmacy" && route.request().method() === "POST") {
      stockRequest = route.request().postDataJSON();
      return route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify({ success: true, created: true, medication: { id: "new-med", ...stockRequest, stockQuantity: Number(stockRequest.quantity) } }) });
    }
    if (url.pathname === "/api/pharmacy") return route.fulfill({ contentType: "application/json", body: JSON.stringify({ success: true, medications, prescriptions: [], sales: [], movements: [], dailySales: [], dailyMovements: [] }) });
    if (url.pathname === "/api/notifications") return route.fulfill({ contentType: "application/json", body: JSON.stringify({ success: true, workflowAlerts: [], securityAlerts: [], total: 0, isPrivileged: false }) });
    return route.fulfill({ contentType: "application/json", body: JSON.stringify({ success: true }) });
  });
  try {
    await page.goto(`${process.env.CIMS_TEST_URL || "http://localhost:3000"}/pharmacy`, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.getByRole("button", { name: "Stock", exact: true }).click();
    const stockSearch = page.getByLabel("Search medicine stock");
    await stockSearch.fill("cough");
    await page.getByText("Cough Calm 120 mg/5 ml", { exact: true }).waitFor();
    assert.equal(await page.getByText("Pain Away 500 mg", { exact: true }).count(), 0);
    await page.getByRole("button", { name: "Clear" }).click();

    await page.getByLabel("Medicine name *").fill("New Syrup");
    await page.getByLabel("Generic name").fill("Test generic");
    await page.getByLabel("Form *").fill("Syrup");
    await page.getByLabel("Strength *").fill("100 mg/5 ml");
    await page.getByLabel("Count change *").fill("15");
    await page.getByLabel("Price per unit (PKR) *").fill("300");
    await page.getByRole("button", { name: "Stock package unit" }).click();
    await page.getByRole("option", { name: "Syrup bottles" }).click();
    await page.getByRole("button", { name: "Add to stock" }).click();
    await page.getByText(/added to stock and is now available for sale/i).waitFor();
    assert.equal(stockRequest.brandName, "New Syrup");
    assert.equal(stockRequest.stockUnit, "SYRUP_BOTTLE");

    await page.getByRole("button", { name: "Medicine Sale", exact: true }).click();
    await page.getByLabel("Search medicine for sale").fill("Cough");
    await page.getByRole("option", { name: /Cough Calm/ }).click();
    assert.match(await page.getByRole("button", { name: "Package unit 1" }).innerText(), /Syrup bottles/);
    await page.getByLabel("Count 1").fill("2");
    assert.equal(await page.getByText("PKR 500", { exact: true }).count() > 0, true);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth), false);
    console.log("Pharmacy checks passed: general stock search, manual stock entry, package-unit selection, searchable selling, and responsive layout.");
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
