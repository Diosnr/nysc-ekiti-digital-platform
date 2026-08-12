import { randomBytes } from "crypto";
import { prisma } from "@/lib/db";
import { requireAuth, jsonOk, jsonError, clientMeta } from "@/lib/api";
import { writeAudit } from "@/lib/audit";

type Params = { params: Promise<{ id: string }> };

/**
 * Generate an activation token for an officer.
 * Returns a link the admin can send via email/WhatsApp.
 * Actual email/WhatsApp delivery is an external integration (logged as open dependency).
 */
export async function POST(req: Request, { params }: Params) {
  const auth = await requireAuth(req, "user:update");
  if (auth instanceof Response) return auth;

  const { id } = await params;
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) return jsonError("User not found", 404);

  const token = randomBytes(32).toString("hex");
  await prisma.user.update({
    where: { id },
    data: {
      activationToken: token,
      activationSentAt: new Date(),
    },
  });

  const base = process.env.APP_URL ?? "http://localhost:3000";
  const activationUrl = `${base}/staff/activate?token=${token}`;

  const meta = clientMeta(req);
  await writeAudit({
    actorId: auth.payload.sub,
    actorEmail: auth.payload.email,
    actorRoleAtTime: auth.payload.roles.join(","),
    action: "user.activation.issue",
    entityType: "User",
    entityId: id,
    after: { email: user.email, sentAt: new Date().toISOString() },
    ip: meta.ip,
    userAgent: meta.userAgent,
  });

  // Delivery channels are external — return link for admin to copy / send.
  return jsonOk({
    activationUrl,
    email: user.email,
    phone: user.phone,
    message:
      "Send this link to the officer via email or WhatsApp. They will set their password and complete profile.",
  });
}
