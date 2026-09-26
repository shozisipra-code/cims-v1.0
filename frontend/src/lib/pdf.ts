import { PAKISTAN } from "./pakistan";
import { calculateAge, formatCurrency, formatDate, formatDateTime } from "./utils";

type PdfCell = string | number | null | undefined;
type PdfSection = { title: string; columns: string[]; rows: PdfCell[][]; empty?: string };
type PdfMetric = { label: string; value: string | number };

type PdfDocumentInput = {
  filename: string;
  title: string;
  subtitle?: string;
  orientation?: "portrait" | "landscape";
  metrics?: PdfMetric[];
  sections: PdfSection[];
};

const clean = (value: unknown) => value === null || value === undefined || value === "" ? "-" : String(value);
const safeFilename = (value: string) => value.replace(/[^a-z0-9._-]+/gi, "-").replace(/-+/g, "-");

export async function downloadPdfDocument(input: PdfDocumentInput) {
  const [{ jsPDF }, autoTableModule] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
  const autoTable = autoTableModule.default;
  const doc = new jsPDF({ orientation: input.orientation || "portrait", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const left = 12;
  const right = 12;
  let y = 33;

  if (input.subtitle) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(82, 99, 105);
    const lines = doc.splitTextToSize(input.subtitle, pageWidth - left - right);
    doc.text(lines, left, y);
    y += lines.length * 4 + 2;
  }

  if (input.metrics?.length) {
    autoTable(doc, {
      startY: y,
      margin: { left, right, top: 31, bottom: 18 },
      theme: "grid",
      body: [input.metrics.map(metric => `${metric.label}\n${metric.value}`)],
      styles: { font: "helvetica", fontSize: 8.5, cellPadding: 3, textColor: [23, 33, 38], lineColor: [203, 219, 216], lineWidth: 0.2 },
      bodyStyles: { fillColor: [238, 247, 244], fontStyle: "bold" },
    });
    y = (doc as any).lastAutoTable.finalY + 6;
  }

  for (const section of input.sections) {
    if (y > pageHeight - 35) { doc.addPage(); y = 33; }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(15, 118, 110);
    doc.text(section.title, left, y);
    y += 3;
    const body = section.rows.length ? section.rows.map(row => row.map(clean)) : [[section.empty || "No records available.", ...section.columns.slice(1).map(() => "")]];
    autoTable(doc, {
      startY: y,
      head: [section.columns],
      body,
      margin: { left, right, top: 31, bottom: 18 },
      theme: "grid",
      showHead: "everyPage",
      styles: { font: "helvetica", fontSize: 7.4, cellPadding: 2.2, overflow: "linebreak", valign: "top", textColor: [32, 45, 49], lineColor: [211, 221, 220], lineWidth: 0.15 },
      headStyles: { fillColor: [15, 118, 110], textColor: [255, 255, 255], fontStyle: "bold", fontSize: 7.3 },
      alternateRowStyles: { fillColor: [247, 250, 249] },
    });
    y = (doc as any).lastAutoTable.finalY + 7;
  }

  const generated = `Generated ${formatDateTime(new Date())}`;
  const pages = doc.getNumberOfPages();
  for (let page = 1; page <= pages; page += 1) {
    doc.setPage(page);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(15, 118, 110);
    doc.text(PAKISTAN.facilityName, left, 11);
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(80, 96, 101);
    doc.text(PAKISTAN.facilityAddress, left, 16);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(23, 33, 38);
    doc.text(input.title, pageWidth - right, 11, { align: "right" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(95, 109, 114);
    doc.text(generated, pageWidth - right, 16, { align: "right" });
    doc.setDrawColor(15, 118, 110);
    doc.setLineWidth(0.5);
    doc.line(left, 22, pageWidth - right, 22);
    doc.setDrawColor(190, 205, 202);
    doc.setLineWidth(0.2);
    doc.line(left, pageHeight - 12, pageWidth - right, pageHeight - 12);
    doc.setFontSize(7.5);
    doc.setTextColor(95, 109, 114);
    doc.text(`${PAKISTAN.facilityPhone}  |  Confidential clinic record`, left, pageHeight - 7);
    doc.text(`Page ${page} of ${pages}`, pageWidth - right, pageHeight - 7, { align: "right" });
  }
  doc.save(safeFilename(input.filename.endsWith(".pdf") ? input.filename : `${input.filename}.pdf`));
}

export async function downloadPatient360Pdf(patient: any) {
  let conditions = patient.chronicConditions || "None documented";
  try { const parsed = JSON.parse(conditions); if (Array.isArray(parsed)) conditions = parsed.join(", "); } catch {}
  const encounterById = new Map((patient.encounters || []).map((item: any) => [item.id, item]));
  return downloadPdfDocument({
    filename: `patient-360-${patient.mrn}.pdf`,
    title: "Patient 360 Clinical Record",
    subtitle: `${patient.firstName} ${patient.lastName} | MRN ${patient.mrn} | DOB ${formatDate(patient.dateOfBirth)} | ${calculateAge(patient.dateOfBirth)} years | ${patient.gender}`,
    orientation: "landscape",
    metrics: [
      { label: "Phone", value: patient.phone },
      { label: "CNIC / B-form", value: patient.nationalId || "Not recorded" },
      { label: "Blood group", value: patient.bloodGroup || "Not recorded" },
      { label: "Chronic conditions", value: conditions },
    ],
    sections: [
      { title: "Patient and emergency contact", columns: ["Address", "Emergency contact", "Relationship", "Emergency phone"], rows: [[patient.address, patient.emergencyContactName, patient.emergencyContactRelation, patient.emergencyContactPhone]] },
      { title: "Vitals history", columns: ["Recorded", "BP", "Pulse", "Temp", "SpO2", "Weight / height / BMI", "Glucose", "Resp / pain", "Recorded by"], rows: (patient.vitals || []).map((v: any) => [formatDateTime(v.recordedAt), `${clean(v.systolicBP)}/${clean(v.diastolicBP)} mmHg`, v.heartRate ? `${v.heartRate} bpm` : "-", v.temperature ? `${v.temperature} C` : "-", v.spO2 ? `${v.spO2}%` : "-", `${clean(v.weightKg)} kg / ${clean(v.heightCm)} cm / ${clean(v.bmi)}`, v.bloodGlucose ? `${v.bloodGlucose} mg/dL` : "-", `${clean(v.respiratoryRate)} /min / pain ${clean(v.painScore)}/10`, v.recordedBy]) },
      { title: "Clinical encounters", columns: ["Date", "Doctor", "Status", "Chief complaint", "Diagnosis", "Clinical notes", "Assessment / plan", "Follow-up"], rows: (patient.encounters || []).map((enc: any) => [formatDateTime(enc.encounterDate), enc.doctor?.name, enc.status, enc.chiefComplaint, enc.diagnoses?.map((item: any) => item.description).join("; "), [enc.hpi, enc.physicalExam, enc.clinicalNotes].filter(Boolean).join("\n"), enc.assessmentPlan, enc.followUpDate ? formatDate(enc.followUpDate) : "-"]) },
      { title: "Prescriptions", columns: ["Date", "Doctor", "Status", "Medicine", "Dose", "Frequency", "Duration", "Quantity", "Instructions"], rows: (patient.prescriptions || []).flatMap((rx: any) => (rx.items || []).map((item: any) => [formatDate(rx.createdAt), rx.doctor?.name, rx.status, item.medicationName, `${item.dosage} ${item.route || ""}`.trim(), item.frequency, item.duration, item.quantity, item.instructions])) },
      { title: "Invoices and payments", columns: ["Invoice", "Date", "Visit", "Services", "Total", "Paid", "Method / reference"], rows: (patient.invoices || []).map((invoice: any) => [invoice.invoiceNumber, formatDate(invoice.createdAt), invoice.encounterId ? formatDate((encounterById.get(invoice.encounterId) as any)?.encounterDate) : "Booking", invoice.items?.map((item: any) => item.description).join("; "), formatCurrency(invoice.totalAmount), formatCurrency(invoice.paidAmount), (invoice.payments || []).map((payment: any) => `${payment.method}${payment.reference ? ` / ${payment.reference}` : ""}`).join("; ")]) },
    ],
  });
}

export async function downloadConsultationPdf(patient: any, encounter: any, form: any) {
  const vitals = form?.vitals || {};
  return downloadPdfDocument({
    filename: `consultation-${patient.mrn}-${new Date(encounter.encounterDate).toISOString().slice(0, 10)}.pdf`,
    title: "Consultation Summary",
    subtitle: `${patient.firstName} ${patient.lastName} | MRN ${patient.mrn} | ${calculateAge(patient.dateOfBirth)} years | ${patient.gender}`,
    metrics: [
      { label: "Visit", value: formatDateTime(encounter.encounterDate) },
      { label: "Doctor", value: encounter.doctor?.name || "Not recorded" },
      { label: "Status", value: encounter.status || "IN PROGRESS" },
      { label: "Follow-up", value: form?.followUpDate ? formatDate(form.followUpDate) : "Not scheduled" },
    ],
    sections: [
      {
        title: "Clinical record",
        columns: ["Field", "Details"],
        rows: [
          ["Chief complaint", form?.chiefComplaint],
          ["History of present illness", form?.hpi],
          ["Clinical notes", form?.clinicalNotes],
          ["Examination findings", form?.physicalExam],
          ["Diagnosis", form?.diagnosis],
          ["Plan and advice", form?.assessmentPlan],
        ],
      },
      {
        title: "Vitals",
        columns: ["BP", "Pulse", "Temperature", "SpO2", "Weight", "Height", "Glucose", "Respiratory rate", "Pain", "Notes"],
        rows: [[
          `${clean(vitals.systolicBP)}/${clean(vitals.diastolicBP)} mmHg`,
          vitals.heartRate ? `${vitals.heartRate} bpm` : "-",
          vitals.temperature ? `${vitals.temperature} C` : "-",
          vitals.spO2 ? `${vitals.spO2}%` : "-",
          vitals.weightKg ? `${vitals.weightKg} kg` : "-",
          vitals.heightCm ? `${vitals.heightCm} cm` : "-",
          vitals.bloodGlucose ? `${vitals.bloodGlucose} mg/dL` : "-",
          vitals.respiratoryRate ? `${vitals.respiratoryRate} /min` : "-",
          vitals.painScore !== "" && vitals.painScore !== undefined ? `${vitals.painScore}/10` : "-",
          vitals.notes,
        ]],
      },
      {
        title: "Prescription",
        columns: ["Medicine", "Dose", "Frequency", "Duration", "Quantity", "Instructions"],
        rows: (form?.prescriptionItems || []).map((item: any) => [item.medicationName, item.dosage, item.frequency, item.duration, item.quantity, item.instructions]),
        empty: "No medicines prescribed.",
      },
    ],
  });
}

export async function downloadReceiptPdf(invoice: any) {
  return downloadPdfDocument({
    filename: `${invoice.invoiceNumber}.pdf`,
    title: "Payment Receipt",
    subtitle: `${invoice.patient.firstName} ${invoice.patient.lastName} | MRN ${invoice.patient.mrn} | Receipt ${invoice.invoiceNumber}`,
    metrics: [{ label: "Issued", value: formatDateTime(invoice.createdAt) }, { label: "Status", value: invoice.status }, { label: "Payment method", value: invoice.paymentMethod || "Cash" }, { label: "Amount received", value: formatCurrency(invoice.paidAmount) }],
    sections: [
      { title: "Receipt items", columns: ["Description", "Category", "Quantity", "Unit price", "Amount"], rows: (invoice.items || []).map((item: any) => [item.description, item.category, item.quantity, formatCurrency(item.unitPrice), formatCurrency(item.totalPrice)]) },
      { title: "Payment record", columns: ["Received", "Method", "Reference", "Received by", "Amount"], rows: (invoice.payments || []).map((payment: any) => [formatDateTime(payment.receivedAt), payment.method, payment.reference, payment.receivedBy, formatCurrency(payment.amount)]) },
    ],
  });
}
