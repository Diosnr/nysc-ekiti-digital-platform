import { randomBytes } from "crypto";
import { prisma } from "@/lib/db";
import { requireAuth, jsonOk, jsonError, clientMeta } from "@/lib/api";
import { writeAudit } from "@/lib/audit";

type Params = { params: Promise<{ id: string }> };

function appBaseUrl(req: Request): string {
  const fromEnv = process.env.APP_URL?.trim();
  if (fromEnv) return fromEnv.replace(/\/$/, "");

  // Vercel provides this without protocol
  const vercel = process.env.VERCEL_URL?.trim();
  if (vercel) {
    const host = vercel.replace(/^https?:\/\//, "");
    return `https://${host}`;
  }

  // Request origin (works when API is hit on production domain)
  try {
    const origin = new URL(req.url).origin;
    if (origin && !origin.includes("localhost")) return origin;
  } catch {
    /* ignore */
  }

  const forwarded =
    req.headers.get("x-forwarded-host") || req.headers.get("host");
  const proto = req.headers.get("x-forwarded-proto") || "https";
  if (forwarded && !forwarded.includes("localhost")) {
    return `${proto}://${forwarded}`;
  }

  return "http://localhost:3000";
}

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

  const base = appBaseUrl(req);
  const activationUrl = `${base}/staff/activate?token=${token}`;

  const meta = clientMeta(req);
  await writeAudit({
    actorId: auth.payload.sub,
    actorEmail: auth.payload.email,
    actorRoleAtTime: auth.payload.roles.join(","),
    action: "user.activation.issue",
    entityType: "User",
    entityId: id,
    after: { email: user.email, base, sentAt: new Date().toISOString() },
    ip: meta.ip,
    userAgent: meta.userAgent,
  });

  return jsonOk({
    activationUrl,
    email: user.email,
    phone: user.phone,
    message:
      "Send this link to the officer via email or WhatsApp. They will set their password and complete profile.",
  });
}
