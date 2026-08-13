import { NextResponse } from "next/server";
import {
  getBearerPayload,
  requirePermissions,
  type AccessTokenPayload,
} from "./auth-server";
import { hasPermission, hasAnyPermission } from "@nysc/auth";

export function jsonOk<T>(data: T, status = 200) {
  return NextResponse.json(data, { status });
}

export function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function requireAuth(
  req: Request,
  permission?: string | string[]
): Promise<{ payload: AccessTokenPayload } | NextResponse> {
  const payload = await getBearerPayload(req.headers.get("authorization"));
  if (!payload) {
    return jsonError("Unauthorized", 401);
  }
  if (permission) {
    const ok = Array.isArray(permission)
      ? hasPermission(payload.permissions, permission)
      : hasPermission(payload.permissions, permission);
    if (!ok) {
      return jsonError("Forbidden", 403);
    }
  }
  return { payload };
}

/** Pass if user has ANY of the listed permissions */
export async function requireAnyAuth(
  req: Request,
  permissions: string[]
): Promise<{ payload: AccessTokenPayload } | NextResponse> {
  const payload = await getBearerPayload(req.headers.get("authorization"));
  if (!payload) {
    return jsonError("Unauthorized", 401);
  }
  if (!hasAnyPermission(payload.permissions, permissions)) {
    return jsonError("Forbidden — need one of: " + permissions.join(", "), 403);
  }
  return { payload };
}

export function clientMeta(req: Request) {
  return {
    ip:
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      req.headers.get("x-real-ip") ??
      undefined,
    userAgent: req.headers.get("user-agent") ?? undefined,
  };
}

export { requirePermissions };
