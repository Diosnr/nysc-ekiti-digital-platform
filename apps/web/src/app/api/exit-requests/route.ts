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
  const stage = url.searchParams.get("stage"); // pending bucket or APPROVED|REJECTED
  const bucket = url.searchParams.get("bucket"); // mine | pending | approved | rejected | all

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

  const rows = await prisma.campExitRequest.findMany({
    where,
    orderBy: { initiatedAt: "desc" },
    take: 200,
    include: {
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
    requests: rows.map((r) => ({
      ...r,
      photoUrls: r.photoUrlsJson ? safeJson(r.photoUrlsJson) : [],
    })),
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

/** Platoon (or allowed role) initiates exit request */
export async function POST(req: Request) {
  const auth = await requireAuth(req);
  if (auth instanceof Response) return auth;

  if (!canInitiateExit(auth.payload.roles, auth.payload.permissions)) {
    return jsonError("Only platoon officers (or higher) may initiate exit", 403);
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
    include: {
      pcm: {
        select: {
          id: true,
          callUpNumber: true,
          fullName: true,
          photographUrl: true,
        },
      },
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
