/** Shared Pakistan deployment defaults. Tariffs are illustrative, not regulated prices. */
export const PAKISTAN = {
  locale: "en-PK",
  timeZone: "Asia/Karachi",
  currency: "PKR",
  consultationFee: 1500,
  facilityName: process.env.NEXT_PUBLIC_FACILITY_NAME || "CIMS Demo Hospital",
  facilityAddress: process.env.NEXT_PUBLIC_FACILITY_ADDRESS || "Pakistan · Demonstration facility",
  facilityPhone: process.env.NEXT_PUBLIC_FACILITY_PHONE || "Not configured",
} as const;

export const PAYMENT_METHODS = ["Cash", "Credit Card", "Bank Transfer", "Raast", "JazzCash", "Easypaisa", "Insurance"];

export function pakistanDateKey(value: Date | string = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: PAKISTAN.timeZone, year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date(value));
}

export function pakistanDayBounds(value: Date | string = new Date()) {
  const start = new Date(`${pakistanDateKey(value)}T00:00:00+05:00`);
  return { start, end: new Date(start.getTime() + 86400000) };
}

/** Accept local and international Pakistan phone numbers, including landlines. */
export function normalizePakistanPhone(value: string): string | null {
  const compact = value.replace(/[\s()-]/g, "");
  const international = compact.startsWith("0092") ? `+92${compact.slice(4)}`
    : compact.startsWith("0") ? `+92${compact.slice(1)}` : compact;
  return /^\+92[1-9]\d{8,9}$/.test(international) ? international : null;
}

/** Format validation only; this does not verify identity with NADRA. */
export function normalizeCnic(value: string): string | null {
  const digits = value.replace(/[-\s]/g, "");
  return /^\d{13}$/.test(digits)
    ? `${digits.slice(0, 5)}-${digits.slice(5, 12)}-${digits.slice(12)}` : null;
}
