import { prisma } from "@/lib/db";
import { requireAuth, jsonOk, jsonError, clientMeta } from "@/lib/api";
import { writeAudit } from "@/lib/audit";
import { uploadDataUriToCloudinary } from "@/lib/cloudinary";

export async function POST(req: Request) {
  const auth = await requireAuth(req);
  if (auth instanceof Response) return auth;

  const body = await req.json().catch(() => ({}));
  let signatureUrl = String(body.signatureUrl ?? "").trim();
  if (!signatureUrl) {
    return jsonError("signatureUrl required (image data URL or https link)");
  }

  if (signatureUrl.startsWith("data:image")) {
    const uploaded = await uploadDataUriToCloudinary(
      signatureUrl,
      `sig_${auth.payload.sub}`
    );
    if (uploaded) signatureUrl = uploaded;
  }

  const updated = await prisma.user.update({
    where: { id: auth.payload.sub },
    data: { signatureUrl },
    select: { id: true, email: true, name: true, signatureUrl: true },
  });

  const meta = clientMeta(req);
  await writeAudit({
    actorId: auth.payload.sub,
    actorEmail: auth.payload.email,
    actorRoleAtTime: auth.payload.roles.join(","),
    action: "user.signature.upload",
    entityType: "User",
    entityId: auth.payload.sub,
    after: { signatureUrl: updated.signatureUrl ? "set" : null },
    ip: meta.ip,
    userAgent: meta.userAgent,
  });

  return jsonOk({ user: updated });
}

export async function GET(req: Request) {
  const auth = await requireAuth(req);
  if (auth instanceof Response) return auth;

  const user = await prisma.user.findUnique({
    where: { id: auth.payload.sub },
    select: { signatureUrl: true, name: true, email: true },
  });
  return jsonOk({ signatureUrl: user?.signatureUrl ?? null });
}
