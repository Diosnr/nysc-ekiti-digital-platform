import { prisma } from "@/lib/db";
import { requireAuth, jsonOk, jsonError, clientMeta } from "@/lib/api";
import { writeAudit } from "@/lib/audit";

type Params = { params: Promise<{ id: string }> };

export async function PUT(req: Request, { params }: Params) {
  const auth = await requireAuth(req, "permission:manage");
  if (auth instanceof Response) return auth;

  const { id: roleId } = await params;
  const body = await req.json();
  const keys: string[] = Array.isArray(body.permissions) ? body.permissions.map(String) : [];

  const role = await prisma.role.findUnique({ where: { id: roleId } });
  if (!role) return jsonError("Role not found", 404);

  const permissions = await prisma.permission.findMany({
    where: { key: { in: keys } },
  });

  const before = await prisma.rolePermission.findMany({
    where: { roleId },
    include: { permission: true },
  });

  await prisma.$transaction([
    prisma.rolePermission.deleteMany({ where: { roleId } }),
    prisma.rolePermission.createMany({
      data: permissions.map((p) => ({ roleId, permissionId: p.id })),
    }),
  ]);

  const meta = clientMeta(req);
  await writeAudit({
    actorId: auth.payload.sub,
    actorEmail: auth.payload.email,
    actorRoleAtTime: auth.payload.roles.join(","),
    action: "role.permissions.update",
    entityType: "Role",
    entityId: roleId,
    before: before.map((b) => b.permission.key),
    after: permissions.map((p) => p.key),
    ip: meta.ip,
    userAgent: meta.userAgent,
  });

  return jsonOk({ ok: true, permissions: permissions.map((p) => p.key) });
}
