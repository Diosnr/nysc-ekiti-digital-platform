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
 * pcmId is always taken from the session — never from the request body.
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

    if (!subject) {
      return jsonError("Subject is required");
    }

    const pcmId = payload.sub;
    const pcm = await prisma.pcm.findUnique({
      where: { id: pcmId },
      select: { id: true, fullName: true },
    });
    if (!pcm) {
      return jsonError("Session invalid", 401);
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
        status: "PENDING",
        openedById: null,
        openedByName: openerName,
        currentHolderId: null,
        currentHolderName: null,
        minutes: {
          create: {
            fromUserId: null,
            fromName: openerName,
            toUserId: null,
            toName: null,
            body: minute || subject,
            action: "DRAFT",
          },
        },
      },
      select: {
        id: true,
        type: true,
        subject: true,
        status: true,
        createdAt: true,
      },
    });

    return jsonOk({ file }, 201);
  } catch (e) {
    console.error("cm e-file create", e);
    return jsonError(e instanceof Error ? e.message : "Could not create file", 400);
  }
}
