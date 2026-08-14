import { prisma } from "@/lib/db";
import { requireAnyAuth, jsonOk, jsonError, clientMeta } from "@/lib/api";
import { writeAudit } from "@/lib/audit";

type Params = { params: Promise<{ id: string }> };

function canGrantExit(auth: {
  payload: { roles: string[]; permissions: string[] };
}): boolean {
  const roles = auth.payload.roles.map((r) => r.toLowerCase());
  return (
    auth.payload.permissions.includes("*") ||
    auth.payload.permissions.includes("camp:exeat") ||
    auth.payload.permissions.includes("pcm:update") ||
    roles.some((r) =>
      ["super admin", "state coordinator", "camp director"].some((h) =>
        r.includes(h)
      )
    )
  );
}

/** Grant camp exit so security can check out before the 3-week rule. */
export async function POST(req: Request, { params }: Params) {
  const auth = await requireAnyAuth(req, [
    "camp:exeat",
    "pcm:update",
    "user:update",
  ]);
  if (auth instanceof Response) return auth;
  if (!canGrantExit(auth)) return jsonError("Forbidden", 403);

  const { id } = await params;
  const pcm = await prisma.pcm.findUnique({ where: { id } });
  if (!pcm) return jsonError("PCM not found", 404);

  if (pcm.status === "CHECKED_OUT" || pcm.status === "CAMP_EXITED") {
    return jsonError("Member already checked out / exited", 400);
  }

  const updated = await prisma.pcm.update({
    where: { id },
    data: {
      campExitGrantedAt: new Date(),
      campExitGrantedById: auth.payload.sub,
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

/** Revoke a previously granted exit (if not yet checked out). */
export async function DELETE(req: Request, { params }: Params) {
  const auth = await requireAnyAuth(req, [
    "camp:exeat",
    "pcm:update",
    "user:update",
  ]);
  if (auth instanceof Response) return auth;
  if (!canGrantExit(auth)) return jsonError("Forbidden", 403);

  const { id } = await params;
  const pcm = await prisma.pcm.findUnique({ where: { id } });
  if (!pcm) return jsonError("PCM not found", 404);

  if (pcm.status === "CHECKED_OUT" || pcm.status === "CAMP_EXITED") {
    return jsonError("Cannot revoke — member already checked out", 400);
  }

  const updated = await prisma.pcm.update({
    where: { id },
    data: {
      campExitGrantedAt: null,
      campExitGrantedById: null,
    },
  });

  const meta = clientMeta(req);
  await writeAudit({
    actorId: auth.payload.sub,
    actorEmail: auth.payload.email,
    actorRoleAtTime: auth.payload.roles.join(","),
    action: "pcm.camp_exit.revoke",
    entityType: "Pcm",
    entityId: id,
    pcmId: id,
    before: { campExitGrantedAt: pcm.campExitGrantedAt },
    after: { campExitGrantedAt: null },
    ip: meta.ip,
    userAgent: meta.userAgent,
  });

  return jsonOk({ pcm: updated, message: "Exit grant revoked" });
}
