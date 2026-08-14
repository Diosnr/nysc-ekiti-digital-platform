import { prisma } from "@/lib/db";
import { requireAuth, jsonOk, jsonError, clientMeta } from "@/lib/api";
import { writeAudit } from "@/lib/audit";
import {
  canActOnStage,
  nextStageAfterApprove,
  type ExitStage,
  type ExitGround,
} from "@/lib/exit-workflow";

type Params = { params: Promise<{ id: string }> };

export async function GET(req: Request, { params }: Params) {
  const auth = await requireAuth(req);
  if (auth instanceof Response) return auth;

  const { id } = await params;
  const wantPhotos = new URL(req.url).searchParams.get("photos") === "1";

  const row = await prisma.campExitRequest.findUnique({
    where: { id },
    select: {
      id: true,
      ground: true,
      reasonDetail: true,
      stage: true,
      photoUrlsJson: wantPhotos,
      initiatedById: true,
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
          gender: true,
          batchYear: true,
          campAddress: true,
        },
      },
    },
  });
  if (!row) return jsonError("Not found", 404);

  const photoUrls =
    wantPhotos && row.photoUrlsJson ? safeJson(row.photoUrlsJson) : [];

  return jsonOk({
    request: {
      ...row,
      photoUrlsJson: undefined,
      photoUrls,
      photoCount: row.photoUrlsJson ? countPhotos(row.photoUrlsJson) : photoUrls.length,
    },
  });
}

function safeJson(s: string): string[] {
  try {
    const v = JSON.parse(s);
    return Array.isArray(v) ? v.map(String) : [];
  } catch {
    return [];
  }
}

function countPhotos(json: string): number {
  try {
    const v = JSON.parse(json);
    return Array.isArray(v) ? v.length : 0;
  } catch {
    return 0;
  }
}

export async function PATCH(req: Request, { params }: Params) {
  const auth = await requireAuth(req);
  if (auth instanceof Response) return auth;

  const { id } = await params;
  const body = await req.json();
  const decision = String(body.decision ?? "").toLowerCase();
  const note = body.note ? String(body.note).trim() : null;

  if (decision !== "approve" && decision !== "reject") {
    return jsonError("decision must be approve or reject");
  }

  const row = await prisma.campExitRequest.findUnique({ where: { id } });
  if (!row) return jsonError("Not found", 404);

  const stage = row.stage as ExitStage;
  if (stage === "APPROVED" || stage === "REJECTED" || stage === "CANCELLED") {
    return jsonError("Request already closed", 400);
  }

  if (!canActOnStage(stage, auth.payload.roles, auth.payload.permissions)) {
    return jsonError("Not your turn to act on this request", 403);
  }

  const actor = await prisma.user.findUnique({
    where: { id: auth.payload.sub },
    select: { name: true, email: true },
  });
  const actorName = actor?.name?.trim() || actor?.email || auth.payload.email;
  const now = new Date();

  if (decision === "reject") {
    const updated = await prisma.campExitRequest.update({
      where: { id },
      data: {
        stage: "REJECTED",
        rejectedById: auth.payload.sub,
        rejectedByName: actorName,
        rejectedAt: now,
        rejectReason: note,
      },
    });

    // Member stays in camp; no security checkout; clear any grant stamp
    const pcm = await prisma.pcm.findUnique({ where: { id: row.pcmId } });
    await prisma.pcm.update({
      where: { id: row.pcmId },
      data: {
        campExitGrantedAt: null,
        campExitGrantedById: null,
        exitGround: null,
        exitReason: null,
        status:
          pcm?.status === "CAMP_EXIT_REQUESTED" || pcm?.status === "CHECKED_IN"
            ? "CAMP_ACTIVE"
            : pcm?.status ?? "CAMP_ACTIVE",
      },
    });

    const meta = clientMeta(req);
    await writeAudit({
      actorId: auth.payload.sub,
      actorEmail: auth.payload.email,
      actorRoleAtTime: auth.payload.roles.join(","),
      action: "pcm.exit.reject",
      entityType: "CampExitRequest",
      entityId: id,
      pcmId: row.pcmId,
      after: { rejectedByName: actorName, note, stage: "REJECTED" },
      ip: meta.ip,
      userAgent: meta.userAgent,
    });

    return jsonOk({ request: updated });
  }

  const next = nextStageAfterApprove(stage, row.ground as ExitGround);
  const data: Record<string, unknown> = { stage: next };

  if (stage === "AWAITING_CLINIC") {
    data.clinicById = auth.payload.sub;
    data.clinicByName = actorName;
    data.clinicAt = now;
    data.clinicNote = note;
  } else if (stage === "AWAITING_CAMP_DIRECTOR") {
    data.directorById = auth.payload.sub;
    data.directorByName = actorName;
    data.directorAt = now;
    data.directorNote = note;
  } else if (stage === "AWAITING_STATE_COORDINATOR") {
    data.coordinatorById = auth.payload.sub;
    data.coordinatorByName = actorName;
    data.coordinatorAt = now;
    data.coordinatorNote = note;
  }

  const updated = await prisma.campExitRequest.update({
    where: { id },
    data,
  });

  if (next === "APPROVED") {
    await prisma.pcm.update({
      where: { id: row.pcmId },
      data: {
        campExitGrantedAt: now,
        campExitGrantedById: auth.payload.sub,
        exitGround: row.ground,
        exitReason: row.reasonDetail || row.ground,
      },
    });
  }

  const meta = clientMeta(req);
  await writeAudit({
    actorId: auth.payload.sub,
    actorEmail: auth.payload.email,
    actorRoleAtTime: auth.payload.roles.join(","),
    action: "pcm.exit.approve",
    entityType: "CampExitRequest",
    entityId: id,
    pcmId: row.pcmId,
    after: { approvedByName: actorName, from: stage, to: next, note },
    ip: meta.ip,
    userAgent: meta.userAgent,
  });

  return jsonOk({ request: updated });
}
