import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { encounterId, icdCode, description, type, notes } = body;

    if (!encounterId || !icdCode || !description) {
      return NextResponse.json(
        { success: false, error: "Encounter ID, ICD Code, and Description are required." },
        { status: 400 }
      );
    }

    const diagnosis = await prisma.diagnosis.create({
      data: {
        encounterId,
        icdCode,
        description,
        type: type || "PROVISIONAL",
        notes: notes || null,
      },
    });

    return NextResponse.json({ success: true, diagnosis }, { status: 201 });
  } catch (error) {
    console.error("Create diagnosis error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to add diagnosis" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { success: false, error: "Diagnosis ID is required." },
        { status: 400 }
      );
    }

    await prisma.diagnosis.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete diagnosis error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to delete diagnosis" },
      { status: 500 }
    );
  }
}
