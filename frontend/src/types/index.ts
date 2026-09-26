export type UserRole =
  | "SUPER_USER"
  | "DOCTOR"
  | "NURSE"
  | "RECEPTIONIST"
  | "PHARMACIST"
  | "ENGINEER"
  | "LAB_TECH"
  | "BILLING_OFFICER";

export interface CurrentUser {
  id: string;
  username?: string;
  email: string;
  name: string;
  role: UserRole;
  department?: string;
  licenseNumber?: string;
  phone?: string;
  avatar?: string;
  permissions: PermissionKey[];
  isActive?: boolean;
}

export type PermissionKey = "dashboard" | "booking" | "appointments" | "patient_calling" | "patients" | "clinical" | "billing" | "payments" | "daily_statement" | "pharmacy" | "users" | "audit_log";

export type AppointmentStatusType =
  | "SCHEDULED"
  | "WAITING"
  | "IN_CONSULTATION"
  | "COMPLETED"
  | "CANCELLED"
  | "NO_SHOW";

export type EncounterStatusType = "IN_PROGRESS" | "FINALIZED";

export type PrescriptionStatusType =
  | "PENDING"
  | "PARTIALLY_DISPENSED"
  | "DISPENSED"
  | "CANCELLED";

export type LabOrderStatusType =
  | "ORDERED"
  | "SAMPLE_COLLECTED"
  | "ANALYZING"
  | "COMPLETED"
  | "CANCELLED";

export type InvoiceStatusType = "UNPAID" | "PAID";

export interface PatientRecord {
  id: string;
  mrn: string;
  title?: string | null;
  firstName: string;
  lastName: string;
  fatherHusbandName?: string | null;
  gender: string;
  dateOfBirth: string | Date;
  ageValue?: number | null;
  ageUnit?: string | null;
  bloodGroup?: string | null;
  phone: string;
  email?: string | null;
  nationalId?: string | null;
  address?: string | null;
  emergencyContactName?: string | null;
  emergencyContactPhone?: string | null;
  emergencyContactRelation?: string | null;
  chronicConditions?: string | null;
  createdAt: string | Date;
  updatedAt: string | Date;
}
