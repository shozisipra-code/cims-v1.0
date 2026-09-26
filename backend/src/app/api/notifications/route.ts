import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { parsePermissions } from "@/lib/permissions";

async function getActor(req: NextRequest) {
  const id = req.headers.get("x-cims-user-id");
  if (!id) return null;
  return prisma.user.findFirst({ where: { id, isActive: true } });
}

function accessFor(actor: { role: string; permissions: string }) {
  const permissions = parsePermissions(actor.permissions, actor.role);
  const isPrivileged = actor.role === "ADMIN" || actor.role === "ENGINEER";
  const allowedAudiences: string[] = [];
  if (isPrivileged) allowedAudiences.push("QUEUE", "RECEPTION", "PHARMACY", "BILLING");
  else {
    if (permissions.some(permission => ["appointments", "patient_calling", "clinical"].includes(permission))) allowedAudiences.push("QUEUE");
    if (permissions.includes("booking")) allowedAudiences.push("RECEPTION");
    if (permissions.includes("pharmacy")) allowedAudiences.push("PHARMACY");
    if (permissions.some(permission => ["billing", "payments"].includes(permission))) allowedAudiences.push("BILLING");
  }
  return {
    allowedAudiences,
    isPrivileged,
  };
}

export async function GET(req: NextRequest) {
  try {
    const actor = await getActor(req);
    if (!actor) return NextResponse.json({ success: false, error: "Sign in to view notifications." }, { status: 401 });
    const { allowedAudiences, isPrivileged } = accessFor(actor);
    const [workflowAlerts, securityAlerts] = await Promise.all([
      allowedAudiences.length ? prisma.notification.findMany({
        where: { audience: { in: allowedAudiences }, reads: { none: { userId: actor.id } } },
        orderBy: { createdAt: "desc" },
        take: 30,
      }) : [],
      isPrivileged ? prisma.securityAlert.findMany({
        where: { isRead: false, failedCount: { gte: 3 } },
        orderBy: { updatedAt: "desc" },
        take: 30,
      }) : [],
    ]);
    return NextResponse.json({
      success: true,
      workflowAlerts,
      // Keep the previous response key during the UI transition so older clients
      // continue to show queue alerts instead of silently losing notifications.
      tickets: workflowAlerts,
      securityAlerts,
      isPrivileged,
      total: workflowAlerts.length + securityAlerts.length,
    });
  } catch (error) {
    console.error("Fetch notifications error:", error);
    return NextResponse.json({ success: false, error: "Unable to load notifications." }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const actor = await getActor(req);
    if (!actor) return NextResponse.json({ success: false, error: "Sign in to update notifications." }, { status: 401 });
    const { action, id } = await req.json();
    const { allowedAudiences, isPrivileged } = accessFor(actor);

    if (action === "READ_ALERT" || action === "READ_TICKET") {
      if (!allowedAudiences.length || !id) return NextResponse.json({ success: false, error: "Notification not available." }, { status: 403 });
      const notification = await prisma.notification.findFirst({ where: { id, audience: { in: allowedAudiences } }, select: { id: true } });
      if (!notification) return NextResponse.json({ success: false, error: "Notification not found." }, { status: 404 });
      await prisma.notificationRead.upsert({
        where: { notificationId_userId: { notificationId: id, userId: actor.id } },
        create: { notificationId: id, userId: actor.id },
        update: { readAt: new Date() },
      });
    } else if (action === "READ_ALL_ALERTS" || action === "READ_ALL_TICKETS") {
      if (!allowedAudiences.length) return NextResponse.json({ success: false, error: "Notifications not available." }, { status: 403 });
      const unread = await prisma.notification.findMany({ where: { audience: { in: allowedAudiences }, reads: { none: { userId: actor.id } } }, select: { id: true } });
      await prisma.$transaction(unread.map(notification => prisma.notificationRead.upsert({
        where: { notificationId_userId: { notificationId: notification.id, userId: actor.id } },
        create: { notificationId: notification.id, userId: actor.id },
        update: { readAt: new Date() },
      })));
    } else if (action === "READ_SECURITY") {
      if (!isPrivileged || !id) return NextResponse.json({ success: false, error: "Security alerts require administrator access." }, { status: 403 });
      await prisma.securityAlert.updateMany({ where: { id }, data: { isRead: true } });
    } else if (action === "READ_ALL_SECURITY") {
      if (!isPrivileged) return NextResponse.json({ success: false, error: "Security alerts require administrator access." }, { status: 403 });
      await prisma.securityAlert.updateMany({ where: { isRead: false }, data: { isRead: true } });
    } else {
      return NextResponse.json({ success: false, error: "Unknown notification action." }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Update notifications error:", error);
    return NextResponse.json({ success: false, error: "Unable to update notifications." }, { status: 500 });
  }
}
