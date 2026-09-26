import { PermissionKey, UserRole } from "@/types";
export const permissionOptions: { key: PermissionKey; label: string }[] = [
  { key: "dashboard", label: "Dashboard" }, { key: "booking", label: "Patient Booking" }, { key: "appointments", label: "Appointments & Queue" }, { key: "patient_calling", label: "Patient Calling" }, { key: "patients", label: "Patient Records" }, { key: "clinical", label: "Consultation" }, { key: "billing", label: "Billing & Receipts" }, { key: "payments", label: "Payment Records" }, { key: "daily_statement", label: "Daily Statement" }, { key: "pharmacy", label: "Pharmacy" }, { key: "users", label: "Users & Permissions" }, { key: "audit_log", label: "Audit Log" },
];
export const defaultPermissions = {
  SUPER_USER: permissionOptions.map(option => option.key),
  RECEPTIONIST: ["dashboard", "booking", "appointments", "patient_calling", "patients", "billing", "payments", "daily_statement"] as PermissionKey[],
  DOCTOR: ["dashboard", "appointments", "patient_calling", "patients", "clinical"] as PermissionKey[],
  PHARMACIST: ["pharmacy"] as PermissionKey[],
  ENGINEER: permissionOptions.map(option => option.key),
};
export const roleLabels: Record<string, string> = { SUPER_USER: "Super User", DOCTOR: "Doctor", RECEPTIONIST: "Receptionist", PHARMACIST: "Pharmacist", ENGINEER: "Engineer" };
export function canAccess(role: UserRole, permissions: PermissionKey[], key: PermissionKey) { return role === "SUPER_USER" || role === "ENGINEER" || permissions.includes(key); }
export function permissionForPath(pathname: string): PermissionKey { const segment = pathname.split("/")[1]; return ({ booking: "booking", appointments: "appointments", "patient-calling": "patient_calling", patients: "patients", clinical: "clinical", billing: "billing", payments: "payments", "daily-statement": "daily_statement", pharmacy: "pharmacy", users: "users", "audit-log": "audit_log" } as Record<string, PermissionKey>)[segment] || "dashboard"; }
