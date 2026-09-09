import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { calculateBMI } from "@/lib/utils";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      patientId,
      encounterId,
      systolicBP,
      diastolicBP,
      heartRate,
      temperature,
      respiratoryRate,
      spO2,
      weightKg,
      heightCm,
      bloodGlucose,
      painScore,
      notes,
      recordedBy,
    } = body;

    if (!patientId) {
      return NextResponse.json(
        { success: false, error: "Patient ID is required." },
        { status: 400 }
      );
    }

    const bmiData = calculateBMI(weightKg, heightCm);

    const vitals = await prisma.vitals.create({
      data: {
        patientId,
        encounterId: encounterId || null,
        systolicBP: systolicBP ? parseInt(systolicBP) : null,
        diastolicBP: diastolicBP ? parseInt(diastolicBP) : null,
        heartRate: heartRate ? parseInt(heartRate) : null,
        temperature: temperature ? parseFloat(temperature) : null,
        respiratoryRate: respiratoryRate ? parseInt(respiratoryRate) : null,
        spO2: spO2 ? parseInt(spO2) : null,
        weightKg: weightKg ? parseFloat(weightKg) : null,
        heightCm: heightCm ? parseFloat(heightCm) : null,
        bmi: bmiData ? bmiData.bmi : null,
        bloodGlucose: bloodGlucose ? parseFloat(bloodGlucose) : null,
        painScore: painScore ? parseInt(painScore) : null,
        notes: notes || null,
        recordedBy: recordedBy || "Triage Nurse",
      },
    });

    return NextResponse.json({ success: true, vitals }, { status: 201 });
  } catch (error) {
    console.error("Save vitals error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to record vital signs" },
      { status: 500 }
    );
  }
}
