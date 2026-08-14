import { prisma } from "@/lib/db";
import { requireAuth, jsonOk, jsonError, clientMeta } from "@/lib/api";
import { writeAudit } from "@/lib/audit";
import {
  firstStageAfterInitiation,
  canInitiateExit,
  type ExitGround,
} from "@/lib/exit-workflow";

export async function GET(req: Request) {
  const auth = await requireAuth(req);
  if (auth instanceof Response) return auth;

  const url = new URL(req.url);
  const stage = url.searchParams.get("stage");
  const bucket = url.searchParams.get("bucket");

  const where: Record<string, unknown> = {};
  if (stage) where.stage = stage;
  if (bucket === "approved") where.stage = "APPROVED";
  if (bucket === "rejected") where.stage = "REJECTED";
  if (bucket === "pending") {
    where.stage = {
      in: [
        "AWAITING_CLINIC",
        "AWAITING_CAMP_DIRECTOR",
        "AWAITING_STATE_COORDINATOR",
      ],
    };
  }

  // Light list — never ship base64 evidence photos in the list payload
  const rows = await prisma.campExitRequest.findMany({
    where,
    orderBy: { initiatedAt: "desc" },
    take: 100,
    select: {
      id: true,
      ground: true,
      reasonDetail: true,
      stage: true,
      photoUrlsJson: true,
      initiatedByName: true,
      initiatedAt: true,
      clinicByName: true,
      clinicAt: true,
      clinicNote: true,
      directorByName: true,
      directorAt: true,
      directorNote: true,
      coordinatorByName: true,
      coordinatorAt: true,
      coordinatorNote: true,
      rejectedByName: true,
      rejectedAt: true,
      rejectReason: true,
      pcm: {
        select: {
          id: true,
          callUpNumber: true,
          fullName: true,
          photographUrl: true,
          status: true,
          institution: true,
          deploymentState: true,
          dateReporting: true,
          exitGround: true,
          exitReason: true,
        },
      },
    },
  });

  return jsonOk({
    requests: rows.map((r) => {
      const urls = countPhotos(r.photoUrlsJson);
      return {
        id: r.id,
        ground: r.ground,
        reasonDetail: r.reasonDetail,
        stage: r.stage,
        photoCount: urls,
        photoUrls: [] as string[],
        initiatedByName: r.initiatedByName,
        initiatedAt: r.initiatedAt,
        clinicByName: r.clinicByName,
        clinicAt: r.clinicAt,
        clinicNote: r.clinicNote,
        directorByName: r.directorByName,
        directorAt: r.directorAt,
        directorNote: r.directorNote,
        coordinatorByName: r.coordinatorByName,
        coordinatorAt: r.coordinatorAt,
        coordinatorNote: r.coordinatorNote,
        rejectedByName: r.rejectedByName,
        rejectedAt: r.rejectedAt,
        rejectReason: r.rejectReason,
        pcm: r.pcm,
      };
    }),
  });
}

function countPhotos(json: string | null): number {
  if (!json) return 0;
  try {
    const v = JSON.parse(json);
    return Array.isArray(v) ? v.length : 0;
  } catch {
    return 0;
  }
}

export async function POST(req: Request) {
  const auth = await requireAuth(req);
  if (auth instanceof Response) return auth;

  if (!canInitiateExit(auth.payload.roles, auth.payload.permissions)) {
    return jsonError("Only platoon officers may initiate exit requests", 403);
  }

  const body = await req.json();
  const pcmId = String(body.pcmId ?? "");
  const ground = String(body.ground ?? "").toUpperCase() as ExitGround;
  const reasonDetail = body.reasonDetail ? String(body.reasonDetail).trim() : null;
  const photoUrls: string[] = Array.isArray(body.photoUrls)
    ? body.photoUrls.map(String).filter(Boolean)
    : [];

  if (!pcmId) return jsonError("pcmId required");
  if (!["MARITAL", "MEDICAL", "TERRORISM"].includes(ground)) {
    return jsonError("ground must be MARITAL, MEDICAL, or TERRORISM");
  }

  const pcm = await prisma.pcm.findUnique({ where: { id: pcmId } });
  if (!pcm) return jsonError("PCM not found", 404);
  if (pcm.status === "CHECKED_OUT" || pcm.status === "CAMP_EXITED") {
    return jsonError("Member already exited", 400);
  }

  const open = await prisma.campExitRequest.findFirst({
    where: {
      pcmId,
      stage: {
        in: [
          "AWAITING_CLINIC",
          "AWAITING_CAMP_DIRECTOR",
          "AWAITING_STATE_COORDINATOR",
        ],
      },
    },
  });
  if (open) return jsonError("An open exit request already exists for this member", 409);

  const actor = await prisma.user.findUnique({
    where: { id: auth.payload.sub },
    select: { name: true, email: true },
  });
  const actorName = actor?.name?.trim() || actor?.email || auth.payload.email;
  const stage = firstStageAfterInitiation(ground);

  const row = await prisma.campExitRequest.create({
    data: {
      pcmId,
      ground,
      reasonDetail,
      photoUrlsJson: photoUrls.length ? JSON.stringify(photoUrls) : null,
      stage,
      initiatedById: auth.payload.sub,
      initiatedByName: actorName,
    },
    select: {
      id: true,
      ground: true,
      stage: true,
      initiatedByName: true,
      pcm: { select: { id: true, callUpNumber: true, fullName: true } },
    },
  });

  await prisma.pcm.update({
    where: { id: pcmId },
    data: {
      status: "CAMP_EXIT_REQUESTED",
      exitGround: ground,
      exitReason: reasonDetail || ground,
    },
  });

  const meta = clientMeta(req);
  await writeAudit({
    actorId: auth.payload.sub,
    actorEmail: auth.payload.email,
    actorRoleAtTime: auth.payload.roles.join(","),
    action: "pcm.exit.initiate",
    entityType: "CampExitRequest",
    entityId: row.id,
    pcmId,
    after: { ground, stage, initiatedByName: actorName },
    ip: meta.ip,
    userAgent: meta.userAgent,
  });

  return jsonOk({ request: row }, 201);
}
