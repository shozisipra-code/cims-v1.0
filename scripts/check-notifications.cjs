// Browser-only notification checks with mocked APIs; no clinic records are written.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const assert = require("node:assert/strict");

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 850 }, reducedMotion: "reduce" });
  const page = await context.newPage();
  const errors = [];
  const user = { id: "notification-admin", name: "Notification Admin", email: "admin@example.test", role: "SUPER_USER", permissions: ["dashboard", "appointments", "patient_calling", "patients", "clinical", "users", "audit_log"] };
  let tickets = [{ id: "ticket-1", title: "Patient ticket #7 issued", message: "A patient is waiting for consultation.", href: "/appointments", createdAt: new Date().toISOString() }];
  let securityAlerts = [{ id: "security-1", username: "unknown-user", ipAddress: "10.0.0.8", failedCount: 3, updatedAt: new Date().toISOString() }];

  page.on("pageerror", error => errors.push(error.message));
  await page.route("https://fonts.googleapis.com/**", route => route.abort());
  await page.route("**/api/**", async route => {
    const url = new URL(route.request().url());
    if (url.pathname === "/api/notifications") {
      if (route.request().method() === "PATCH") {
        const body = route.request().postDataJSON();
        if (body.action === "READ_TICKET") tickets = tickets.filter(item => item.id !== body.id);
        if (body.action === "READ_ALL_TICKETS") tickets = [];
        if (body.action === "READ_SECURITY") securityAlerts = securityAlerts.filter(item => item.id !== body.id);
        if (body.action === "READ_ALL_SECURITY") securityAlerts = [];
        return route.fulfill({ contentType: "application/json", body: JSON.stringify({ success: true }) });
      }
      return route.fulfill({ contentType: "application/json", body: JSON.stringify({ success: true, tickets, securityAlerts, isPrivileged: true, total: tickets.length + securityAlerts.length }) });
    }
    if (url.pathname === "/api/dashboard/stats") return route.fulfill({ contentType: "application/json", body: JSON.stringify({ success: true, stats: { totalPatients: 0, todayAppointments: 0, waitingQueue: 0, inConsultation: 0, financials: { totalBilled: 0, totalCollected: 0, outstandingBalance: 0 } }, recentAuditLogs: [] }) });
    if (url.pathname === "/api/appointments") return route.fulfill({ contentType: "application/json", body: JSON.stringify({ success: true, appointments: [] }) });
    return route.fulfill({ contentType: "application/json", body: JSON.stringify({ success: true }) });
  });

  try {
    const baseUrl = process.env.CIMS_TEST_URL || "http://localhost:3000";
    await page.goto(`${baseUrl}/login`, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.evaluate(value => { sessionStorage.setItem("cims-user", JSON.stringify(value)); localStorage.setItem("cims-theme", "light"); }, user);
    await page.goto(`${baseUrl}/`, { waitUntil: "domcontentloaded", timeout: 60000 });
    const bell = page.getByRole("button", { name: /unread notifications/ });
    await bell.waitFor();
    await page.waitForFunction(() => document.querySelector(".notification-trigger")?.getAttribute("aria-label") === "2 unread notifications");
    assert.equal(await bell.getAttribute("aria-label"), "2 unread notifications");
    await bell.click();
    await page.getByRole("dialog", { name: "Notifications" }).waitFor();
    await page.getByText("Patient ticket #7 issued", { exact: true }).waitFor();
    await page.getByRole("tab", { name: /Security 1/ }).click();
    await page.getByText("3 failed sign-in attempts", { exact: true }).waitFor();
    await page.getByText("Account: unknown-user", { exact: false }).waitFor();
    await page.getByRole("button", { name: "Dismiss security alert" }).click();
    await page.getByText("No unread security alerts", { exact: true }).waitFor();

    await bell.click();
    tickets = [{ id: "ticket-2", title: "Patient ticket #7 called", message: "The patient has been called into the doctor's room.", href: "/appointments", createdAt: new Date().toISOString() }, ...tickets];
    await page.evaluate(() => window.dispatchEvent(new Event("cims:notifications-refresh")));
    await page.getByText("Patient ticket #7 called", { exact: true }).waitFor();
    assert.equal(await page.getByRole("button", { name: "2 unread notifications" }).count(), 1);
    assert.deepEqual(errors, []);

    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole("button", { name: "2 unread notifications" }).click();
    await page.getByRole("dialog", { name: "Notifications" }).waitFor();
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth), false, "Notification panel must not overflow mobile viewport");
    console.log("Notification checks passed: badge, patient-ticket feed, live pop-up, privileged security feed, dismiss, and mobile layout.");
  } catch (error) {
    console.error("Current URL:", page.url());
    console.error("Page errors:", errors);
    console.error("Visible page text:\n", (await page.locator("body").innerText()).slice(0, 2500));
    throw error;
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
