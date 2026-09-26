import type { User } from "@cims/prisma-client";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { parsePermissions, type PermissionKey } from "@/lib/permissions";

export class ApiAuthorizationError extends Error {
  constructor(message: string, public readonly status: 401 | 403) {
    super(message);
    this.name = "ApiAuthorizationError";
  }
}

type ActorRequirements = {
  anyOf?: PermissionKey[];
  allOf?: PermissionKey[];
};

export type AuthenticatedActor = User & { grantedPermissions: PermissionKey[] };

export async function requireActor(request: Request, requirements: ActorRequirements = {}): Promise<AuthenticatedActor> {
  const actorId = request.headers.get("x-cims-user-id")?.trim();
  if (!actorId) throw new ApiAuthorizationError("Sign in is required.", 401);

  const actor = await prisma.user.findUnique({ where: { id: actorId } });
  if (!actor) throw new ApiAuthorizationError("Your session is no longer valid. Sign in again.", 401);
  if (!actor.isActive) throw new ApiAuthorizationError("This user account is inactive.", 403);

  const grantedPermissions = parsePermissions(actor.permissions, actor.role);
  if (requirements.anyOf?.length && !requirements.anyOf.some(permission => grantedPermissions.includes(permission))) {
    throw new ApiAuthorizationError("You do not have permission to perform this action.", 403);
  }
  if (requirements.allOf?.length && !requirements.allOf.every(permission => grantedPermissions.includes(permission))) {
    throw new ApiAuthorizationError("You do not have permission to perform this action.", 403);
  }

  return Object.assign(actor, { grantedPermissions });
}

export function authorizationErrorResponse(error: unknown) {
  if (!(error instanceof ApiAuthorizationError)) return null;
  return NextResponse.json({ success: false, error: error.message }, { status: error.status });
}

export function requestIp(request: Request) {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || request.headers.get("x-real-ip")
    || null;
}
