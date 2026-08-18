import { createHash } from "crypto";
import {
  hashPassword,
  verifyPassword,
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  hasPermission,
  type AccessTokenPayload,
} from "@nysc/auth";
import { prisma } from "./db";

export {
  hashPassword,
  verifyPassword,
  hasPermission,
  type AccessTokenPayload,
};

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function loadUserAuthContext(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      roles: {
        include: {
          role: {
            include: {
              permissions: { include: { permission: true } },
            },
          },
        },
      },
    },
  });

  if (!user || !user.isActive) return null;

  const roles = user.roles
    .filter((ur) => ur.role.isActive)
    .map((ur) => ur.role.name);

  const permissionSet = new Set<string>();
  for (const ur of user.roles) {
    if (!ur.role.isActive) continue;
    for (const rp of ur.role.permissions) {
      permissionSet.add(rp.permission.key);
    }
  }

  return {
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      lgaCode: user.lgaCode,
      zoneCode: user.zoneCode,
      platoonCode: user.platoonCode,
      post: user.post,
      rank: user.rank,
      signatureUrl: user.signatureUrl ?? null,
    },
    roles,
    permissions: Array.from(permissionSet),
  };
}

export async function issueTokens(userId: string, meta?: { ip?: string; userAgent?: string }) {
  const ctx = await loadUserAuthContext(userId);
  if (!ctx) throw new Error("User inactive or not found");

  const accessToken = await signAccessToken({
    sub: ctx.user.id,
    email: ctx.user.email,
    roles: ctx.roles,
    permissions: ctx.permissions,
  });

  const refreshToken = await signRefreshToken(ctx.user.id);
  const tokenHash = hashToken(refreshToken);
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  await prisma.refreshToken.create({
    data: {
      tokenHash,
      userId: ctx.user.id,
      expiresAt,
      ip: meta?.ip,
      userAgent: meta?.userAgent,
    },
  });

  await prisma.user.update({
    where: { id: userId },
    data: { lastLoginAt: new Date() },
  });

  return {
    accessToken,
    refreshToken,
    user: ctx.user,
    roles: ctx.roles,
    permissions: ctx.permissions,
  };
}

export async function revokeRefreshToken(rawToken: string) {
  const tokenHash = hashToken(rawToken);
  await prisma.refreshToken.updateMany({
    where: { tokenHash, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export async function rotateRefreshToken(
  rawToken: string,
  meta?: { ip?: string; userAgent?: string }
) {
  const { sub } = await verifyRefreshToken(rawToken);
  const tokenHash = hashToken(rawToken);
  const existing = await prisma.refreshToken.findFirst({
    where: { tokenHash, userId: sub, revokedAt: null },
  });
  if (!existing || existing.expiresAt < new Date()) {
    throw new Error("Invalid or expired refresh token");
  }
  await prisma.refreshToken.update({
    where: { id: existing.id },
    data: { revokedAt: new Date() },
  });
  return issueTokens(sub, meta);
}

export async function getBearerPayload(
  authHeader: string | null
): Promise<AccessTokenPayload | null> {
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.slice(7);
  try {
    return await verifyAccessToken(token);
  } catch {
    return null;
  }
}

export function requirePermissions(
  payload: AccessTokenPayload,
  required: string | string[]
): boolean {
  return hasPermission(payload.permissions, required);
}
