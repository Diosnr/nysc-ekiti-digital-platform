import { prisma } from "@/lib/db";
import { jsonOk, jsonError } from "@/lib/api";
import { getCmBearerPayload } from "@/lib/cm-auth";
import { uploadDataUriToCloudinary } from "@/lib/cloudinary";
import {
  firstStageAfterInitiation,
  normalizeExitGroundCode,
} from "@/lib/exit-workflow";

const CM_FILE_TYPES = [
  "CAMP_EXIT",
  "GENERAL",
  "LEAVE",
  "SICK_LEAVE",
  "CASUAL_LEAVE",
  "MATERNITY_LEAVE",
  "CONVOCATION_LEAVE",
  "RELOCATION",
  "REPOSTING",
  "QUERY",
  "OTHERS",
] as const;

const TYPE_LABELS: Record<string, string> = {
  CAMP_EXIT: "Camp exit",
  GENERAL: "General",
  LEAVE: "Leave",
  SICK_LEAVE: "Sick leave",
  CASUAL_LEAVE: "Casual leave",
  MATERNITY_LEAVE: "Maternity leave",
  CONVOCATION_LEAVE: "Convocation leave",
  RELOCATION: "Relocation",
  REPOSTING: "Reposting",
  QUERY: "Query / response",
  OTHERS: "Others",
};

const PENDING_EXIT = [
  "AWAITING_CLINIC",
  "AWAITING_CAMP_DIRECTOR",
  "AWAITING_STATE_COORDINATOR",
] as const;

/** List electronic files for the logged-in corps member only. */
export async function GET(req: Request) {
  const payload = await getCmBearerPayload(req.headers.get("authorization"));
  if (!payload) {
    return jsonError("Unauthorized", 401);
  }

  try {
    const rows = await prisma.electronicFile.findMany({
      where: { pcmId: payload.sub },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true,
        type: true,
        subject: true,
        priority: true,
        status: true,
        openedByName: true,
        currentHolderName: true,
        createdAt: true,
        updatedAt: true,
        minutes: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { body: true, action: true, createdAt: true, attachmentUrlsJson: true },
        },
      },
    });

    return jsonOk({
      files: rows.map((f) => ({
        id: f.id,
        type: f.type,
        subject: f.subject,
        priority: f.priority,
        status: f.status,
        openedByName: f.openedByName,
        currentHolderName: f.currentHolderName,
        createdAt: f.createdAt,
        updatedAt: f.updatedAt,
        latestMinute: f.minutes[0]
          ? {
              body: f.minutes[0].body,
              action: f.minutes[0].action,
              createdAt: f.minutes[0].createdAt,
              attachmentUrls: f.minutes[0].attachmentUrlsJson
                ? (JSON.parse(f.minutes[0].attachmentUrlsJson) as string[])
                : [],
            }
          : null,
      })),
    });
  } catch (e) {
    console.error("cm e-file list", e);
    return jsonError("Could not load files", 500);
  }
}

/**
 * CM opens an e-file on their own record only.
 * CAMP_EXIT also opens a camp exit request in the staff workflow.
 */
