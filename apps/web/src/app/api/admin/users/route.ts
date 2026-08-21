import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/auth-server";
import { requireAuth, jsonOk, jsonError, clientMeta } from "@/lib/api";
import { writeAudit } from "@/lib/audit";
import { setOfficerPlatoon, isPlatoonOfficerRole } from "@/lib/platoon-tenure";

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
      platoonCode: true,
      isActive: true,
      passwordHash: true,
      activatedAt: true,
      lastLoginAt: true,
      createdAt: true,
      roles: { include: { role: true } },
    },
  });

  return jsonOk({
    users: users.map((u) => {
      const { passwordHash, ...rest } = u;
      return {
        ...rest,
        hasPassword: Boolean(passwordHash),
        roles: u.roles.map((r) => r.role.name),
      };
    }),
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
  let platoonCode = body.platoonCode ? String(body.platoonCode).trim() : null;
  if (platoonCode === "") platoonCode = null;

  if (!email) return jsonError("email is required");

  const roles =
    roleIds.length > 0
      ? await prisma.role.findMany({ where: { id: { in: roleIds } } })
      : [];
  const roleNames = roles.map((r) => r.name);
  if (isPlatoonOfficerRole(roleNames) && !platoonCode) {
    return jsonError("Platoon number (1–10) is required for Platoon Officer");
  }
  if (platoonCode && !/^(10|[1-9])$/.test(platoonCode)) {
    return jsonError("platoonCode must be 1–10");
  }

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
      platoonCode: isPlatoonOfficerRole(roleNames) ? platoonCode : null,
      isActive: true,
      activatedAt: passwordHash ? new Date() : null,
      roles: roleIds.length
        ? { create: roleIds.map((roleId) => ({ roleId, assignedBy: auth.payload.sub })) }
        : undefined,
    },
    include: { roles: { include: { role: true } } },
  });

  if (isPlatoonOfficerRole(roleNames) && platoonCode) {
    const actor = await prisma.user.findUnique({
      where: { id: auth.payload.sub },
      select: { name: true, email: true },
    });
    await setOfficerPlatoon({
      userId: user.id,
      officerName: name || email,
      platoonCode,
      assignedById: auth.payload.sub,
      assignedByName: actor?.name || actor?.email || auth.payload.email,
      note: "Initial assignment on create",
    });
  }

  const meta = clientMeta(req);
  await writeAudit({
    actorId: auth.payload.sub,
    actorEmail: auth.payload.email,
    actorRoleAtTime: auth.payload.roles.join(","),
    action: "user.create",
    entityType: "User",
    entityId: user.id,
    after: { email, name, roleIds, platoonCode },
    ip: meta.ip,
    userAgent: meta.userAgent,
  });

  return jsonOk(
    {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        platoonCode: user.platoonCode,
        hasPassword: Boolean(passwordHash),
        roles: user.roles.map((r) => r.role.name),
      },
    },
    201
  );
}
