import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { PAKISTAN } from "./pakistan";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat(PAKISTAN.locale, {
    style: "currency",
    currency: PAKISTAN.currency,
    currencyDisplay: "code",
  }).format(amount);
}

export function formatDate(date: Date | string | number | null | undefined): string {
  if (!date) return "N/A";
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return "N/A";
  return d.toLocaleDateString(PAKISTAN.locale, {
    timeZone: PAKISTAN.timeZone,
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function formatDateTime(date: Date | string | number | null | undefined): string {
  if (!date) return "N/A";
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return "N/A";
  return d.toLocaleString(PAKISTAN.locale, {
    timeZone: PAKISTAN.timeZone,
    timeZoneName: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function calculateAge(dateOfBirth: Date | string): number {
  const dob = new Date(dateOfBirth);
  const diffMs = Date.now() - dob.getTime();
  const ageDt = new Date(diffMs);
  return Math.abs(ageDt.getUTCFullYear() - 1970);
}

export function calculateBMI(weightKg?: number | null, heightCm?: number | null): { bmi: number; category: string } | null {
  if (!weightKg || !heightCm || heightCm <= 0) return null;
  const heightM = heightCm / 100;
  const bmi = parseFloat((weightKg / (heightM * heightM)).toFixed(1));

  let category = "Normal";
  if (bmi < 18.5) category = "Underweight";
  else if (bmi >= 25 && bmi < 29.9) category = "Overweight";
  else if (bmi >= 30) category = "Obese";

  return { bmi, category };
}

export function getBloodPressureStatus(systolic?: number | null, diastolic?: number | null): { status: "Normal" | "Elevated" | "Stage 1 HTN" | "Stage 2 HTN" | "Crisis" | "Unknown"; color: string } {
  if (!systolic || !diastolic) return { status: "Unknown", color: "text-slate-500" };
  if (systolic > 180 || diastolic > 120) return { status: "Crisis", color: "text-red-700 bg-red-100 font-bold" };
  if (systolic >= 140 || diastolic >= 90) return { status: "Stage 2 HTN", color: "text-red-600 bg-red-50" };
  if (systolic >= 130 || diastolic >= 80) return { status: "Stage 1 HTN", color: "text-amber-600 bg-amber-50" };
  if (systolic >= 120 && diastolic < 80) return { status: "Elevated", color: "text-amber-500 bg-amber-50" };
  return { status: "Normal", color: "text-emerald-700 bg-emerald-50" };
}
