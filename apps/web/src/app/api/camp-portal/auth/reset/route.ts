import { prisma } from "@/lib/db";
import { jsonOk, jsonError, clientMeta } from "@/lib/api";
import { rateLimit } from "@/lib/rate-limit";
import { signCmToken, normalizeName, normalizePhone } from "@/lib/cm-auth";
import { normalizeStateCode } from "@/lib/state-code";

/**
 * CM access recovery: prove identity with call-up/state code + matching full name + phone.
 * On success issues a CM session token (same as login).
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const identifier = String(body.identifier ?? "").trim();
    const fullName = String(body.fullName ?? "").trim();
    const phone = String(body.phone ?? "").trim();
    const meta = clientMeta(req);
    const ip = meta.ip ?? "unknown";

    if (!identifier || !fullName || !phone) {
      return jsonError("Call-up/state code, full name, and phone are required");
    }

    const limited = rateLimit(`cm-reset:${ip}:${identifier.toLowerCase()}`, 5, 15 * 60 * 1000);
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
      },
    });

    if (!pcm) {
      return jsonError("No matching record found", 401);
    }

    const nameOk =
      normalizeName(pcm.fullName) === normalizeName(fullName) ||
      normalizeName(pcm.fullName).includes(normalizeName(fullName)) ||
      normalizeName(fullName).includes(normalizeName(pcm.fullName));

    const storedPhone = pcm.phone ? normalizePhone(pcm.phone) : "";
    const givenPhone = normalizePhone(phone);
    const phoneOk =
      storedPhone.length >= 10 &&
      givenPhone.length >= 10 &&
      storedPhone === givenPhone;

    if (!nameOk || !phoneOk) {
      return jsonError(
        "Details do not match our records. Use the exact name and phone registered at intake.",
        401
      );
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
      },
    });
  } catch (e) {
    console.error("cm reset", e);
    return jsonError("Verification failed", 500);
  }
}
