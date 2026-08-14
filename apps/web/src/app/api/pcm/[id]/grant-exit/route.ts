import { prisma } from "@/lib/db";
import { requireAnyAuth, jsonOk, jsonError, clientMeta } from "@/lib/api";
import { writeAudit } from "@/lib/audit";

type Params = { params: Promise<{ id: string }> };

/**
 * Administrator grants camp exit so security can check the member out
 * before the automatic 3-week rule (e.g. State Coordinator approval).
 */
export async function POST(req: Request, { params }: Params) {
  const auth = await requireAnyAuth(req, [
    "camp:exeat",
    "pcm:update",
    "user:update",
  ]);
  if (auth instanceof Response) return auth;

  // Prefer explicit coordinator / super-admin style roles
  const roles = auth.payload.roles.map((r) => r.toLowerCase());
  const allowed =
    auth.payload.permissions.includes("*") ||
    auth.payload.permissions.includes("camp:exeat") ||
    auth.payload.permissions.includes("pcm:update") ||
    roles.some((r) =>
      ["super admin", "state coordinator", "camp director"].some((h) =>
        r.includes(h)
      )
    );
  if (!allowed) return jsonError("Forbidden", 403);

  const { id } = await params;
  const pcm = await prisma.pcm.findUnique({ where: { id } });
  if (!pcm) return jsonError("PCM not found", 404);

  const updated = await prisma.pcm.update({
    where: { id },
    data: {
      campExitGrantedAt: new Date(),
      campExitGrantedById: auth.payload.sub,
      status:
        pcm.status === "CHECKED_OUT" || pcm.status === "CAMP_EXITED"
          ? pcm.status
          : pcm.status === "CHECKED_IN" || pcm.status === "CAMP_ACTIVE"
            ? pcm.status
            : pcm.status,
    },
  });

  const meta = clientMeta(req);
  await writeAudit({
    actorId: auth.payload.sub,
    actorEmail: auth.payload.email,
    actorRoleAtTime: auth.payload.roles.join(","),
    action: "pcm.camp_exit.grant",
    entityType: "Pcm",
    entityId: id,
    pcmId: id,
    after: {
      campExitGrantedAt: updated.campExitGrantedAt,
      grantedBy: auth.payload.email,
    },
    ip: meta.ip,
    userAgent: meta.userAgent,
  });

  return jsonOk({
    pcm: updated,
    message: "Camp exit granted. Security may check out this member.",
  });
}
