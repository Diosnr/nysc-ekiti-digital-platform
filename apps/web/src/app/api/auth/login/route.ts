import { prisma } from "@/lib/db";
import { verifyPassword, issueTokens } from "@/lib/auth-server";
import { writeAudit } from "@/lib/audit";
import { jsonOk, jsonError, clientMeta } from "@/lib/api";
import { limitLogin } from "@/lib/rate-limit";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const email = String(body.email ?? "").trim().toLowerCase();
    const password = String(body.password ?? "");
    const meta = clientMeta(req);
    const ip = meta.ip ?? "unknown";

    if (!email || !password) {
      return jsonError("Email and password are required");
    }

    const limited = limitLogin(ip, email);
    if (!limited.ok) {
      return jsonError(
        `Too many login attempts. Try again in ${limited.retryAfterSec} seconds.`,
        429
      );
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.isActive || !user.passwordHash) {
      return jsonError("Invalid credentials", 401);
    }

    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid) {
      return jsonError("Invalid credentials", 401);
    }

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
