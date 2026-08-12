/**
 * Auth helpers — password hashing, JWT, permission checks.
 * Authorization must be enforced on every protected backend operation.
 * Menu visibility is NOT security.
 */

import * as bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";

const ACCESS_TTL = process.env.JWT_ACCESS_EXPIRES_IN ?? "15m";
const REFRESH_TTL = process.env.JWT_REFRESH_EXPIRES_IN ?? "7d";

function getSecret(kind: "access" | "refresh"): Uint8Array {
  const raw =
    kind === "access"
      ? process.env.JWT_ACCESS_SECRET
      : process.env.JWT_REFRESH_SECRET;
  if (!raw || raw.length < 32) {
    throw new Error(`Missing or weak JWT_${kind.toUpperCase()}_SECRET`);
  }
  return new TextEncoder().encode(raw);
}

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 12);
}

export async function verifyPassword(
  plain: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

export type AccessTokenPayload = {
  sub: string; // user id
  email: string;
  roles: string[];
  permissions: string[];
};

export async function signAccessToken(
  payload: AccessTokenPayload
): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime(ACCESS_TTL)
    .sign(getSecret("access"));
}

export async function signRefreshToken(userId: string): Promise<string> {
  return new SignJWT({ sub: userId, type: "refresh" })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(REFRESH_TTL)
    .sign(getSecret("refresh"));
}

export async function verifyAccessToken(
  token: string
): Promise<AccessTokenPayload> {
  const { payload } = await jwtVerify(token, getSecret("access"));
  return {
    sub: String(payload.sub),
    email: String(payload.email ?? ""),
    roles: (payload.roles as string[]) ?? [],
    permissions: (payload.permissions as string[]) ?? [],
  };
}

export async function verifyRefreshToken(token: string): Promise<{ sub: string }> {
  const { payload } = await jwtVerify(token, getSecret("refresh"));
  if (payload.type !== "refresh") {
    throw new Error("Invalid refresh token");
  }
  return { sub: String(payload.sub) };
}

/** Backend enforcement helper — never rely on UI alone. */
export function hasPermission(
  granted: string[],
  required: string | string[]
): boolean {
  const need = Array.isArray(required) ? required : [required];
  return need.every((p) => granted.includes(p) || granted.includes("*"));
}

export function hasAnyPermission(
  granted: string[],
  required: string[]
): boolean {
  return required.some((p) => granted.includes(p) || granted.includes("*"));
}
