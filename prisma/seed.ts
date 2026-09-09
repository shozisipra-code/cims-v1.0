import { PrismaClient } from "@prisma/client";
import { COMMON_ICD10_CODES } from "../src/lib/constants/icd10";
import { FORMULARY_MEDICATIONS } from "../src/lib/constants/medications";
import { STANDARD_LAB_TESTS } from "../src/lib/constants/labTests";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Starting CIMS Database Seeding...");

  // 1. Seed Staff Users
  const users = [
    {
      id: "usr_admin",
      email: "admin@cims.hospital",
      name: "Dr. Arthur Vance (Chief of Medicine)",
      role: "ADMIN" as const,
      department: "Hospital Administration",
      licenseNumber: "MED-ADM-9901",
      phone: "+1 555-0190",
      avatar: "https://images.unsplash.com/photo-1537368910025-700350fe46c7?w=150&auto=format&fit=crop&q=80",
    },
    {
      id: "usr_doc_1",
      email: "dr.sarah@cims.hospital",
      name: "Dr. Sarah Jenkins, MD",
      role: "DOCTOR" as const,
      department: "Internal Medicine",
      licenseNumber: "MED-DOC-4482",
      phone: "+1 555-0142",
      avatar: "https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=150&auto=format&fit=crop&q=80",
    },
    {
      id: "usr_doc_2",
      email: "dr.marcus@cims.hospital",
      name: "Dr. Marcus Chen, MD",
      role: "DOCTOR" as const,
      department: "Cardiology",
      licenseNumber: "MED-DOC-7719",
      phone: "+1 555-0158",
      avatar: "https://images.unsplash.com/photo-1622253692010-333f2da6031d?w=150&auto=format&fit=crop&q=80",
    },
    {
      id: "usr_nurse_1",
      email: "nurse.clara@cims.hospital",
      name: "Clara Oswald, RN",
      role: "NURSE" as const,
      department: "OPD Triage",
      licenseNumber: "NUR-REG-8821",
      phone: "+1 555-0177",
      avatar: "https://images.unsplash.com/photo-1579684385127-1ef15d508118?w=150&auto=format&fit=crop&q=80",
    },
    {
      id: "usr_rec_1",
      email: "reception@cims.hospital",
      name: "Emma Watson",
      role: "RECEPTIONIST" as const,
      department: "Patient Registration & Front Desk",
      phone: "+1 555-0100",
      avatar: "https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150&auto=format&fit=crop&q=80",
    },
    {
      id: "usr_pharm_1",
      email: "pharmacy@cims.hospital",
      name: "David Kim, PharmD",
      role: "PHARMACIST" as const,
      department: "Central Pharmacy",
      licenseNumber: "PHM-LIC-3341",
      phone: "+1 555-0182",
      avatar: "https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?w=150&auto=format&fit=crop&q=80",
    },
    {
      id: "usr_lab_1",
      email: "lab@cims.hospital",
      name: "Dr. Robert Langdon",
      role: "LAB_TECH" as const,
      department: "Diagnostic Pathology & Biochemistry",
      licenseNumber: "LAB-SCI-5590",
      phone: "+1 555-0133",
      avatar: "https://images.unsplash.com/photo-1562774053-701939374585?w=150&auto=format&fit=crop&q=80",
    },
    {
      id: "usr_bill_1",
      email: "billing@cims.hospital",
      name: "Sophia Martinez",
      role: "BILLING_OFFICER" as const,
      department: "Patient Accounts & Billing",
      phone: "+1 555-0111",
      avatar: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80",
    },
  ];

  for (const user of users) {
    await prisma.user.upsert({
      where: { email: user.email },
      update: user,
      create: user,
    });
  }
  console.log(`✅ Seeded ${users.length} staff users.`);

  // 2. Seed Medications Formulary
  for (const med of FORMULARY_MEDICATIONS) {
    const existing = await prisma.medication.findFirst({
      where: { brandName: med.brandName },
    });
    if (!existing) {
      await prisma.medication.create({
        data: {
          brandName: med.brandName,
          genericName: med.genericName,
          form: med.form,
          strength: med.strength,
          stockQuantity: med.stockQuantity,
          minStockLevel: med.minStockLevel,
          unitPrice: med.unitPrice,
          batchNumber: `BAT-${Math.floor(100000 + Math.random() * 900000)}`,
          expiryDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 365 * 2), // 2 years out
          manufacturer: "Global Pharma Corp",
        },
      });
    }
  }
  console.log(`✅ Seeded ${FORMULARY_MEDICATIONS.length} formulary medications.`);

  // 3. Seed Lab Test Catalog
  for (const test of STANDARD_LAB_TESTS) {
    await prisma.labTestCatalog.upsert({
      where: { testCode: test.testCode },
      update: test,
      create: test,
    });
  }
  console.log(`✅ Seeded ${STANDARD_LAB_TESTS.length} laboratory catalog tests.`);

  // 4. Seed Realistic Patients
  const patientsData = [
    {
      mrn: "CIMS-2026-0001",
      firstName: "James",
      lastName: "Wilson",
      gender: "Male",
      dateOfBirth: new Date("1978-04-12"),
      bloodGroup: "O+",
      phone: "+1 (555) 234-5678",
      email: "james.wilson@example.com",
      nationalId: "SSN-984-21-4321",
      address: "742 Evergreen Terrace, Springfield",
      emergencyContactName: "Martha Wilson",
      emergencyContactPhone: "+1 (555) 234-5679",
      emergencyContactRelation: "Spouse",
      allergies: JSON.stringify(["Penicillin", "Sulfa drugs"]),
      chronicConditions: JSON.stringify(["Hypertension", "Hyperlipidemia"]),
    },
    {
      mrn: "CIMS-2026-0002",
      firstName: "Eleanor",
      lastName: "Rigby",
      gender: "Female",
      dateOfBirth: new Date("1992-09-24"),
      bloodGroup: "A+",
      phone: "+1 (555) 876-5432",
      email: "eleanor.rigby@example.com",
      nationalId: "SSN-342-88-1290",
      address: "12 Abbey Road, Westminster",
      emergencyContactName: "John Rigby",
      emergencyContactPhone: "+1 (555) 876-5430",
      emergencyContactRelation: "Brother",
      allergies: JSON.stringify(["None known"]),
      chronicConditions: JSON.stringify(["Asthma (mild persistent)"]),
    },
    {
      mrn: "CIMS-2026-0003",
      firstName: "Alexander",
      lastName: "Hamilton",
      gender: "Male",
      dateOfBirth: new Date("1985-01-11"),
      bloodGroup: "B+",
      phone: "+1 (555) 345-9876",
      email: "a.hamilton@example.com",
      nationalId: "SSN-177-76-1804",
      address: "57 Wall Street, New York",
      emergencyContactName: "Elizabeth Schuyler",
      emergencyContactPhone: "+1 (555) 345-9877",
      emergencyContactRelation: "Spouse",
      allergies: JSON.stringify(["Aspirin"]),
      chronicConditions: JSON.stringify(["Type 2 Diabetes Mellitus"]),
    },
    {
      mrn: "CIMS-2026-0004",
      firstName: "Chloe",
      lastName: "Bennett",
      gender: "Female",
      dateOfBirth: new Date("2001-07-19"),
      bloodGroup: "AB-",
      phone: "+1 (555) 654-3210",
      email: "chloe.b@example.com",
      nationalId: "SSN-512-44-6721",
      address: "404 North Elm Street, Seattle",
      emergencyContactName: "Karen Bennett",
      emergencyContactPhone: "+1 (555) 654-3211",
      emergencyContactRelation: "Mother",
      allergies: JSON.stringify(["Latex", "Peanuts"]),
      chronicConditions: JSON.stringify(["None"]),
    },
    {
      mrn: "CIMS-2026-0005",
      firstName: "Samuel",
      lastName: "Jackson",
      gender: "Male",
      dateOfBirth: new Date("1964-12-21"),
      bloodGroup: "O-",
      phone: "+1 (555) 901-2345",
      email: "sam.jackson@example.com",
      nationalId: "SSN-890-11-2345",
      address: "100 Sunset Blvd, Los Angeles",
      emergencyContactName: "LaTanya Richardson",
      emergencyContactPhone: "+1 (555) 901-2346",
      emergencyContactRelation: "Spouse",
      allergies: JSON.stringify(["Iodine contrast dye"]),
      chronicConditions: JSON.stringify(["Coronary Artery Disease", "GERD"]),
    },
  ];

  const seededPatients = [];
  for (const p of patientsData) {
    const pt = await prisma.patient.upsert({
      where: { mrn: p.mrn },
      update: p,
      create: p,
    });
    seededPatients.push(pt);
  }
  console.log(`✅ Seeded ${seededPatients.length} patients.`);

  // 5. Seed Vitals for James Wilson
  await prisma.vitals.create({
    data: {
      patientId: seededPatients[0].id,
      systolicBP: 138,
      diastolicBP: 88,
      heartRate: 76,
      temperature: 98.6,
      respiratoryRate: 16,
      spO2: 98,
      weightKg: 82.5,
      heightCm: 178,
      bmi: 26.0,
      bloodGlucose: 104,
      painScore: 2,
      notes: "Patient reports slight morning tension headache. BP slightly elevated.",
      recordedBy: "Clara Oswald, RN",
    },
  });

  // Seed Vitals for Eleanor Rigby
  await prisma.vitals.create({
    data: {
      patientId: seededPatients[1].id,
      systolicBP: 118,
      diastolicBP: 76,
      heartRate: 82,
      temperature: 100.4,
      respiratoryRate: 20,
      spO2: 96,
      weightKg: 61.0,
      heightCm: 165,
      bmi: 22.4,
      painScore: 4,
      notes: "Presents with mild wheezing, sore throat, and low grade fever.",
      recordedBy: "Clara Oswald, RN",
    },
  });

  // 6. Seed Today's Queue & Appointments
  const today = new Date();
  const doc1 = await prisma.user.findUnique({ where: { email: "dr.sarah@cims.hospital" } });
  const doc2 = await prisma.user.findUnique({ where: { email: "dr.marcus@cims.hospital" } });

  if (doc1 && doc2) {
    // Appointment 1: In Consultation
    const appt1 = await prisma.appointment.create({
      data: {
        patientId: seededPatients[0].id,
        doctorId: doc1.id,
        department: "Internal Medicine",
        scheduledAt: new Date(today.setHours(9, 30, 0, 0)),
        tokenNumber: 1,
        status: "IN_CONSULTATION",
        reason: "Hypertension 3-month follow up & medication renewal",
        type: "FOLLOW_UP",
      },
    });

    // Appointment 2: Waiting in OPD
    await prisma.appointment.create({
      data: {
        patientId: seededPatients[1].id,
        doctorId: doc1.id,
        department: "Internal Medicine",
        scheduledAt: new Date(today.setHours(10, 0, 0, 0)),
        tokenNumber: 2,
        status: "WAITING",
        reason: "Persistent productive cough, fever for 3 days",
        type: "OPD",
      },
    });

    // Appointment 3: Waiting in OPD
    await prisma.appointment.create({
      data: {
        patientId: seededPatients[2].id,
        doctorId: doc1.id,
        department: "Internal Medicine",
        scheduledAt: new Date(today.setHours(10, 30, 0, 0)),
        tokenNumber: 3,
        status: "WAITING",
        reason: "Fasting blood glucose routine check and dietary review",
        type: "OPD",
      },
    });

    // Appointment 4: Scheduled Cardiology
    await prisma.appointment.create({
      data: {
        patientId: seededPatients[4].id,
        doctorId: doc2.id,
        department: "Cardiology",
        scheduledAt: new Date(today.setHours(11, 0, 0, 0)),
        tokenNumber: 4,
        status: "SCHEDULED",
        reason: "Chest discomfort on exertion, treadmill stress test evaluation",
        type: "OPD",
      },
    });

    // 7. Seed an Active Encounter for Patient 1
    const encounter = await prisma.encounter.create({
      data: {
        patientId: seededPatients[0].id,
        doctorId: doc1.id,
        appointmentId: appt1.id,
        status: "IN_PROGRESS",
        chiefComplaint: "Occasional morning headaches, renewal of antihypertensive meds.",
        hpi: "48-year-old male with 4-year history of primary hypertension. Reports taking Amlodipine regularly with good adherence. No chest pain, palpitations, or shortness of breath. Occasional stress at workplace.",
        physicalExam: "Alert, oriented x 3. Chest: Bilateral air entry clear, no wheezes or rales. CVS: S1+S2 heard, regular rate and rhythm, no murmurs. Abdomen: Soft, non-tender. Extremities: No pedal edema.",
        assessmentPlan: "1. Stage 1 Essential Hypertension - adequately controlled.\n2. Hyperlipidemia - continue statin therapy.\nPlan: Continue current meds, order routine Lipid Panel and Renal Function Test.",
        clinicalNotes: "Encouraged 30 min daily brisk walking and low-sodium DASH diet.",
      },
    });

    // Diagnoses for Encounter
    await prisma.diagnosis.create({
      data: {
        encounterId: encounter.id,
        icdCode: "I10",
        description: "Essential (primary) hypertension",
        type: "FINAL",
        notes: "Well-managed with current Amlodipine regimen",
      },
    });

    await prisma.diagnosis.create({
      data: {
        encounterId: encounter.id,
        icdCode: "E78.5",
        description: "Hyperlipidemia, unspecified",
        type: "PROVISIONAL",
      },
    });

    // Prescription for Encounter
    const rx = await prisma.prescription.create({
      data: {
        encounterId: encounter.id,
        patientId: seededPatients[0].id,
        doctorId: doc1.id,
        status: "PENDING",
        notes: "Take Amlodipine in morning, Atorvastatin at bedtime.",
      },
    });

    await prisma.prescriptionItem.createMany({
      data: [
        {
          prescriptionId: rx.id,
          medicationName: "Norvasc (Amlodipine)",
          genericName: "Amlodipine",
          dosage: "5mg",
          route: "Oral",
          frequency: "1-0-0 (Once daily morning)",
          duration: "30 days",
          quantity: 30,
          instructions: "Take with water with or without breakfast",
          isDispensed: false,
        },
        {
          prescriptionId: rx.id,
          medicationName: "Lipitor (Atorvastatin)",
          genericName: "Atorvastatin",
          dosage: "20mg",
          route: "Oral",
          frequency: "0-0-1 (Once daily at bedtime)",
          duration: "30 days",
          quantity: 30,
          instructions: "Take after dinner at night",
          isDispensed: false,
        },
      ],
    });

    // Diagnostic Lab Order for Encounter
    const labOrder = await prisma.labOrder.create({
      data: {
        orderNumber: "LAB-2026-0001",
        patientId: seededPatients[0].id,
        doctorId: doc1.id,
        encounterId: encounter.id,
        status: "ORDERED",
        priority: "ROUTINE",
        technicianNotes: "Fasting lipid panel and basic renal profile requested.",
      },
    });

    await prisma.labOrderItem.createMany({
      data: [
        {
          labOrderId: labOrder.id,
          testName: "Lipid Profile Panel",
          category: "Biochemistry",
          status: "PENDING",
          referenceRange: "Total Chol: < 200 mg/dL, HDL: > 40 mg/dL, LDL: < 100 mg/dL",
        },
        {
          labOrderId: labOrder.id,
          testName: "Renal / Kidney Function Test (RFT/KFT)",
          category: "Biochemistry",
          status: "PENDING",
          referenceRange: "Serum Creatinine: 0.6-1.2 mg/dL, BUN: 7-20 mg/dL",
        },
      ],
    });

    // Billing Invoice for Encounter
    const invoice = await prisma.invoice.create({
      data: {
        invoiceNumber: "INV-2026-0001",
        patientId: seededPatients[0].id,
        encounterId: encounter.id,
        subtotal: 125.0,
        discount: 0.0,
        tax: 6.25,
        totalAmount: 131.25,
        paidAmount: 0.0,
        balanceDue: 131.25,
        status: "UNPAID",
        paymentMethod: "Credit Card",
        notes: "Includes Physician Consultation + Fasting Lab Package",
      },
    });

    await prisma.invoiceItem.createMany({
      data: [
        {
          invoiceId: invoice.id,
          description: "Internal Medicine Specialist Consultation (Dr. Sarah Jenkins)",
          category: "CONSULTATION",
          quantity: 1,
          unitPrice: 55.0,
          totalPrice: 55.0,
        },
        {
          invoiceId: invoice.id,
          description: "Lipid Profile Panel",
          category: "LAB_TEST",
          quantity: 1,
          unitPrice: 40.0,
          totalPrice: 40.0,
        },
        {
          invoiceId: invoice.id,
          description: "Renal Function Test (RFT)",
          category: "LAB_TEST",
          quantity: 1,
          unitPrice: 30.0,
          totalPrice: 30.0,
        },
      ],
    });

    // Audit Log Entry
    await prisma.auditLog.create({
      data: {
        userId: doc1.id,
        userName: doc1.name,
        userRole: "DOCTOR",
        action: "CREATE",
        resource: "ENCOUNTER",
        resourceId: encounter.id,
        details: `Clinical encounter initiated for patient MRN ${seededPatients[0].mrn}`,
        ipAddress: "127.0.0.1",
      },
    });
  }

  console.log("🎉 Database seeding completed successfully!");
}

main()
  .catch((e) => {
    console.error("❌ Seeding failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
