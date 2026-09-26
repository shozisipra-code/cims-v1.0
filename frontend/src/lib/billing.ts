export function roundRupees(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function invoiceTotals(items: { quantity: number; unitPrice: number }[], discount = 0, tax = 0) {
  if (!items.length || items.some(item => !Number.isInteger(item.quantity) || item.quantity <= 0 || !Number.isFinite(item.unitPrice) || item.unitPrice < 0)) {
    throw new Error("Invoice items require a positive whole quantity and a non-negative PKR unit price.");
  }
  const subtotal = roundRupees(items.reduce((sum, item) => sum + roundRupees(item.quantity * item.unitPrice), 0));
  if (!Number.isFinite(discount) || !Number.isFinite(tax) || discount < 0 || discount > subtotal || tax < 0) {
    throw new Error("Invalid invoice discount or tax amount.");
  }
  return { subtotal, discount: roundRupees(discount), tax: roundRupees(tax), totalAmount: roundRupees(subtotal - discount + tax) };
}
