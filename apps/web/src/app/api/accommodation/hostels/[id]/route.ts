import { prisma } from "@/lib/db";
import { requireAuth, jsonOk, jsonError, clientMeta } from "@/lib/api";
import { writeAudit } from "@/lib/audit";

type Params = { params: Promise<{ id: string }> };

function canManage(roles: string[], permissions: string[]) {
  if (permissions.includes("*") || permissions.includes("hostel:manage")) return true;
  return roles.some((r) => r.toLowerCase().includes("accommodation"));
}

export async function PATCH(req: Request, { params }: Params) {
  const auth = await requireAuth(req);
  if (auth instanceof Response) return auth;
  if (!canManage(auth.payload.roles, auth.payload.permissions)) {
    return jsonError("Forbidden", 403);
  }

  const { id } = await params;
  const body = await req.json();
  const data: Record<string, unknown> = {};

  if (body.name !== undefined) data.name = String(body.name).trim();
  if (body.notes !== undefined) data.notes = body.notes ? String(body.notes).trim() : null;
  if (body.isActive !== undefined) data.isActive = Boolean(body.isActive);
  if (body.capacity !== undefined) {
    data.capacity = Math.max(1, Math.min(500, Number(body.capacity) || 1));
  }
  if (body.genderRestriction !== undefined) {
    const g = String(body.genderRestriction).toUpperCase();
    if (["MALE", "FEMALE", "MIXED"].includes(g)) data.genderRestriction = g;
  }
  if (body.sortOrder !== undefined) data.sortOrder = Number(body.sortOrder) || 0;

  try {
    const hostel = await prisma.hostel.update({ where: { id }, data });
    const meta = clientMeta(req);
    await writeAudit({
      actorId: auth.payload.sub,
      actorEmail: auth.payload.email,
      actorRoleAtTime: auth.payload.roles.join(","),
      action: "hostel.update",
      entityType: "Hostel",
      entityId: id,
      after: data,
      ip: meta.ip,
      userAgent: meta.userAgent,
    });
    return jsonOk({ hostel });
  } catch {
    return jsonError("Hostel not found", 404);
  }
}

export async function DELETE(req: Request, { params }: Params) {
  const auth = await requireAuth(req);
  if (auth instanceof Response) return auth;
  if (!canManage(auth.payload.roles, auth.payload.permissions)) {
    return jsonError("Forbidden", 403);
  }

  const { id } = await params;
  const occupied = await prisma.bed.count({
    where: { hostelId: id, status: "OCCUPIED" },
  });
  if (occupied > 0) {
    return jsonError("Cannot delete hostel with occupied beds — release beds first", 400);
  }

  try {
    await prisma.hostel.delete({ where: { id } });
    const meta = clientMeta(req);
    await writeAudit({
      actorId: auth.payload.sub,
      actorEmail: auth.payload.email,
      actorRoleAtTime: auth.payload.roles.join(","),
      action: "hostel.delete",
      entityType: "Hostel",
      entityId: id,
      ip: meta.ip,
      userAgent: meta.userAgent,
    });
    return jsonOk({ deleted: true });
  } catch {
    return jsonError("Hostel not found", 404);
  }
}
