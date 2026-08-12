import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/auth-server";
import { writeAudit } from "@/lib/audit";
import { jsonOk, jsonError, clientMeta } from "@/lib/api";

/** Complete officer activation: token + new password (+ optional profile fields). */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const token = String(body.token ?? "").trim();
    const password = String(body.password ?? "");
    const name = body.name ? String(body.name) : undefined;
    const phone = body.phone ? String(body.phone) : undefined;

    if (!token || password.length < 8) {
      return jsonError("Valid token and password (min 8 characters) are required");
    }

    const user = await prisma.user.findFirst({
      where: { activationToken: token, isActive: true },
    });
    if (!user) return jsonError("Invalid or expired activation link", 400);

    // Optional expiry: 7 days from activationSentAt
    if (user.activationSentAt) {
      const age = Date.now() - user.activationSentAt.getTime();
      if (age > 7 * 24 * 60 * 60 * 1000) {
        return jsonError("Activation link has expired. Ask admin to issue a new one.", 400);
      }
    }

    const passwordHash = await hashPassword(password);
    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        name: name ?? user.name,
        phone: phone ?? user.phone,
        activationToken: null,
        activatedAt: new Date(),
      },
    });

    const meta = clientMeta(req);
    await writeAudit({
      actorId: user.id,
      actorEmail: user.email,
      action: "user.activation.complete",
      entityType: "User",
      entityId: user.id,
      ip: meta.ip,
      userAgent: meta.userAgent,
    });

    return jsonOk({
      ok: true,
      email: user.email,
      message: "Account activated. You can sign in with your new password.",
    });
  } catch (e) {
    console.error("activate error", e);
    return jsonError("Activation failed", 500);
  }
}
