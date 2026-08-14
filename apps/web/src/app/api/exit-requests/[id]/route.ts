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
  const row = await prisma.campExitRequest.findUnique({
    where: { id },
    include: {
      pcm: {
        include: {
          familyStatuses: { orderBy: { createdAt: "desc" }, take: 5 },
          skillProfiles: { orderBy: { createdAt: "desc" }, take: 5 },
          ninRecords: { orderBy: { createdAt: "desc" }, take: 3 },
        },
      },
    },
  });
  if (!row) return jsonError("Not found", 404);

  return jsonOk({
    request: {
      ...row,
      photoUrls: row.photoUrlsJson ? safeJson(row.photoUrlsJson) : [],
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

/** Approve or reject at current stage — stamps actor's name */
export async function PATCH(req: Request, { params }: Params) {
  const auth = await requireAuth(req);
  if (auth instanceof Response) return auth;

  const { id } = await params;
  const body = await req.json();
  const decision = String(body.decision ?? "").toLowerCase(); // approve | reject
  const note = body.note ? String(body.note).trim() : null;

  if (decision !== "approve" && decision !== "reject") {
    return jsonError("decision must be approve or reject");
  }

  const row = await prisma.campExitRequest.findUnique({ where: { id } });
  if (!row) return jsonError("Not found", 404);

  const stage = row.stage as ExitStage;
  if (
    stage === "APPROVED" ||
    stage === "REJECTED" ||
    stage === "CANCELLED"
  ) {
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
    await prisma.pcm.update({
      where: { id: row.pcmId },
      data: {
        // keep exitGround stamp for history; clear grant
        campExitGrantedAt: null,
        campExitGrantedById: null,
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
      after: { rejectedByName: actorName, note },
      ip: meta.ip,
      userAgent: meta.userAgent,
    });

    return jsonOk({ request: updated });
  }

  // approve
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
