import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { pakistanDayBounds, PAYMENT_METHODS } from "@/lib/pakistan";
import { authorizationErrorResponse, requireActor } from "@/lib/auth";

const STOCK_UNITS = ["SYRUP_BOTTLE", "PILL_PACK", "PIECE", "BOTTLE"] as const;

function text(value: unknown, max = 160) {
  const result = String(value || "").trim();
  return result.slice(0, max);
}

function stockUnit(value: unknown) {
  const unit = String(value || "PIECE").toUpperCase();
  return STOCK_UNITS.includes(unit as (typeof STOCK_UNITS)[number]) ? unit : null;
}

export async function GET(req: NextRequest) {
  try {
    await requireActor(req, { anyOf: ["pharmacy"] });
    const requestedDate = new URL(req.url).searchParams.get("date") || undefined;
    const { start, end } = pakistanDayBounds(requestedDate);
    const [medications, sales, prescriptions, movements, dailySales, dailyMovements] = await Promise.all([
      prisma.medication.findMany({ orderBy: [{ brandName: "asc" }, { strength: "asc" }] }),
      prisma.pharmacySale.findMany({ orderBy: { createdAt: "desc" }, take: 50, include: { items: true } }),
      prisma.prescription.findMany({ orderBy: { createdAt: "desc" }, take: 100, include: { patient: true, doctor: true, items: true } }),
      prisma.pharmacyStockMovement.findMany({ orderBy: { createdAt: "desc" }, take: 50, include: { medication: true } }),
      prisma.pharmacySale.findMany({ where: { createdAt: { gte: start, lt: end } }, orderBy: { createdAt: "desc" }, include: { items: true } }),
      prisma.pharmacyStockMovement.findMany({ where: { createdAt: { gte: start, lt: end } }, orderBy: { createdAt: "desc" }, include: { medication: true } }),
    ]);
    return NextResponse.json({ success: true, medications, sales, prescriptions, movements, dailySales, dailyMovements });
  } catch (error) {
    const authorizationResponse = authorizationErrorResponse(error);
    if (authorizationResponse) return authorizationResponse;
    console.error("Fetch pharmacy data error:", error);
    return NextResponse.json({ success: false, error: "Failed to load pharmacy data." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const actor = await requireActor(req, { anyOf: ["pharmacy"] });
    const body = await req.json();
    if (body.action === "STOCK") {
      const quantity = Number.parseInt(body.quantity);
      const unit = stockUnit(body.stockUnit);
      const brandName = text(body.brandName);
      const genericName = text(body.genericName) || brandName;
      const form = text(body.form);
      const strength = text(body.strength);
      const minStockLevel = Number.parseInt(body.minStockLevel || 0);
      const unitPrice = Number(body.unitPrice || 0);
      const expiryText = text(body.expiryDate, 10);
      const expiryDate = expiryText ? new Date(`${expiryText}T12:00:00+05:00`) : null;
      if (!Number.isInteger(quantity) || quantity === 0) return NextResponse.json({ success: false, error: "Enter a non-zero stock quantity." }, { status: 400 });
      if (!unit) return NextResponse.json({ success: false, error: "Select a valid stock unit." }, { status: 400 });
      if (!brandName || !form || !strength) return NextResponse.json({ success: false, error: "Enter the medicine name, form, and strength." }, { status: 400 });
      if (!Number.isInteger(minStockLevel) || minStockLevel < 0 || !Number.isFinite(unitPrice) || unitPrice < 0) return NextResponse.json({ success: false, error: "Enter valid minimum stock and unit price values." }, { status: 400 });
      if (expiryText && (Number.isNaN(expiryDate!.getTime()) || expiryDate!.toISOString().slice(0, 10) !== expiryText)) return NextResponse.json({ success: false, error: "Enter a valid expiry date." }, { status: 400 });
      const medication = body.medicationId ? await prisma.medication.findUnique({ where: { id: String(body.medicationId) } }) : null;
      if (body.medicationId && !medication) return NextResponse.json({ success: false, error: "Medicine was not found." }, { status: 404 });
      if (!medication && quantity < 0) return NextResponse.json({ success: false, error: "Opening stock for a new medicine must be positive." }, { status: 400 });
      if (medication && medication.stockQuantity + quantity < 0) return NextResponse.json({ success: false, error: "Stock adjustment exceeds the available quantity." }, { status: 400 });
      if (medication && medication.stockQuantity > 0 && medication.stockUnit !== unit) return NextResponse.json({ success: false, error: "The package unit cannot be changed while this medicine has stock." }, { status: 409 });
      if (!medication) {
        const duplicate = await prisma.medication.findFirst({ where: { brandName, strength, stockUnit: unit } });
        if (duplicate) return NextResponse.json({ success: false, error: "This medicine and package unit already exist. Use Adjust from the stock list." }, { status: 409 });
      }
      const result = await prisma.$transaction(async transaction => {
        const details = { brandName, genericName, form, strength, stockUnit: unit, minStockLevel, unitPrice, batchNumber: text(body.batchNumber) || null, expiryDate, manufacturer: text(body.manufacturer) || null };
        const updated = medication
          ? await transaction.medication.update({ where: { id: medication.id }, data: { ...details, stockQuantity: { increment: quantity } } })
          : await transaction.medication.create({ data: { ...details, stockQuantity: quantity } });
        await transaction.pharmacyStockMovement.create({ data: { medicationId: updated.id, type: medication ? (quantity > 0 ? "STOCK_IN" : "ADJUSTMENT") : "OPENING_STOCK", quantity, unit, balanceAfter: updated.stockQuantity, reference: text(body.reference) || null, recordedBy: actor.name } });
        await transaction.auditLog.create({ data: { userId: actor.id, userName: actor.name, userRole: actor.role, action: medication ? "STOCK_ADJUSTMENT" : "CREATE", resource: "MEDICATION", resourceId: updated.id, details: medication ? `${brandName} stock changed by ${quantity} ${unit}; balance ${updated.stockQuantity}.` : `${brandName} added with ${quantity} ${unit} opening stock.` } });
        return updated;
      });
      return NextResponse.json({ success: true, medication: result, created: !medication }, { status: medication ? 200 : 201 });
    }

    if (body.action === "SALE") {
      if (!Array.isArray(body.items) || !body.items.length) return NextResponse.json({ success: false, error: "Add at least one medicine to the sale." }, { status: 400 });
      if (body.paymentMethod && !PAYMENT_METHODS.includes(body.paymentMethod)) return NextResponse.json({ success: false, error: "Select a valid payment method." }, { status: 400 });
      const requested: { medicationId: string; quantity: number; unit: string }[] = body.items.map((item: any) => ({ medicationId: String(item.medicationId), quantity: Number.parseInt(item.quantity), unit: String(item.unit || "") }));
      if (requested.some((item: any) => !item.medicationId || !Number.isInteger(item.quantity) || item.quantity <= 0)) return NextResponse.json({ success: false, error: "Sale quantities must be positive whole numbers." }, { status: 400 });
      const uniqueIds = [...new Set<string>(requested.map(item => item.medicationId))];
      if (uniqueIds.length !== requested.length) return NextResponse.json({ success: false, error: "Combine duplicate medicines into one sale line." }, { status: 400 });
      const medications = await prisma.medication.findMany({ where: { id: { in: uniqueIds } } });
      if (medications.length !== requested.length) return NextResponse.json({ success: false, error: "One or more medicines were not found." }, { status: 404 });
      const lines = requested.map((item: any) => { const medication = medications.find(med => med.id === item.medicationId)!; return { ...item, unit: item.unit || medication.stockUnit, medication }; });
      const invalidUnit = lines.find((line: any) => !stockUnit(line.unit) || line.unit !== line.medication.stockUnit);
      if (invalidUnit) return NextResponse.json({ success: false, error: `Select ${invalidUnit.medication.stockUnit.replaceAll("_", " ").toLowerCase()} for ${invalidUnit.medication.brandName}.` }, { status: 400 });
      const unavailable = lines.find((line: any) => line.medication.stockQuantity < line.quantity);
      if (unavailable) return NextResponse.json({ success: false, error: `${unavailable.medication.brandName} has only ${unavailable.medication.stockQuantity} units available.` }, { status: 409 });
      const totalAmount = Math.round(lines.reduce((sum: number, line: any) => sum + line.quantity * line.medication.unitPrice, 0) * 100) / 100;
      const count = await prisma.pharmacySale.count();
      const saleNumber = `PH-${new Date().getFullYear()}-${String(count + 1).padStart(4, "0")}`;
      const sale = await prisma.$transaction(async transaction => {
        for (const line of lines) {
          const changed = await transaction.medication.updateMany({ where: { id: line.medication.id, stockQuantity: { gte: line.quantity } }, data: { stockQuantity: { decrement: line.quantity } } });
          if (changed.count !== 1) throw new Error("STOCK_CHANGED");
        }
        const created = await transaction.pharmacySale.create({ data: { saleNumber, customerName: String(body.customerName || "").trim() || null, soldBy: actor.name, paymentMethod: body.paymentMethod || "Cash", totalAmount, notes: String(body.notes || "").trim() || null, items: { create: lines.map((line: any) => ({ medicationId: line.medication.id, medicationName: `${line.medication.brandName} ${line.medication.strength}`, quantity: line.quantity, unit: line.unit, unitPrice: line.medication.unitPrice, totalPrice: Math.round(line.quantity * line.medication.unitPrice * 100) / 100 })) } }, include: { items: true } });
        for (const line of lines) await transaction.pharmacyStockMovement.create({ data: { medicationId: line.medication.id, type: "SALE", quantity: -line.quantity, unit: line.unit, balanceAfter: line.medication.stockQuantity - line.quantity, reference: saleNumber, recordedBy: actor.name } });
        await transaction.auditLog.create({ data: { userId: actor.id, userName: actor.name, userRole: actor.role, action: "SALE", resource: "PHARMACY_SALE", resourceId: created.id, details: `${saleNumber} completed for PKR ${totalAmount.toFixed(2)}.` } });
        return created;
      });
      return NextResponse.json({ success: true, sale }, { status: 201 });
    }
    return NextResponse.json({ success: false, error: "Unsupported pharmacy action." }, { status: 400 });
  } catch (error) {
    const authorizationResponse = authorizationErrorResponse(error);
    if (authorizationResponse) return authorizationResponse;
    console.error("Pharmacy transaction error:", error);
    return NextResponse.json({ success: false, error: error instanceof Error && error.message === "STOCK_CHANGED" ? "Stock changed during the sale. Review quantities and try again." : "Pharmacy transaction failed." }, { status: 500 });
  }
}
