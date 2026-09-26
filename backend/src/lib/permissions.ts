export const permissionKeys = ["dashboard", "booking", "appointments", "patient_calling", "patients", "clinical", "billing", "payments", "daily_statement", "pharmacy", "users", "audit_log"] as const;

export type PermissionKey = (typeof permissionKeys)[number];

export const defaultPermissions: Record<string, PermissionKey[]> = {
  ADMIN: [...permissionKeys],
  SUPER_USER: [...permissionKeys],
  RECEPTIONIST: ["dashboard", "booking", "appointments", "patient_calling", "patients", "billing", "payments", "daily_statement"],
  DOCTOR: ["dashboard", "appointments", "patient_calling", "patients", "clinical"],
  PHARMACIST: ["pharmacy"],
  ENGINEER: [...permissionKeys],
};

export function publicRole(role: string) {
  if (role === "ADMIN") return "SUPER_USER";
  if (role === "NURSE") return "DOCTOR";
  if (role === "LAB_TECH") return "PHARMACIST";
  if (role === "BILLING_OFFICER") return "RECEPTIONIST";
  return role;
}

export function parsePermissions(value: string | null | undefined, role: string): PermissionKey[] {
  if (role === "ADMIN" || role === "SUPER_USER" || role === "ENGINEER") return [...permissionKeys];
  try {
    const parsed = JSON.parse(value || "[]");
    if (Array.isArray(parsed) && parsed.length) return parsed.filter((key): key is PermissionKey => permissionKeys.includes(key) && key !== "audit_log");
  } catch {}
  return [...(defaultPermissions[publicRole(role)] || [])];
}
