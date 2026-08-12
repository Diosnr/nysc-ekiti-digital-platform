import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/auth-server";
import { requireAuth, jsonOk, jsonError, clientMeta } from "@/lib/api";
import { writeAudit } from "@/lib/audit";

export async function GET(req: Request) {
  const auth = await requireAuth(req, "user:read");
  if (auth instanceof Response) return auth;

  const users = await prisma.user.findMany({
    orderBy: { email: "asc" },
    select: {
      id: true,
      email: true,
      name: true,
      phone: true,
      gradeLevel: true,
      rank: true,
      post: true,
      lgaCode: true,
      zoneCode: true,
      isActive: true,
      lastLoginAt: true,
      createdAt: true,
      roles: { include: { role: true } },
    },
  });

  return jsonOk({
    users: users.map((u) => ({
      ...u,
      roles: u.roles.map((r) => r.role.name),
    })),
  });
}

export async function POST(req: Request) {
  const auth = await requireAuth(req, "user:create");
  if (auth instanceof Response) return auth;

  const body = await req.json();
  const email = String(body.email ?? "").trim().toLowerCase();
  const name = body.name ? String(body.name) : null;
  const password = body.password ? String(body.password) : null;
  const roleIds: string[] = Array.isArray(body.roleIds) ? body.roleIds.map(String) : [];

  if (!email) return jsonError("email is required");

  const exists = await prisma.user.findUnique({ where: { email } });
  if (exists) return jsonError("Email already registered", 409);

  const passwordHash = password ? await hashPassword(password) : null;

  const user = await prisma.user.create({
    data: {
      email,
      name,
      passwordHash,
      phone: body.phone ? String(body.phone) : null,
      gradeLevel: body.gradeLevel ? String(body.gradeLevel) : null,
      rank: body.rank ? String(body.rank) : null,
      post: body.post ? String(body.post) : null,
      lgaCode: body.lgaCode ? String(body.lgaCode) : null,
      zoneCode: body.zoneCode ? String(body.zoneCode) : null,
      isActive: true,
      roles: roleIds.length
        ? { create: roleIds.map((roleId) => ({ roleId, assignedBy: auth.payload.sub })) }
        : undefined,
    },
    include: { roles: { include: { role: true } } },
  });

  const meta = clientMeta(req);
  await writeAudit({
    actorId: auth.payload.sub,
    actorEmail: auth.payload.email,
    actorRoleAtTime: auth.payload.roles.join(","),
    action: "user.create",
    entityType: "User",
    entityId: user.id,
    after: { email, name, roleIds },
    ip: meta.ip,
    userAgent: meta.userAgent,
  });

  return jsonOk(
    {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        roles: user.roles.map((r) => r.role.name),
      },
    },
    201
  );
}
