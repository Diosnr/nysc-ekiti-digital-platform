import { prisma } from "@/lib/db";
import { requireAuth, jsonOk, jsonError, clientMeta } from "@/lib/api";
import { writeAudit } from "@/lib/audit";
import { platoonFromStateCode } from "@/lib/platoon";

type Params = { params: Promise<{ id: string }> };

/** Registration Committee (and Super Admin) only — not platoon officers. */
export async function PATCH(req: Request, { params }: Params) {
  const auth = await requireAuth(req);
  if (auth instanceof Response) return auth;

  const roles = auth.payload.roles.map((r) => r.toLowerCase());
  const can =
    auth.payload.permissions.includes("*") ||
    auth.payload.permissions.includes("platoon:assign") ||
    auth.payload.permissions.includes("registration:complete") ||
    roles.some((r) => r.includes("registration"));
  // Explicitly block pure platoon officers
  if (
    roles.some((r) => r.includes("platoon")) &&
    !roles.some((r) => r.includes("registration")) &&
    !auth.payload.permissions.includes("*") &&
    !auth.payload.permissions.includes("platoon:assign") &&
    !auth.payload.permissions.includes("registration:complete")
  ) {
    return jsonError("Only Registration Committee may assign platoons", 403);
  }
  if (!can) return jsonError("Forbidden", 403);

  const { id } = await params;
  const body = await req.json();
  let platoonCode = String(body.platoonCode ?? "").trim().toUpperCase();

  const pcm = await prisma.pcm.findUnique({ where: { id } });
  if (!pcm) return jsonError("Not found", 404);

  // Auto from state code when not provided or when useStateCode: true
  if (body.useStateCode || !platoonCode) {
    const derived = platoonFromStateCode(pcm.stateCode);
    if (derived) platoonCode = derived;
  }
  if (!platoonCode) {
    return jsonError(
      "platoonCode required (or set state code so last digit can map to platoon 1–10)"
    );
  }

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
    after: { platoonCode, assignedByName: actorName, fromStateCode: pcm.stateCode },
    ip: meta.ip,
    userAgent: meta.userAgent,
  });

  return jsonOk({ pcm: updated });
}
