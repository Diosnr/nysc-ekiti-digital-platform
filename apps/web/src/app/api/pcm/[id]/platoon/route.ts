import { prisma } from "@/lib/db";
import { requireAuth, requirePermission, jsonOk, jsonError, clientMeta } from "@/lib/api";
import { writeAudit } from "@/lib/audit";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Params) {
  const auth = await requireAuth(req);
  if (auth instanceof Response) return auth;
  const denied = requirePermission(auth.payload, "platoon:assign");
  if (denied) {
    // allow platoon officers with attendance-only if they have platoon:manage too
    const alt = requirePermission(auth.payload, "platoon:manage");
    if (alt && !auth.payload.permissions.includes("*")) {
      const roles = auth.payload.roles.map((r) => r.toLowerCase());
      if (!roles.some((r) => r.includes("platoon"))) return denied;
    }
  }

  const { id } = await params;
  const body = await req.json();
  const platoonCode = String(body.platoonCode ?? "").trim().toUpperCase();
  if (!platoonCode) return jsonError("platoonCode required");

  const pcm = await prisma.pcm.findUnique({ where: { id } });
  if (!pcm) return jsonError("Not found", 404);

  const actor = await prisma.user.findUnique({
    where: { id: auth.payload.sub },
    select: { name: true, email: true },
  });
  const actorName = actor?.name?.trim() || actor?.email || auth.payload.email;
  const now = new Date();

  const updated = await prisma.pcm.update({
    where: { id },
    data: {
      platoonCode,
      platoonAssignedAt: now,
      platoonAssignedByName: actorName,
      status:
        pcm.status === "CHECKED_OUT" ||
        pcm.status === "CAMP_EXITED" ||
        pcm.status === "KIT_ISSUED"
          ? pcm.status
          : "PLATOON_ASSIGNED",
    },
  });

  const meta = clientMeta(req);
  await writeAudit({
    actorId: auth.payload.sub,
    actorEmail: auth.payload.email,
    actorRoleAtTime: auth.payload.roles.join(","),
    action: "pcm.platoon.assign",
    entityType: "Pcm",
    entityId: id,
    pcmId: id,
    after: { platoonCode, assignedByName: actorName },
    ip: meta.ip,
    userAgent: meta.userAgent,
  });

  return jsonOk({ pcm: updated });
}
