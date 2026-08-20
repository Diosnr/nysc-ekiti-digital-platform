import { prisma } from "@/lib/db";
import { jsonOk, jsonError } from "@/lib/api";
import { getCmBearerPayload } from "@/lib/cm-auth";
import { hashPassword, verifyPassword } from "@/lib/auth-server";

/**
 * Set or change My Portal password.
 * If no custom password yet: currentPassword must be call-up or state code.
 * If custom password exists: currentPassword must match the hash.
 */
export async function POST(req: Request) {
  try {
    const payload = await getCmBearerPayload(req.headers.get("authorization"));
    if (!payload) {
      return jsonError("Unauthorized", 401);
    }

    const body = await req.json();
    const currentPassword = String(body.currentPassword ?? "").trim();
    const newPassword = String(body.newPassword ?? "").trim();

    if (!currentPassword || !newPassword) {
      return jsonError("Current and new password are required");
    }
    if (newPassword.length < 6) {
      return jsonError("New password must be at least 6 characters");
    }

    const pcm = await prisma.pcm.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        callUpNumber: true,
        stateCode: true,
        portalPasswordHash: true,
      },
    });
    if (!pcm) return jsonError("Session invalid", 401);

    let currentOk = false;
    if (pcm.portalPasswordHash) {
      currentOk = await verifyPassword(currentPassword, pcm.portalPasswordHash);
    } else {
      const up = currentPassword.toUpperCase();
      currentOk =
        up === pcm.callUpNumber.toUpperCase() ||
        (pcm.stateCode != null && up === pcm.stateCode.toUpperCase());
    }

    if (!currentOk) {
      return jsonError("Current password is incorrect", 401);
    }

    const portalPasswordHash = await hashPassword(newPassword);
    await prisma.pcm.update({
      where: { id: pcm.id },
      data: { portalPasswordHash },
    });

    return jsonOk({ ok: true });
  } catch (e) {
    console.error("cm password", e);
    return jsonError("Could not update password", 500);
  }
}
