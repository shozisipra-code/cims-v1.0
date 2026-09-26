export const vitalFields = [
  { key: "systolicBP", label: "Systolic BP", unit: "mmHg", min: 0, max: 400, step: 1 },
  { key: "diastolicBP", label: "Diastolic BP", unit: "mmHg", min: 0, max: 300, step: 1 },
  { key: "heartRate", label: "Pulse", unit: "bpm", min: 0, max: 400, step: 1 },
  { key: "temperature", label: "Temperature", unit: "°C", min: 20, max: 50, step: 0.1 },
  { key: "respiratoryRate", label: "Respiratory rate", unit: "/min", min: 0, max: 150, step: 1 },
  { key: "spO2", label: "SpO₂", unit: "%", min: 0, max: 100, step: 1 },
  { key: "weightKg", label: "Weight", unit: "kg", min: 0.1, max: 700, step: 0.1 },
  { key: "heightCm", label: "Height", unit: "cm", min: 1, max: 300, step: 0.1 },
  { key: "bloodGlucose", label: "Blood glucose", unit: "mg/dL", min: 0, max: 2000, step: 0.1 },
  { key: "painScore", label: "Pain score", unit: "/10", min: 0, max: 10, step: 1 },
] as const;
export type VitalsForm = Record<(typeof vitalFields)[number]["key"] | "notes", string>;
export type PrescriptionRow = { medicationName: string; dosage: string; frequency: string; duration: string; quantity: number; instructions: string };
export type ConsultationForm = {
  chiefComplaint: string; hpi: string; physicalExam: string; clinicalNotes: string;
  diagnosis: string; assessmentPlan: string; followUpDate: string;
  vitals: VitalsForm; prescriptionItems: PrescriptionRow[];
};
export const emptyPrescription = (): PrescriptionRow => ({ medicationName: "", dosage: "", frequency: "", duration: "", instructions: "", quantity: 1 });
export function formFromEncounter(encounter: any): ConsultationForm {
  let draft: any = {};
  try { draft = JSON.parse(encounter.draftData || "{}"); } catch {}
  const issuedPrescription = encounter.prescriptions?.find((prescription: any) => prescription.status === "PENDING")
    || encounter.prescriptions?.find((prescription: any) => ["PARTIALLY_DISPENSED", "DISPENSED"].includes(prescription.status));
  const issuedItems = issuedPrescription?.items?.map((item: any) => ({
    medicationName: item.medicationName || "", dosage: item.dosage || "", frequency: item.frequency || "",
    duration: item.duration || "", quantity: item.quantity || 1, instructions: item.instructions || "",
  })) || [];
  const vitals = Object.fromEntries(vitalFields.map(({ key }) => [key, String(encounter.vitals?.[0]?.[key] ?? "")])) as VitalsForm;
  vitals.notes = encounter.vitals?.[0]?.notes || "";
  return {
    chiefComplaint: encounter.chiefComplaint || "", hpi: encounter.hpi || "", physicalExam: encounter.physicalExam || "",
    clinicalNotes: encounter.clinicalNotes || "", assessmentPlan: encounter.assessmentPlan || "",
    diagnosis: draft.diagnosis ?? encounter.diagnoses?.map((item: any) => item.description).join("\n") ?? "",
    followUpDate: encounter.followUpDate?.slice(0, 10) || "", vitals,
    prescriptionItems: draft.prescriptionItems || issuedItems,
  };
}
export function conditionText(value?: string | null): string {
  if (!value) return "None documented";
  try { const items = JSON.parse(value); return Array.isArray(items) ? items.join(", ") : String(items); } catch { return value; }
}
