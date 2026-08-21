import { prisma } from "@/lib/db";
import { requireAuth, jsonOk, jsonError, clientMeta } from "@/lib/api";
import { writeAudit } from "@/lib/audit";
import { setOfficerPlatoon, isPlatoonOfficerRole } from "@/lib/platoon-tenure";

type Params = { params: Promise<{ id: string }> };

/** Update officer — including platoon rotation for Platoon Officers. */
export async function PATCH(req: Request, { params }: Params) {
  const auth = await requireAuth(req, "user:update");
  if (auth instanceof Response) return auth;

  const { id } = await params;
  const body = await req.json();
  const existing = await prisma.user.findUnique({
    where: { id },
    include: { roles: { include: { role: true } } },
  });
  if (!existing) return jsonError("Not found", 404);

  const roleNames = existing.roles.map((r) => r.role.name);
  const data: Record<string, unknown> = {};
  if (body.name !== undefined) data.name = body.name ? String(body.name) : null;
  if (body.rank !== undefined) data.rank = body.rank ? String(body.rank) : null;
  if (body.post !== undefined) data.post = body.post ? String(body.post) : null;
  if (body.lgaCode !== undefined) data.lgaCode = body.lgaCode ? String(body.lgaCode) : null;
  if (body.zoneCode !== undefined) data.zoneCode = body.zoneCode ? String(body.zoneCode) : null;
  if (body.isActive !== undefined) data.isActive = Boolean(body.isActive);

  let platoonCode: string | null | undefined = undefined;
  if (body.platoonCode !== undefined) {
    const raw =
      body.platoonCode === null || body.platoonCode === ""
        ? null
        : String(body.platoonCode).trim();
    if (raw && !/^(10|[1-9])$/.test(raw)) {
      return jsonError("platoonCode must be 1–10");
    }
    platoonCode = raw;
  }

  if (Object.keys(data).length) {
    await prisma.user.update({ where: { id }, data });
  }

  if (platoonCode !== undefined && isPlatoonOfficerRole(roleNames)) {
    const actor = await prisma.user.findUnique({
      where: { id: auth.payload.sub },
      select: { name: true, email: true },
    });
    await setOfficerPlatoon({
      userId: id,
      officerName: (body.name ? String(body.name) : existing.name) || existing.email,
      platoonCode,
      assignedById: auth.payload.sub,
      assignedByName: actor?.name || actor?.email || auth.payload.email,
      note: body.note ? String(body.note) : "Platoon reassignment",
    });
  }

  const meta = clientMeta(req);
  await writeAudit({
    actorId: auth.payload.sub,
    actorEmail: auth.payload.email,
    actorRoleAtTime: auth.payload.roles.join(","),
    action: "user.update",
    entityType: "User",
    entityId: id,
    after: { ...data, platoonCode },
    ip: meta.ip,
    userAgent: meta.userAgent,
  });

  const user = await prisma.user.findUnique({
    where: { id },
    include: { roles: { include: { role: true } } },
  });

  return jsonOk({
    user: {
      id: user!.id,
      email: user!.email,
      name: user!.name,
      platoonCode: user!.platoonCode,
      roles: user!.roles.map((r) => r.role.name),
    },
  });
}

/** Permanently delete a user (Super Admin / user:deactivate). Cannot delete self. */
export async function DELETE(req: Request, { params }: Params) {
  const auth = await requireAuth(req, "user:deactivate");
  if (auth instanceof Response) return auth;

  const { id } = await params;
  if (id === auth.payload.sub) {
    return jsonError("You cannot delete your own account", 400);
  }

  const existing = await prisma.user.findUnique({
    where: { id },
    include: { roles: { include: { role: true } } },
  });
  if (!existing) return jsonError("Not found", 404);

  const isTargetSuper = existing.roles.some((r) => r.role.name === "Super Admin");
  const actorIsSuper =
    auth.payload.roles.includes("Super Admin") || auth.payload.permissions.includes("*");
  if (isTargetSuper && !actorIsSuper) {
    return jsonError("Only Super Admin can delete a Super Admin", 403);
  }

  await prisma.user.delete({ where: { id } });

  const meta = clientMeta(req);
  await writeAudit({
    actorId: auth.payload.sub,
    actorEmail: auth.payload.email,
    actorRoleAtTime: auth.payload.roles.join(","),
    action: "user.delete",
    entityType: "User",
    entityId: id,
    before: {
      email: existing.email,
      name: existing.name,
      roles: existing.roles.map((r) => r.role.name),
    },
    ip: meta.ip,
    userAgent: meta.userAgent,
  });

  return jsonOk({ ok: true, deletedId: id, email: existing.email });
}
