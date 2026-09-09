# CIMS - Clinical Integrated Management System (v1.0)

An enterprise-grade, modular, and standards-aligned hospital management and clinical documentation platform built with Next.js 15, React 19, TypeScript, Tailwind CSS, and Prisma ORM.

---

## 🏥 Modules & Clinical Workspaces

1. **Master Patient Index (PMI)**:
   - Universal Medical Record Number (MRN) auto-generation (`CIMS-YYYY-XXXX`).
   - Demographic registry, emergency contact profiles, blood group tagging.
   - Prominent clinical alert banners for drug allergies (e.g. Penicillin, Sulfa) and chronic diseases.
   - Comprehensive **Patient 360** with timeline of vitals, encounters, prescriptions, lab results, and financial invoices.

2. **Outpatient (OPD) Queue & Scheduling**:
   - Automated token allocation and multi-physician queue management.
   - Real-time queue boards: **Waiting Lobby**, **In Consultation**, and **Completed Visits**.
   - Immediate triage vitals indicator and quick "Call In" / "Start Consultation" transitions.

3. **Doctor Clinical Workspace & Electronic Medical Record (EMR)**:
   - Structured **SOAP Notes** documentation (Subjective, Objective, Assessment, Plan).
   - Real-time Vitals monitoring with automated BMI and Blood Pressure Stage classifications (Normal, Elevated, Stage 1 HTN, Stage 2 HTN, Hypertensive Crisis).
   - **ICD-10 Diagnostic coding** search and categorization (Provisional vs. Final).
   - **Electronic Prescriptions (e-Rx)** linked directly to formulary medications with dosage schedules and instructions.
   - **Diagnostic Test Orders** (Hematology, Biochemistry, Radiology).
   - One-click "Sign & Finalize Encounter" generating downstream pharmacy orders, lab orders, and itemized billing.

4. **Diagnostic Laboratory Information System (LIS)**:
   - Accessioning worklist filtered by clinical priority (`ROUTINE`, `URGENT`, `STAT`).
   - Specimen processing, electronic result value entry, unit comparisons, and normal reference ranges.
   - Abnormal value flagging to alert clinicians.

5. **Pharmacy & Medication Dispensing**:
   - Live prescription fulfillment queue.
   - One-click dispensing action with automatic stock inventory deduction.
   - Medication formulary catalog with minimum stock alerts.

6. **Point-of-Care Billing & Invoicing**:
   - Automatic bill aggregation from consultation fees, laboratory panels, and dispensed medications.
   - Multi-channel payment collection (Cash, Credit Card, Insurance, Mobile Banking).
   - Printable official hospital receipts with itemized breakdown, tax calculations, and cashier signature line.

7. **System Administration & HIPAA Audit Engine**:
   - Role-Based Access Control (RBAC) supporting 7 distinct hospital personas (Doctor, Nurse, Receptionist, Lab Tech, Pharmacist, Billing Officer, Administrator).
   - Built-in live staff role switcher in the header for frictionless cross-department workflow evaluation.
   - Immutable audit trail recording every clinical read, write, dispense, and finalization action.

---

## 🚀 Quick Start Guide

### Prerequisites
- Node.js (v18+ recommended, v24 tested)
- npm

### Installation & Setup

```bash
# 1. Install dependencies
npm install

# 2. Push database schema (SQLite development database)
npm run db:push

# 3. Seed demo clinical data, doctors, patients, and catalogs
npm run db:seed

# 4. Start local development server
npm run dev
```

Open `http://localhost:3000` in your web browser.

---

## 🛠️ Architecture & Tech Stack

- **Framework**: Next.js 15 (App Router, Server Components & Route Handlers)
- **UI & Styling**: Tailwind CSS, Lucide Icons, Radix primitives
- **Language**: TypeScript (Strict type checking)
- **Persistence**: Prisma ORM with SQLite (zero local configuration; seamless migration to PostgreSQL for high-availability production clusters via `.env` connection string)
