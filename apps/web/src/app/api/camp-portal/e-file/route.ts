import { prisma } from "@/lib/db";
import { jsonOk, jsonError } from "@/lib/api";
import { getCmBearerPayload } from "@/lib/cm-auth";

const CM_FILE_TYPES = [
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
          select: { body: true, action: true, createdAt: true },
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
        latestMinute: f.minutes[0] ?? null,
      })),
    });
  } catch (e) {
    console.error("cm e-file list", e);
    return jsonError("Could not load files", 500);
  }
}

/**
 * CM opens an e-file on their own record only.
 * pcmId is always from the session. Optional nextToUserId(s) for routing.
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
    const subject = String(body.subject ?? "").trim();
    const minute = body.minute ? String(body.minute).trim() : "";

    const nextToUserId = body.nextToUserId ? String(body.nextToUserId) : null;
    const nextToUserIds: string[] = Array.isArray(body.nextToUserIds)
      ? body.nextToUserIds.map(String).filter(Boolean)
      : nextToUserId
        ? [nextToUserId]
        : [];

    if (!subject) {
      return jsonError("Subject is required");
    }
    if (!nextToUserIds.length) {
      return jsonError("Select at least one officer to send this file to");
    }

    const pcmId = payload.sub;
    const pcm = await prisma.pcm.findUnique({
      where: { id: pcmId },
      select: { id: true, fullName: true },
    });
    if (!pcm) {
      return jsonError("Session invalid", 401);
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

    const openerName = payload.fullName || pcm.fullName;

    const file = await prisma.electronicFile.create({
      data: {
        pcmId,
        type: type as
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
        priority: "NORMAL",
        status: "IN_TRANSIT",
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
            body: minute || subject,
            action: "FORWARD",
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
      },
    });

    return jsonOk({ file }, 201);
  } catch (e) {
    console.error("cm e-file create", e);
    return jsonError(e instanceof Error ? e.message : "Could not create file", 400);
  }
}
