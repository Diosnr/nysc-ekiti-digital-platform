import { prisma } from "@/lib/db";
import { requireAuth, jsonOk, jsonError, clientMeta } from "@/lib/api";
import { loadUserAuthContext } from "@/lib/auth-server";
import { resolveGeoScope, pcmScopeWhere } from "@/lib/scope";
import { writeAudit } from "@/lib/audit";

type Params = { params: Promise<{ id: string }> };

function canViewNin(roles: string[], permissions: string[]): boolean {
  if (permissions.includes("*") || permissions.includes("bank:register") || permissions.includes("bank:update")) {
    return true;
  }
  return roles.some((r) => r.toLowerCase().includes("bank account") || r.toLowerCase() === "super admin");
}

export async function GET(req: Request, { params }: Params) {
  const auth = await requireAuth(req, "pcm:read");
  if (auth instanceof Response) return auth;

  const { id } = await params;
  const ctx = await loadUserAuthContext(auth.payload.sub);
  const scope = resolveGeoScope(auth.payload, {
    lgaCode: ctx?.user.lgaCode,
    zoneCode: ctx?.user.zoneCode,
  });

  const pcm = await prisma.pcm.findFirst({
    where: {
      AND: [{ id }, pcmScopeWhere(scope)],
    },
    include: {
      verifications: { orderBy: { verifiedAt: "desc" }, take: 5 },
      familyStatuses: { orderBy: { createdAt: "desc" }, take: 10 },
      skillProfiles: { orderBy: { createdAt: "desc" }, take: 10 },
      ninRecords: { orderBy: { createdAt: "desc" }, take: 10 },
    },
  });

  if (!pcm) return jsonError("PCM not found", 404);

  if (!canViewNin(auth.payload.roles, auth.payload.permissions)) {
    const { ninRecords: _n, ...rest } = pcm;
    return jsonOk({ pcm: { ...rest, ninRecords: [] } });
  }

  return jsonOk({ pcm });
}

export async function DELETE(req: Request, { params }: Params) {
  const auth = await requireAuth(req);
  if (auth instanceof Response) return auth;

  const isSuper =
    auth.payload.roles.includes("Super Admin") ||
    auth.payload.permissions.includes("*") ||
    auth.payload.permissions.includes("pcm:delete");
  if (!isSuper) {
    return jsonError("Only Super Admin can delete PCM records", 403);
  }

  const { id } = await params;
  const existing = await prisma.pcm.findUnique({ where: { id } });
  if (!existing) return jsonError("PCM not found", 404);

  await prisma.pcm.delete({ where: { id } });

  const meta = clientMeta(req);
  await writeAudit({
    actorId: auth.payload.sub,
    actorEmail: auth.payload.email,
    actorRoleAtTime: auth.payload.roles.join(","),
    action: "pcm.delete",
    entityType: "Pcm",
    entityId: id,
    pcmId: id,
    before: {
      callUpNumber: existing.callUpNumber,
      fullName: existing.fullName,
    },
    ip: meta.ip,
    userAgent: meta.userAgent,
  });

  return jsonOk({ deleted: true });
}
