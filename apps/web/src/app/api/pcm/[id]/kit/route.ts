import { prisma } from "@/lib/db";
import { requireAuth, jsonOk, jsonError, clientMeta } from "@/lib/api";
import { writeAudit } from "@/lib/audit";

type Params = { params: Promise<{ id: string }> };

const DEFAULT_KIT = [
  "Khaki uniform",
  "White vest",
  "Jungle boots",
  "Cap / beret",
  "Belt",
  "NYSC ID card holder",
];

export async function POST(req: Request, { params }: Params) {
  const auth = await requireAuth(req, "kit:issue");
  if (auth instanceof Response) return auth;

  // Platoon roles may issue kit without explicit kit:issue if they have platoon perms
  const roles = auth.payload.roles.map((r) => r.toLowerCase());
  const can =
    auth.payload.permissions.includes("*") ||
    auth.payload.permissions.includes("kit:issue") ||
    roles.some((r) => r.includes("platoon"));
  if (!can) return jsonError("Forbidden", 403);

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const items: string[] = Array.isArray(body.items)
    ? body.items.map(String).filter(Boolean)
    : DEFAULT_KIT;

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
      kitIssuedAt: now,
      kitIssuedByName: actorName,
      kitItemsJson: JSON.stringify(items),
      status:
        pcm.status === "CHECKED_OUT" || pcm.status === "CAMP_EXITED"
          ? pcm.status
          : "KIT_ISSUED",
    },
  });

  const meta = clientMeta(req);
  await writeAudit({
    actorId: auth.payload.sub,
    actorEmail: auth.payload.email,
    actorRoleAtTime: auth.payload.roles.join(","),
    action: "pcm.kit.issue",
    entityType: "Pcm",
    entityId: id,
    pcmId: id,
    after: { kitIssuedByName: actorName, items },
    ip: meta.ip,
    userAgent: meta.userAgent,
  });

  return jsonOk({ pcm: updated });
}
