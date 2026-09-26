import { Prisma } from "@cims/prisma-client";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

const PAGE_SIZE = 50;

async function authorizedActor(request: Request) {
  const id = request.headers.get("x-cims-user-id");
  if (!id) return null;
  const actor = await prisma.user.findUnique({ where: { id } });
  return actor?.isActive && (actor.role === "ADMIN" || actor.role === "ENGINEER") ? actor : null;
}

function validDate(value: string | null, endOfDay = false) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const date = new Date(`${value}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}+05:00`);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

export async function GET(request: Request) {
  const actor = await authorizedActor(request);
  if (!actor) return NextResponse.json({ error: "Engineer or Super User access required." }, { status: 403 });

  try {
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, Number.parseInt(searchParams.get("page") || "1", 10) || 1);
    const userId = searchParams.get("userId") || undefined;
    const action = searchParams.get("action") || undefined;
    const from = validDate(searchParams.get("from"));
    const to = validDate(searchParams.get("to"), true);

    const engineers = actor.role === "ENGINEER" ? [] : await prisma.user.findMany({
      where: { role: "ENGINEER" },
      select: { id: true, name: true },
    });
    const engineerIds = engineers.map(user => user.id);
    const engineerNames = engineers.map(user => user.name);
    const visibility: Prisma.AuditLogWhereInput = engineerIds.length ? {
      NOT: {
        OR: [
          { userId: { in: engineerIds } },
          { userName: { in: engineerNames } },
          { resource: "USER", resourceId: { in: engineerIds } },
        ],
      },
    } : {};
    const where: Prisma.AuditLogWhereInput = {
      AND: [
        visibility,
        userId ? { userId } : {},
        action ? { action } : {},
        from || to ? { timestamp: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } } : {},
      ],
    };

    const [auditLogs, total, users, actionRows] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy: { timestamp: "desc" },
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
        include: { user: { select: { id: true, name: true, username: true } } },
      }),
      prisma.auditLog.count({ where }),
      prisma.user.findMany({
        where: actor.role === "ENGINEER" ? undefined : { role: { not: "ENGINEER" } },
        orderBy: { name: "asc" },
        select: { id: true, name: true, username: true },
      }),
      prisma.auditLog.groupBy({ by: ["action"], where: visibility, orderBy: { action: "asc" } }),
    ]);

    return NextResponse.json({
      success: true,
      auditLogs,
      users,
      actions: actionRows.map(row => row.action),
      total,
      page,
      pageSize: PAGE_SIZE,
    });
  } catch (error) {
    console.error("Fetch audit logs error:", error);
    return NextResponse.json({ success: false, error: "Failed to fetch audit logs" }, { status: 500 });
  }
}
