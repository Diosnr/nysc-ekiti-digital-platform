import { prisma } from "@/lib/db";
import { requireAuth, jsonOk, jsonError, clientMeta } from "@/lib/api";
import { loadUserAuthContext } from "@/lib/auth-server";
import { resolveGeoScope, pcmScopeWhere } from "@/lib/scope";
import { writeAudit } from "@/lib/audit";
import { canAccessExitDesk } from "@/lib/exit-workflow";

type Params = { params: Promise<{ id: string }> };

function canViewNin(roles: string[], permissions: string[]): boolean {
  if (
    permissions.includes("*") ||
    permissions.includes("bank:register") ||
    permissions.includes("bank:update")
  ) {
    return true;
  }
  return roles.some(
    (r) =>
      r.toLowerCase().includes("bank account") ||
      r.toLowerCase() === "super admin"
  );
}

function canViewBank(roles: string[], permissions: string[]): boolean {
  return canViewNin(roles, permissions);
}

function canViewClinic(roles: string[], permissions: string[]): boolean {
  if (permissions.includes("*") || permissions.includes("camp:clinic")) {
    return true;
  }
  const r = roles.map((x) => x.toLowerCase());
  return r.some(
    (x) =>
      x.includes("camp doctor") ||
      x.includes("camp nurse") ||
      x.includes("camp pharmacist") ||
      x.includes("head of clinic") ||
      x === "super admin"
  );
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

  const roles = auth.payload.roles;
  const permissions = auth.payload.permissions;
  const showNin = canViewNin(roles, permissions);
  const showBank = canViewBank(roles, permissions);
  const showEfile = canAccessExitDesk(roles, permissions);
  const showClinic = canViewClinic(roles, permissions);

  const pcm = await prisma.pcm.findFirst({
    where: {
      AND: [{ id }, pcmScopeWhere(scope)],
    },
    include: {
      verifications: { orderBy: { verifiedAt: "desc" }, take: 5 },
      familyStatuses: { orderBy: { createdAt: "desc" }, take: 10 },
      skillProfiles: { orderBy: { createdAt: "desc" }, take: 10 },
      ninRecords: showNin
        ? { orderBy: { createdAt: "desc" }, take: 10 }
        : false,
      bankRegistration: showBank,
      bed: {
        include: {
          hostel: { select: { id: true, name: true, genderRestriction: true } },
        },
      },
      exitRequests: showEfile
        ? {
            orderBy: { initiatedAt: "desc" },
            take: 25,
            select: {
              id: true,
              ground: true,
              reasonDetail: true,
              stage: true,
              initiatedByName: true,
              initiatedAt: true,
              nextAssigneeName: true,
              clinicNote: true,
              directorNote: true,
              coordinatorNote: true,
              rejectReason: true,
              rejectedByName: true,
              rejectedAt: true,
            },
          }
        : false,
      electronicFiles: showEfile
        ? {
            orderBy: { createdAt: "desc" },
            take: 50,
            select: {
              id: true,
              type: true,
              subject: true,
              priority: true,
              status: true,
              groundCode: true,
              exitRequestId: true,
              openedByName: true,
              currentHolderName: true,
              createdAt: true,
              updatedAt: true,
              minutes: {
                orderBy: { createdAt: "asc" },
                select: {
                  id: true,
                  fromName: true,
                  toName: true,
                  body: true,
                  action: true,
                  createdAt: true,
                  attachmentUrlsJson: true,
                  includePcmProfile: true,
                },
              },
            },
          }
        : false,
      clinicEncounters: showClinic
        ? {
            orderBy: { openedAt: "desc" },
            take: 5,
            select: {
              id: true,
              status: true,
              chiefComplaint: true,
              diagnosis: true,
              openedByName: true,
              openedAt: true,
              closedAt: true,
            },
          }
        : false,
    },
  });

  if (!pcm) return jsonError("PCM not found", 404);

  function parseAtt(json: string | null | undefined): string[] {
    if (!json) return [];
    try {
      const v = JSON.parse(json);
      return Array.isArray(v) ? v.map(String).filter(Boolean) : [];
    } catch {
      return [];
    }
  }

  const electronicFiles = showEfile
    ? (pcm.electronicFiles ?? []).map((f) => ({
        ...f,
        minutes: (f.minutes ?? []).map((m) => {
          const { attachmentUrlsJson, includePcmProfile, ...rest } = m as {
            attachmentUrlsJson?: string | null;
            includePcmProfile?: boolean;
          } & typeof m;
          return {
            ...rest,
            attachments: parseAtt(attachmentUrlsJson),
            includePcmProfile: Boolean(includePcmProfile),
          };
        }),
      }))
    : [];

  const payload = {
    ...pcm,
    ninRecords: showNin ? pcm.ninRecords ?? [] : [],
    bankRegistration: showBank ? pcm.bankRegistration ?? null : null,
    exitRequests: showEfile ? pcm.exitRequests ?? [] : [],
    electronicFiles,
    clinicEncounters: showClinic ? pcm.clinicEncounters ?? [] : [],
    _meta: {
      canViewNin: showNin,
      canViewBank: showBank,
      canViewEfile: showEfile,
      canViewClinic: showClinic,
    },
  };

  return jsonOk({ pcm: payload });
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