export async function POST(req: Request) {
  const payload = await getCmBearerPayload(req.headers.get("authorization"));
  if (!payload) {
    return jsonError("Unauthorized", 401);
  }

  try {
    const body = await req.json();
    const typeRaw = String(body.type ?? "GENERAL").toUpperCase();
    const type = CM_FILE_TYPES.includes(typeRaw as (typeof CM_FILE_TYPES)[number])
      ? (typeRaw as (typeof CM_FILE_TYPES)[number])
      : "GENERAL";
    const otherSubject = String(body.subject ?? "").trim();
    const minute = body.minute ? String(body.minute).trim() : "";
    const groundRaw = body.ground ? String(body.ground).trim().toUpperCase() : "";

    const nextToUserId = body.nextToUserId ? String(body.nextToUserId) : null;
    const nextToUserIds: string[] = Array.isArray(body.nextToUserIds)
      ? body.nextToUserIds.map(String).filter(Boolean)
      : nextToUserId
        ? [nextToUserId]
        : [];

    const rawPhotos: string[] = Array.isArray(body.photoUrls)
      ? body.photoUrls.map(String).filter(Boolean)
      : Array.isArray(body.photoDataUrls)
        ? body.photoDataUrls.map(String).filter(Boolean)
        : [];

    if (type === "OTHERS" && !otherSubject) {
      return jsonError("Please describe the file type for Others");
    }
    if (type === "CAMP_EXIT" && !groundRaw && !minute && !otherSubject) {
      return jsonError("Select an exit ground or explain the reason in Details");
    }
    if (!nextToUserIds.length) {
      return jsonError("Select at least one officer to send this file to");
    }

    const pcmId = payload.sub;
    const pcm = await prisma.pcm.findUnique({
      where: { id: pcmId },
      select: {
        id: true,
        fullName: true,
        callUpNumber: true,
        status: true,
      },
    });
    if (!pcm) {
      return jsonError("Session invalid", 401);
    }

    if (type === "CAMP_EXIT") {
      if (pcm.status === "CHECKED_OUT" || pcm.status === "CAMP_EXITED") {
        return jsonError("You have already exited camp", 400);
      }
      const openExit = await prisma.campExitRequest.findFirst({
        where: { pcmId, stage: { in: [...PENDING_EXIT] } },
      });
      if (openExit) {
        return jsonError("You already have an open camp exit request", 409);
      }
    }

    const uniqueIds = [...new Set(nextToUserIds)];
    const users = await prisma.user.findMany({
      where: { id: { in: uniqueIds }, isActive: true },
      select: { id: true, name: true, email: true, post: true },
    });
    if (!users.length) {
      return jsonError("Selected officer(s) not found or inactive");
    }

    const byId = new Map(users.map((u) => [u.id, u]));
    let primaryId: string | null = null;
    let primaryName: string | null = null;
    const ccList: { id: string; name: string }[] = [];

    for (const id of uniqueIds) {
      const u = byId.get(id);
      if (!u) continue;
      const name = u.name?.trim() || u.post || u.email;
      if (!primaryId) {
        primaryId = u.id;
        primaryName = name;
      } else {
        ccList.push({ id: u.id, name });
      }
    }

    if (!primaryId) {
      return jsonError("Select at least one officer to send this file to");
    }

    const subject =
      type === "OTHERS"
        ? otherSubject
        : type === "CAMP_EXIT"
          ? otherSubject ||
            (groundRaw ? `Camp exit · ${groundRaw}` : "Camp exit request")
          : TYPE_LABELS[type] || type;

    const photoUrls: string[] = [];
    for (let i = 0; i < Math.min(rawPhotos.length, 6); i++) {
      const raw = rawPhotos[i];
      if (raw.startsWith("data:image")) {
        const url = await uploadDataUriToCloudinary(
          raw,
          `efile_${pcm.callUpNumber}_${i}`
        );
        photoUrls.push(url || raw);
      } else if (/^https?:\/\//i.test(raw)) {
        photoUrls.push(raw);
      }
    }

    const openerName = payload.fullName || pcm.fullName;
    let exitRequestId: string | null = null;

    if (type === "CAMP_EXIT") {
      const ground = groundRaw || "OTHER";
      const canon = normalizeExitGroundCode(ground);
      let requiresClinic: boolean | undefined;
      try {
        const opt = await prisma.exitGroundOption.findFirst({
          where: {
            OR: [{ code: ground }, { code: canon }],
            isActive: true,
          },
        });
        if (opt) requiresClinic = opt.requiresClinic;
      } catch {
        /* ignore */
      }
      if (requiresClinic === undefined) {
        requiresClinic = canon === "MEDICAL";
      }
      const stage = firstStageAfterInitiation(ground, requiresClinic);
      const groundForDb = canon || ground;

      const exitRow = await prisma.campExitRequest.create({
        data: {
          pcmId,
          ground: groundForDb,
          reasonDetail: minute || otherSubject || `Camp exit requested by corps member`,
          photoUrlsJson: photoUrls.length ? JSON.stringify(photoUrls) : null,
          stage,
          initiatedById: `cm:${pcmId}`,
          initiatedByName: `${openerName} (corps member)`,
          nextAssigneeId: primaryId,
          nextAssigneeName: primaryName,
        },
      });
      exitRequestId = exitRow.id;

      await prisma.pcm.update({
        where: { id: pcmId },
        data: {
          status: "CAMP_EXIT_REQUESTED",
          exitGround: groundForDb,
          exitReason: minute || otherSubject || groundForDb,
        },
      });
    }

    const file = await prisma.electronicFile.create({
      data: {
        pcmId,
        type: type as
          | "CAMP_EXIT"
          | "GENERAL"
          | "LEAVE"
          | "SICK_LEAVE"
          | "CASUAL_LEAVE"
          | "MATERNITY_LEAVE"
          | "CONVOCATION_LEAVE"
          | "RELOCATION"
          | "REPOSTING"
          | "QUERY"
          | "OTHERS",
        subject,
        priority: type === "CAMP_EXIT" ? "HIGH" : "NORMAL",
        status: "IN_TRANSIT",
        groundCode: type === "CAMP_EXIT" ? groundRaw || "OTHER" : null,
        exitRequestId,
        openedById: null,
        openedByName: openerName,
        currentHolderId: primaryId,
        currentHolderName: primaryName,
        minutes: {
          create: {
            fromUserId: null,
            fromName: openerName,
            toUserId: primaryId,
            toName: primaryName,
            ccJson: ccList.length ? JSON.stringify(ccList) : null,
            body:
              minute ||
              (type === "CAMP_EXIT"
                ? `Camp exit requested by corps member${groundRaw ? ` (${groundRaw})` : ""}.`
                : subject),
            action: "FORWARD",
            attachmentUrlsJson: photoUrls.length
              ? JSON.stringify(photoUrls)
              : null,
          },
        },
      },
      select: {
        id: true,
        type: true,
        subject: true,
        status: true,
        currentHolderName: true,
        createdAt: true,
        exitRequestId: true,
      },
    });

    return jsonOk(
      {
        file,
        exitRequestId,
        message:
          type === "CAMP_EXIT"
            ? "Camp exit request submitted and sent to the selected officer."
            : undefined,
      },
      201
    );
  } catch (e) {
    console.error("cm e-file create", e);
    return jsonError(e instanceof Error ? e.message : "Could not create file", 400);
  }
}
