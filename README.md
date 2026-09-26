# CIMS Clinic

CIMS is a single-practitioner clinic application for patient records, appointments, consultations, prescriptions and payments. The project is split into separate frontend and backend applications, following the structure of the local LIMS project.

## Project structure

| Folder | Responsibility | Default port |
| --- | --- | --- |
| `frontend/` | Next.js clinic interface, styling and client workflows | `3000` |
| `backend/` | Next.js API routes, Prisma access, database schema and seed data | `3001` |

The frontend proxies `/api/*` requests to the backend. Existing browser calls keep the same `/api/...` paths.

## Run locally

```bash
npm install
npm run db:push
npm run db:seed
npm run dev
```

Open `http://localhost:3000`. The backend API runs at `http://localhost:3001`.

For separate terminals, use:

```bash
npm run dev:backend
npm run dev:frontend
```

## Configuration

Copy `backend/.env.example` to `backend/.env` for the database connection. Copy `frontend/.env.example` to `frontend/.env.local` when the API is hosted at a different URL.

Set the clinic identity in `frontend/.env.local`:

```bash
NEXT_PUBLIC_FACILITY_NAME="Your Clinic Name"
NEXT_PUBLIC_FACILITY_ADDRESS="Street, city, province"
NEXT_PUBLIC_FACILITY_PHONE="+92 300 1234567"
BACKEND_URL="http://localhost:3001"
```

## Pakistan defaults

- PKR currency with the `en-PK` locale
- Asia/Karachi appointment tokens and daily figures
- Optional CNIC / B-form with 13-digit validation
- Pakistan telephone validation for `03xx` and `+92` forms
- Cash, card, bank transfer, Raast, JazzCash, Easypaisa and insurance payment channels
- Celsius temperatures

## Clinic workflow

- Patient registration and records
- Single-practitioner appointment queue
- Doctor consultation workspace linked to the called patient's appointment
- Inline doctor-recorded vitals, notes, diagnosis, prescription and follow-up
- Automatic drafts and manual Save Draft; Finish Consultation saves all entries and completes the appointment together
- Previous visits and vitals alongside the editor; finalized records are read-only in Patient 360
- Allergy fields and alerts are retired; legacy database values are retained but excluded from the generated client and APIs
- One consultation invoice per finalized consultation
- Payment collection, dues and printable receipts

## Validation

```bash
npm run build
cd backend
npx tsx --tsconfig tsconfig.json --test tests/consultation.test.ts
```

The consultation test creates and removes a temporary SQLite database; it does not use the clinic database. Run `npm run db:push` after updating to add the encounter draft and revision fields. Stop the backend dev server before regenerating Prisma on Windows if its engine DLL is locked.
