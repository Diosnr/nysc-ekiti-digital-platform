import { prisma } from "@/lib/db";
import { requireAnyAuth, jsonOk, jsonError, clientMeta } from "@/lib/api";
import { writeAudit } from "@/lib/audit";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Params) {
  const auth = await requireAnyAuth(req, ["security:checkin", "pcm:update"]);
  if (auth instanceof Response) return auth;

  const { id } = await params;
  const pcm = await prisma.pcm.findUnique({ where: { id } });
  if (!pcm) return jsonError("PCM not found", 404);

  if (pcm.status === "CHECKED_OUT") {
    return jsonOk({ pcm, message: "Already checked out" });
  }

  if (pcm.status !== "CHECKED_IN" && pcm.status !== "CAMP_ACTIVE") {
    return jsonError(
      `Cannot check out from status ${pcm.status}. Check in first.`,
      400
    );
  }

  const updated = await prisma.pcm.update({
    where: { id },
    data: { status: "CHECKED_OUT" },
  });

  const meta = clientMeta(req);
  await writeAudit({
    actorId: auth.payload.sub,
    actorEmail: auth.payload.email,
    actorRoleAtTime: auth.payload.roles.join(","),
    action: "pcm.security.checkout",
    entityType: "Pcm",
    entityId: id,
    pcmId: id,
    before: { status: pcm.status },
    after: { status: updated.status },
    ip: meta.ip,
    userAgent: meta.userAgent,
  });

  return jsonOk({ pcm: updated });
}
