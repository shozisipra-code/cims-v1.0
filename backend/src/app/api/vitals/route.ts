import { NextResponse } from "next/server";

// Vitals share the encounter's draft and finalization guards.
export async function POST() {
  return NextResponse.json({ success: false, error: "Record vital signs inside the patient's active consultation." }, { status: 409 });
}
