export interface StandardLabTest {
  testCode: string;
  testName: string;
  category: string;
  sampleType: string;
  price: number;
  normalRange: string;
  turnaroundTime: string;
}

export const STANDARD_LAB_TESTS: StandardLabTest[] = [
  {
    testCode: "CBC-001",
    testName: "Complete Blood Count (CBC)",
    category: "Hematology",
    sampleType: "Whole Blood (EDTA)",
    price: 1000,
    normalRange: "WBC: 4.5-11.0 x10^3/uL, RBC: 4.3-5.9 x10^6/uL, Hb: 13.5-17.5 g/dL, Platelets: 150-450 x10^3/uL",
    turnaroundTime: "2 hours",
  },
  {
    testCode: "LFT-002",
    testName: "Liver Function Test (LFT)",
    category: "Biochemistry",
    sampleType: "Serum",
    price: 1400,
    normalRange: "ALT: 7-56 U/L, AST: 10-40 U/L, ALP: 44-147 U/L, Total Bilirubin: 0.1-1.2 mg/dL",
    turnaroundTime: "4 hours",
  },
  {
    testCode: "KFT-003",
    testName: "Renal / Kidney Function Test (RFT/KFT)",
    category: "Biochemistry",
    sampleType: "Serum",
    price: 1200,
    normalRange: "BUN: 7-20 mg/dL, Serum Creatinine: 0.6-1.2 mg/dL, eGFR: > 90 mL/min/1.73m2",
    turnaroundTime: "3 hours",
  },
  {
    testCode: "LIP-004",
    testName: "Lipid Profile Panel",
    category: "Biochemistry",
    sampleType: "Fasting Serum",
    price: 1600,
    normalRange: "Total Chol: < 200 mg/dL, Triglycerides: < 150 mg/dL, HDL: > 40 mg/dL, LDL: < 100 mg/dL",
    turnaroundTime: "4 hours",
  },
  {
    testCode: "GLU-005",
    testName: "Fasting Blood Sugar (FBS)",
    category: "Biochemistry",
    sampleType: "Fluoride Plasma",
    price: 600,
    normalRange: "70-99 mg/dL (Normal Fasting)",
    turnaroundTime: "1 hour",
  },
  {
    testCode: "HBA1C-006",
    testName: "Glycated Hemoglobin (HbA1c)",
    category: "Biochemistry",
    sampleType: "Whole Blood (EDTA)",
    price: 1400,
    normalRange: "< 5.7% (Normal), 5.7-6.4% (Prediabetes), >= 6.5% (Diabetes)",
    turnaroundTime: "3 hours",
  },
  {
    testCode: "UA-007",
    testName: "Urinalysis Routine & Microscopy",
    category: "Urinalysis",
    sampleType: "Mid-stream Clean Catch Urine",
    price: 800,
    normalRange: "Color: Pale yellow, Clarity: Clear, pH: 5.0-7.0, Protein: Negative, Glucose: Negative",
    turnaroundTime: "1 hour",
  },
  {
    testCode: "THY-008",
    testName: "Thyroid Profile (TSH, Free T3, Free T4)",
    category: "Endocrinology",
    sampleType: "Serum",
    price: 1800,
    normalRange: "TSH: 0.4-4.0 uIU/mL, FT3: 2.3-4.2 pg/mL, FT4: 0.8-1.8 ng/dL",
    turnaroundTime: "6 hours",
  },
  {
    testCode: "CXR-009",
    testName: "Chest X-Ray PA View",
    category: "Radiology",
    sampleType: "Diagnostic Imaging",
    price: 2000,
    normalRange: "Normal lung fields, normal cardiothoracic ratio, no infiltrates or effusion",
    turnaroundTime: "2 hours",
  },
];
