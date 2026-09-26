import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { defaultPermissions, parsePermissions, permissionKeys, publicRole } from "@/lib/permissions";

const allowedRoles = ["SUPER_USER", "DOCTOR", "RECEPTIONIST", "PHARMACIST", "ENGINEER"];
const dbRole = (role: string) => role === "SUPER_USER" ? "ADMIN" : role;
const clientIp = (request: Request) => request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || null;
async function authorizedActor(request: Request) {
  const id = request.headers.get("x-cims-user-id");
  if (!id) return null;
  const actor = await prisma.user.findUnique({ where: { id } });
  return actor?.isActive && (actor.role === "ADMIN" || actor.role === "ENGINEER") ? actor : null;
}
const publicUser = (user: any) => ({ ...user, password: undefined, role: publicRole(user.role), permissions: parsePermissions(user.permissions, user.role) });

export async function GET(request: Request) {
  if (!await authorizedActor(request)) return NextResponse.json({ error: "Engineer or Super User access required." }, { status: 403 });
  const users = await prisma.user.findMany({ orderBy: { createdAt: "desc" } });
  return NextResponse.json(users.map(publicUser));
}

export async function POST(request: Request) {
  const actor = await authorizedActor(request);
  if (!actor) return NextResponse.json({ error: "Engineer or Super User access required." }, { status: 403 });
  const body = await request.json();
  const role = String(body.role || "");
  const username = String(body.username || "").trim().toLowerCase();
  const phone = String(body.phone || "").replace(/\D/g, "");
  if (!allowedRoles.includes(role)) return NextResponse.json({ error: "Invalid role." }, { status: 400 });
  if (!body.name?.trim() || !username || !body.password || String(body.password).length < 6) return NextResponse.json({ error: "Name, username and a password of at least 6 characters are required." }, { status: 400 });
  if (!/^[a-zA-Z0-9._-]{3,40}$/.test(username)) return NextResponse.json({ error: "Username must be 3–40 characters using letters, numbers, dots, dashes, or underscores." }, { status: 400 });
  if (phone && !/^\d{11}$/.test(phone)) return NextResponse.json({ error: "Phone number must contain exactly 11 digits." }, { status: 400 });
  const fullAccessRole = role === "ENGINEER" || role === "SUPER_USER";
  const permissions = fullAccessRole ? defaultPermissions[role] : Array.isArray(body.permissions) ? body.permissions.filter((key: string) => permissionKeys.includes(key as any) && key !== "audit_log") : defaultPermissions[role];
  try {
    const user = await prisma.$transaction(async transaction => {
      const created = await transaction.user.create({ data: { name: body.name.trim(), username, email: `${username}@cims.local`, password: String(body.password), role: dbRole(role) as any, department: body.department?.trim() || null, phone: phone || null, permissions: JSON.stringify(permissions), isActive: true } });
      await transaction.auditLog.create({ data: {
        userId: actor.id,
        userName: actor.name,
        userRole: publicRole(actor.role),
        action: "USER_CREATED",
        resource: "USER",
        resourceId: created.id,
        details: `Created user: ${created.name} (${created.username}) as ${publicRole(created.role)}`,
        ipAddress: clientIp(request),
      } });
      return created;
    });
    return NextResponse.json(publicUser(user), { status: 201 });
  } catch { return NextResponse.json({ error: "That username is already in use." }, { status: 409 }); }
}

export async function PATCH(request: Request) {
  const actor = await authorizedActor(request);
  if (!actor) return NextResponse.json({ error: "Engineer or Super User access required." }, { status: 403 });
  const body = await request.json();
  if (!body.id) return NextResponse.json({ error: "User id is required." }, { status: 400 });
  const target = await prisma.user.findUnique({ where: { id: body.id } });
  if (!target) return NextResponse.json({ error: "User not found." }, { status: 404 });
  if (target.role === "ENGINEER" && actor.role !== "ENGINEER") return NextResponse.json({ error: "Only an Engineer can modify an Engineer account." }, { status: 403 });
  const data: any = {};
  if (body.username !== undefined) {
    const username = String(body.username).trim().toLowerCase();
    if (!/^[a-zA-Z0-9._-]{3,40}$/.test(username)) return NextResponse.json({ error: "Username must be 3–40 characters using letters, numbers, dots, dashes, or underscores." }, { status: 400 });
    data.username = username;
  }
  if (allowedRoles.includes(body.role)) {
    data.role = dbRole(body.role);
    if (body.role === "ENGINEER" || body.role === "SUPER_USER") data.permissions = JSON.stringify(defaultPermissions[body.role]);
  }
  const resultingRole = allowedRoles.includes(body.role) ? body.role : publicRole(target.role);
  if (Array.isArray(body.permissions) && resultingRole !== "ENGINEER" && resultingRole !== "SUPER_USER") data.permissions = JSON.stringify(body.permissions.filter((key: string) => permissionKeys.includes(key as any) && key !== "audit_log"));
  if (typeof body.isActive === "boolean") data.isActive = body.isActive;
  if (body.password) {
    if (String(body.password).length < 6) return NextResponse.json({ error: "Password must be at least 6 characters." }, { status: 400 });
    data.password = String(body.password);
  }
  try {
    let action = "USER_UPDATED";
    let details = `Updated user: ${target.name} (${target.username || target.email})`;
    if (typeof body.isActive === "boolean") {
      action = body.isActive ? "USER_REACTIVATED" : "USER_DEACTIVATED";
      details = `${body.isActive ? "Reactivated" : "Deactivated"} user: ${target.name} (${target.username || target.email})`;
    } else if (allowedRoles.includes(body.role)) {
      action = "USER_ROLE_CHANGED";
      details = `Changed ${target.name}'s role from ${publicRole(target.role)} to ${body.role}`;
    } else if (Array.isArray(body.permissions)) {
      action = "USER_PERMISSIONS_CHANGED";
      details = `Updated module permissions for: ${target.name} (${target.username || target.email})`;
    } else if (body.password) {
      action = "PASSWORD_RESET";
      details = `Reset password for: ${target.name} (${target.username || target.email})`;
    }
    const user = await prisma.$transaction(async transaction => {
      const updated = await transaction.user.update({ where: { id: body.id }, data });
      await transaction.auditLog.create({ data: {
        userId: actor.id,
        userName: actor.name,
        userRole: publicRole(actor.role),
        action,
        resource: "USER",
        resourceId: updated.id,
        details,
        ipAddress: clientIp(request),
      } });
      return updated;
    });
    return NextResponse.json(publicUser(user));
  } catch { return NextResponse.json({ error: "That username is already in use." }, { status: 409 }); }
}
