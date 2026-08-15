import { prisma } from "@/lib/db";
import { requireAuth, jsonOk, jsonError, clientMeta } from "@/lib/api";
import { writeAudit } from "@/lib/audit";
import { hasClinicAccess } from "@/lib/clinic-access";

/** List open encounters or create a new clinical encounter (classified). */
export async function GET(req: Request) {
  const auth = await requireAuth(req);
  if (auth instanceof Response) return auth;
  if (!hasClinicAccess(auth.payload.roles, auth.payload.permissions)) {
    return jsonError("Forbidden — clinic access only", 403);
  }

  const url = new URL(req.url);
  const status = url.searchParams.get("status") || "OPEN";
  const pcmId = url.searchParams.get("pcmId") || "";

  const where: Record<string, unknown> = {};
  if (status === "OPEN" || status === "CLOSED") where.status = status;
  if (pcmId) where.pcmId = pcmId;

  try {
    const rows = await prisma.clinicEncounter.findMany({
      where,
      orderBy: { openedAt: "desc" },
      take: 50,
      include: {
        pcm: {
          select: {
            id: true,
            fullName: true,
            callUpNumber: true,
            stateCode: true,
            gender: true,
            photographUrl: true,
            status: true,
          },
        },
        vitals: { orderBy: { recordedAt: "desc" }, take: 1 },
        drugs: { orderBy: { dispensedAt: "desc" }, take: 3 },
      },
    });

    return jsonOk({
      encounters: rows.map((e) => ({
        id: e.id,
        status: e.status,
        chiefComplaint: e.chiefComplaint,
        diagnosis: e.diagnosis,
        openedByName: e.openedByName,
        openedAt: e.openedAt,
        attendedByDoctorName: e.attendedByDoctorName,
        attendedAt: e.attendedAt,
        closedAt: e.closedAt,
        latestVital: e.vitals[0] ?? null,
        recentDrugs: e.drugs,
        pcm: e.pcm,
      })),
    });
  } catch (e) {
    return jsonError(
      e instanceof Error ? e.message : "Clinic tables missing — deploy schema"
    );
  }
}

export async function POST(req: Request) {
  const auth = await requireAuth(req);
  if (auth instanceof Response) return auth;
  if (!hasClinicAccess(auth.payload.roles, auth.payload.permissions)) {
    return jsonError("Forbidden — clinic access only", 403);
  }

  const body = await req.json().catch(() => ({}));
  const pcmId = String(body.pcmId ?? "");
  const chiefComplaint = body.chiefComplaint
    ? String(body.chiefComplaint).trim()
    : null;

  if (!pcmId) return jsonError("pcmId required");

  const pcm = await prisma.pcm.findUnique({ where: { id: pcmId } });
  if (!pcm) return jsonError("Member not found", 404);

  const open = await prisma.clinicEncounter.findFirst({
    where: { pcmId, status: "OPEN" },
  });
  if (open) {
    return jsonError("An open encounter already exists for this member", 409);
  }

  const actor = await prisma.user.findUnique({
    where: { id: auth.payload.sub },
    select: { name: true, email: true },
  });
  const actorName = actor?.name?.trim() || actor?.email || auth.payload.email;

  const encounter = await prisma.clinicEncounter.create({
    data: {
      pcmId,
      chiefComplaint,
      openedById: auth.payload.sub,
      openedByName: actorName,
      status: "OPEN",
    },
    include: {
      pcm: {
        select: {
          id: true,
          fullName: true,
          callUpNumber: true,
          stateCode: true,
          gender: true,
          photographUrl: true,
        },
      },
    },
  });

  const meta = clientMeta(req);
  await writeAudit({
    actorId: auth.payload.sub,
    actorEmail: auth.payload.email,
    actorRoleAtTime: auth.payload.roles.join(","),
    action: "clinic.encounter.open",
    entityType: "ClinicEncounter",
    entityId: encounter.id,
    pcmId,
    after: { chiefComplaint },
    ip: meta.ip,
    userAgent: meta.userAgent,
  });

  return jsonOk({ encounter }, 201);
}
