export type UserRole =
  | "ADMIN"
  | "DOCTOR"
  | "NURSE"
  | "RECEPTIONIST"
  | "PHARMACIST"
  | "LAB_TECH"
  | "BILLING_OFFICER";

export interface CurrentUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  department?: string;
  licenseNumber?: string;
  phone?: string;
  avatar?: string;
}

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

export type InvoiceStatusType = "UNPAID" | "PARTIALLY_PAID" | "PAID" | "VOID";

export interface PatientRecord {
  id: string;
  mrn: string;
  firstName: string;
  lastName: string;
  gender: string;
  dateOfBirth: string | Date;
  bloodGroup?: string | null;
  phone: string;
  email?: string | null;
  nationalId?: string | null;
  address?: string | null;
  emergencyContactName?: string | null;
  emergencyContactPhone?: string | null;
  emergencyContactRelation?: string | null;
  allergies?: string | null;
  chronicConditions?: string | null;
  createdAt: string | Date;
  updatedAt: string | Date;
}
