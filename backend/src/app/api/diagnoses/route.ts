import { NextResponse } from "next/server";

function useConsultation() {
  return NextResponse.json({ success: false, error: "Record diagnoses in the patient's active consultation. Finalized visit history is read-only." }, { status: 409 });
}
export async function POST() { return useConsultation(); }
export async function DELETE() { return useConsultation(); }
