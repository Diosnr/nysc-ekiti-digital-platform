import { prisma } from "@/lib/db";
import { verifyPassword, issueTokens } from "@/lib/auth-server";
import { writeAudit } from "@/lib/audit";
import { jsonOk, jsonError, clientMeta } from "@/lib/api";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const email = String(body.email ?? "").trim().toLowerCase();
    const password = String(body.password ?? "");

    if (!email || !password) {
      return jsonError("Email and password are required");
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.isActive || !user.passwordHash) {
      return jsonError("Invalid credentials", 401);
    }

    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid) {
      return jsonError("Invalid credentials", 401);
    }

    const meta = clientMeta(req);
    const tokens = await issueTokens(user.id, meta);

    await writeAudit({
      actorId: user.id,
      actorEmail: user.email,
      actorRoleAtTime: tokens.roles.join(","),
      action: "auth.login",
      entityType: "User",
      entityId: user.id,
      ip: meta.ip,
      userAgent: meta.userAgent,
    });

    return jsonOk({
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user: tokens.user,
      roles: tokens.roles,
      permissions: tokens.permissions,
    });
  } catch (e) {
    console.error("login error", e);
    return jsonError("Login failed", 500);
  }
}
