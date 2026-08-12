import { prisma } from "@/lib/db";
import { requireAuth, jsonOk, jsonError, clientMeta } from "@/lib/api";
import { writeAudit } from "@/lib/audit";

export async function GET(req: Request) {
  const auth = await requireAuth(req, "role:read");
  if (auth instanceof Response) return auth;

  const roles = await prisma.role.findMany({
    orderBy: { name: "asc" },
    include: {
      permissions: { include: { permission: true } },
      _count: { select: { users: true } },
    },
  });

  return jsonOk({
    roles: roles.map((r) => ({
      id: r.id,
      name: r.name,
      description: r.description,
      isSystem: r.isSystem,
      isActive: r.isActive,
      userCount: r._count.users,
      permissions: r.permissions.map((p) => p.permission.key),
    })),
  });
}

export async function POST(req: Request) {
  const auth = await requireAuth(req, "role:create");
  if (auth instanceof Response) return auth;

  const body = await req.json();
  const name = String(body.name ?? "").trim();
  const description = body.description ? String(body.description) : null;
  if (!name) return jsonError("name is required");

  const existing = await prisma.role.findUnique({ where: { name } });
  if (existing) return jsonError("Role name already exists", 409);

  const role = await prisma.role.create({
    data: { name, description, isSystem: false, isActive: true },
  });

  const meta = clientMeta(req);
  await writeAudit({
    actorId: auth.payload.sub,
    actorEmail: auth.payload.email,
    actorRoleAtTime: auth.payload.roles.join(","),
    action: "role.create",
    entityType: "Role",
    entityId: role.id,
    after: { name, description },
    ip: meta.ip,
    userAgent: meta.userAgent,
  });

  return jsonOk({ role }, 201);
}
