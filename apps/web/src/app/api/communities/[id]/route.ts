import { prisma } from "@/lib/db";
import { requireAuth, jsonOk, jsonError, clientMeta } from "@/lib/api";
import { writeAudit } from "@/lib/audit";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Params) {
  const auth = await requireAuth(req, "community:manage");
  if (auth instanceof Response) return auth;

  const { id } = await params;
  const existing = await prisma.community.findUnique({ where: { id } });
  if (!existing) return jsonError("Not found", 404);

  const body = await req.json();
  const data: Record<string, unknown> = {};
  if (body.name !== undefined) data.name = String(body.name).trim();
  if (body.lga !== undefined) data.lga = body.lga ? String(body.lga).trim() : null;
  if (body.state !== undefined)
    data.state = body.state ? String(body.state).trim() : null;
  if (body.isActive !== undefined) data.isActive = Boolean(body.isActive);
  if (body.sortOrder !== undefined) data.sortOrder = Number(body.sortOrder) || 0;

  const row = await prisma.community.update({ where: { id }, data });

  const meta = clientMeta(req);
  await writeAudit({
    actorId: auth.payload.sub,
    actorEmail: auth.payload.email,
    actorRoleAtTime: auth.payload.roles.join(","),
    action: "community.update",
    entityType: "Community",
    entityId: id,
    before: existing,
    after: row,
    ip: meta.ip,
    userAgent: meta.userAgent,
  });

  return jsonOk({ community: row });
}

export async function DELETE(req: Request, { params }: Params) {
  const auth = await requireAuth(req, "community:manage");
  if (auth instanceof Response) return auth;

  const { id } = await params;
  const existing = await prisma.community.findUnique({ where: { id } });
  if (!existing) return jsonError("Not found", 404);

  await prisma.community.delete({ where: { id } });

  const meta = clientMeta(req);
  await writeAudit({
    actorId: auth.payload.sub,
    actorEmail: auth.payload.email,
    actorRoleAtTime: auth.payload.roles.join(","),
    action: "community.delete",
    entityType: "Community",
    entityId: id,
    before: existing,
    ip: meta.ip,
    userAgent: meta.userAgent,
  });

  return jsonOk({ deleted: true });
}
