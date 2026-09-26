import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { parsePermissions, publicRole } from "@/lib/permissions";

export async function POST(request: Request) {
  const body = await request.json();
  const login = String(body.username || body.email || "").trim().toLowerCase();
  const password = String(body.password || "");
  const ipAddress = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown";
  const users = await prisma.user.findMany();
  const user = users.find(item => item.username?.toLowerCase() === login || item.email.toLowerCase() === login || item.email.split("@")[0].toLowerCase() === login);
  if (!user || user.password !== password) {
    const username = login || "unknown";
    const existing = await prisma.securityAlert.findUnique({ where: { username_ipAddress: { username, ipAddress } } });
    const withinWindow = existing && Date.now() - existing.updatedAt.getTime() <= 15 * 60 * 1000;
    await prisma.securityAlert.upsert({
      where: { username_ipAddress: { username, ipAddress } },
      create: { username, ipAddress },
      update: withinWindow
        ? { failedCount: { increment: 1 }, isRead: false }
        : { failedCount: 1, isRead: false, createdAt: new Date() },
    });
    return NextResponse.json({ error: "Incorrect username or password." }, { status: 401 });
  }
  if (!user.isActive) return NextResponse.json({ error: "This account has been deactivated." }, { status: 403 });
  await prisma.securityAlert.updateMany({ where: { username: login, failedCount: { lt: 3 }, isRead: false }, data: { isRead: true } });
  return NextResponse.json({ user: { ...user, password: undefined, role: publicRole(user.role), permissions: parsePermissions(user.permissions, user.role) } });
}
