/**
 * Corps Member (CM) portal auth — call-up / state code as identifier.
 * Separate from staff JWT; uses same access secret with type: "cm".
 */

import { SignJWT, jwtVerify } from "jose";

/** Default session length — short so portal sessions time out. */
const CM_TTL = process.env.JWT_CM_EXPIRES_IN ?? "30m";

function getSecret(): Uint8Array {
  const raw = process.env.JWT_ACCESS_SECRET;
  if (!raw || raw.length < 32) {
    throw new Error("Missing or weak JWT_ACCESS_SECRET");
  }
  return new TextEncoder().encode(raw);
}

export type CmTokenPayload = {
  sub: string; // pcm id
  callUpNumber: string;
  fullName: string;
  stateCode: string | null;
  type: "cm";
};

export async function signCmToken(payload: Omit<CmTokenPayload, "type">): Promise<string> {
  return new SignJWT({ ...payload, type: "cm" })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime(CM_TTL)
    .sign(getSecret());
}

export async function verifyCmToken(token: string): Promise<CmTokenPayload> {
  const { payload } = await jwtVerify(token, getSecret());
  if (payload.type !== "cm") {
    throw new Error("Invalid CM token");
  }
  return {
    sub: String(payload.sub),
    callUpNumber: String(payload.callUpNumber ?? ""),
    fullName: String(payload.fullName ?? ""),
    stateCode: payload.stateCode ? String(payload.stateCode) : null,
    type: "cm",
  };
}

export async function getCmBearerPayload(
  authHeader: string | null
): Promise<CmTokenPayload | null> {
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.slice(7);
  try {
    return await verifyCmToken(token);
  } catch {
    return null;
  }
}

/** Normalize names for loose match (reset verification). */
export function normalizeName(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[^a-z\s.'-]/g, "");
}

export function normalizePhone(s: string): string {
  return String(s).replace(/\D/g, "").slice(-10); // last 10 digits
}
