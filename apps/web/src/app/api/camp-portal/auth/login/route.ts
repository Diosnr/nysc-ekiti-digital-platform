import { prisma } from "@/lib/db";
import { jsonOk, jsonError, clientMeta } from "@/lib/api";
import { rateLimit } from "@/lib/rate-limit";
import { signCmToken } from "@/lib/cm-auth";
import { normalizeStateCode } from "@/lib/state-code";
import { verifyPassword } from "@/lib/auth-server";

/**
 * CM login: identifier = call-up or state code.
 * Password: custom portal password if set; otherwise same as identifier.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const identifier = String(body.identifier ?? body.username ?? "").trim();
    const password = String(body.password ?? "").trim();
    const meta = clientMeta(req);
    const ip = meta.ip ?? "unknown";

    if (!identifier || !password) {
      return jsonError("Call-up number or state code is required");
    }

    const limited = rateLimit(`cm-login:${ip}:${identifier.toLowerCase()}`, 10, 15 * 60 * 1000);
    if (!limited.ok) {
      return jsonError(
        `Too many attempts. Try again in ${limited.retryAfterSec} seconds.`,
        429
      );
    }

    const idNorm = identifier.trim();
    const stateNorm = normalizeStateCode(idNorm);

    const pcm = await prisma.pcm.findFirst({
      where: {
        OR: [
          { callUpNumber: { equals: idNorm, mode: "insensitive" } },
          ...(stateNorm
            ? [{ stateCode: { equals: stateNorm, mode: "insensitive" as const } }]
            : []),
        ],
      },
      select: {
        id: true,
        callUpNumber: true,
        fullName: true,
        stateCode: true,
        phone: true,
        portalPasswordHash: true,
        photographUrl: true,
      },
    });

    if (!pcm) {
      return jsonError("Invalid credentials", 401);
    }

    let valid = false;
    if (pcm.portalPasswordHash) {
      valid = await verifyPassword(password, pcm.portalPasswordHash);
    } else {
      // Default: call-up / state code as password
      valid = identifier.toUpperCase() === password.toUpperCase();
    }

    if (!valid) {
      return jsonError("Invalid credentials", 401);
    }

    const token = await signCmToken({
      sub: pcm.id,
      callUpNumber: pcm.callUpNumber,
      fullName: pcm.fullName,
      stateCode: pcm.stateCode,
    });

    return jsonOk({
      token,
      pcm: {
        id: pcm.id,
        callUpNumber: pcm.callUpNumber,
        fullName: pcm.fullName,
        stateCode: pcm.stateCode,
        photographUrl: pcm.photographUrl,
      },
    });
  } catch (e) {
    console.error("cm login", e);
    return jsonError("Login failed", 500);
  }
}
