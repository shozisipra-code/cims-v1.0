import assert from "node:assert/strict";
import { test } from "node:test";
import { closeSync, mkdtempSync, openSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { execFileSync } from "node:child_process";
import { NextRequest } from "next/server";

test("manual pharmacy inventory and packaged sales", async t => {
  const directory = mkdtempSync(join(tmpdir(), "cims-pharmacy-test-"));
  process.env.DATABASE_URL = `file:${join(directory, "test.db").replaceAll("\\", "/")}`;
  closeSync(openSync(join(directory, "test.db"), "w"));
  execFileSync(process.execPath, [resolve("../node_modules/prisma/build/index.js"), "db", "push", "--skip-generate", "--schema", resolve("prisma/schema.prisma")], { env: process.env, stdio: "pipe" });
  const { prisma } = await import("../src/lib/db/prisma");
  const pharmacy = await import("../src/app/api/pharmacy/route");
  const request = (method: string, body?: unknown, actor?: string) => new NextRequest("http://localhost/api/pharmacy", { method, headers: { "Content-Type": "application/json", ...(actor ? { "x-cims-user-id": actor } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
  const stockBody = {
    action: "STOCK",
    brandName: "Testol",
    genericName: "Test medicine",
    form: "Tablet",
    strength: "500 mg",
    stockUnit: "PILL_PACK",
    quantity: "20",
    minStockLevel: "5",
    unitPrice: "125.50",
    batchNumber: "B-100",
    expiryDate: "2028-12-31",
    manufacturer: "Test Pharma",
    reference: "OPEN-1",
  };
  try {
    await prisma.user.create({ data: { id: "pharmacist", name: "Test Pharmacist", email: "pharmacy@test.invalid", role: "PHARMACIST" } });
    await t.test("stock writes require pharmacy access", async () => {
      assert.equal((await pharmacy.POST(request("POST", stockBody))).status, 401);
    });
    let medicationId = "";
    await t.test("a manual entry creates searchable sellable stock", async () => {
      const response = await pharmacy.POST(request("POST", stockBody, "pharmacist"));
      assert.equal(response.status, 201);
      const result = await response.json();
      medicationId = result.medication.id;
      assert.equal(result.created, true);
      assert.equal(result.medication.stockUnit, "PILL_PACK");
      assert.equal(result.medication.stockQuantity, 20);
      assert.equal(result.medication.unitPrice, 125.5);
      const feed = await (await pharmacy.GET(request("GET", undefined, "pharmacist"))).json();
      assert.equal(feed.medications.some((item: any) => item.id === medicationId && item.brandName === "Testol"), true);
      assert.equal(feed.movements[0].unit, "PILL_PACK");
      assert.equal(feed.movements[0].type, "OPENING_STOCK");
      assert.equal((await pharmacy.POST(request("POST", stockBody, "pharmacist"))).status, 409);
    });
    await t.test("an existing row can be adjusted without a medicine dropdown", async () => {
      const response = await pharmacy.POST(request("POST", { ...stockBody, medicationId, quantity: "-2", reference: "COUNT-1" }, "pharmacist"));
      assert.equal(response.status, 200);
      const result = await response.json();
      assert.equal(result.created, false);
      assert.equal(result.medication.stockQuantity, 18);
    });
    await t.test("sales preserve and validate the selected package unit", async () => {
      const mismatch = await pharmacy.POST(request("POST", { action: "SALE", paymentMethod: "Cash", items: [{ medicationId, quantity: 2, unit: "PIECE" }] }, "pharmacist"));
      assert.equal(mismatch.status, 400);
      assert.equal((await prisma.medication.findUniqueOrThrow({ where: { id: medicationId } })).stockQuantity, 18);
      const response = await pharmacy.POST(request("POST", { action: "SALE", paymentMethod: "Cash", items: [{ medicationId, quantity: 2, unit: "PILL_PACK" }] }, "pharmacist"));
      assert.equal(response.status, 201);
      const sale = (await response.json()).sale;
      assert.equal(sale.items[0].unit, "PILL_PACK");
      assert.equal(sale.items[0].quantity, 2);
      assert.equal((await prisma.medication.findUniqueOrThrow({ where: { id: medicationId } })).stockQuantity, 16);
      assert.equal((await prisma.pharmacyStockMovement.findFirstOrThrow({ where: { reference: sale.saleNumber } })).unit, "PILL_PACK");
    });
  } finally {
    await prisma.$disconnect();
    rmSync(directory, { recursive: true, force: true });
  }
});
