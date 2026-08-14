import { prisma } from "@/lib/db";
import { requireAuth, jsonOk, jsonError, clientMeta } from "@/lib/api";
import { writeAudit } from "@/lib/audit";

type Params = { params: Promise<{ id: string }> };

/** Registration Committee: fields not captured at security intake. */
export async function PATCH(req: Request, { params }: Params) {
  const auth = await requireAuth(req, "registration:complete");
  if (auth instanceof Response) return auth;

  const { id } = await params;
  const existing = await prisma.pcm.findUnique({ where: { id } });
  if (!existing) return jsonError("PCM not found", 404);

  const body = await req.json();
  const data: Record<string, string | null> = {};
  const keys = [
    "stateCode",
    "ppaName",
    "ppaAddress",
    "lgiName",
    "lgiPhone",
    "ziName",
    "ziPhone",
  ] as const;
  for (const k of keys) {
    if (body[k] !== undefined) {
      const v = String(body[k] ?? "").trim();
      data[k] = v || null;
    }
  }

  const updated = await prisma.pcm.update({ where: { id }, data });

  const meta = clientMeta(req);
  await writeAudit({
    actorId: auth.payload.sub,
    actorEmail: auth.payload.email,
    actorRoleAtTime: auth.payload.roles.join(","),
    action: "pcm.registration.update",
    entityType: "Pcm",
    entityId: id,
    pcmId: id,
    before: {
      stateCode: existing.stateCode,
      ppaName: existing.ppaName,
      ppaAddress: existing.ppaAddress,
      lgiName: existing.lgiName,
      lgiPhone: existing.lgiPhone,
      ziName: existing.ziName,
      ziPhone: existing.ziPhone,
    },
    after: data,
    ip: meta.ip,
    userAgent: meta.userAgent,
  });

  return jsonOk({ pcm: updated });
}
