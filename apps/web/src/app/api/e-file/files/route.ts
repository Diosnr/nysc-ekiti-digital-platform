import { prisma } from "@/lib/db";
import { requireAuth, jsonOk, jsonError, clientMeta } from "@/lib/api";
import { writeAudit } from "@/lib/audit";
import { canAccessExitDesk } from "@/lib/exit-workflow";

const FILE_TYPES = [
  "CAMP_EXIT",
  "LEAVE",
  "SICK_LEAVE",
  "CASUAL_LEAVE",
  "MATERNITY_LEAVE",
  "CONVOCATION_LEAVE",
  "RELOCATION",
  "REPOSTING",
  "GENERAL",
  "QUERY",
  "OTHERS",
] as const;

export async function GET(req: Request) {
  const auth = await requireAuth(req);
  if (auth instanceof Response) return auth;
  if (!canAccessExitDesk(auth.payload.roles, auth.payload.permissions)) {
    return jsonError("Forbidden", 403);
  }

  const url = new URL(req.url);
  const bucket = url.searchParams.get("bucket") || "pending";
  const mine = url.searchParams.get("mine") === "1";
  const holder = url.searchParams.get("holder") === "1";

  const where: Record<string, unknown> = {};
  if (bucket === "pending") {
    where.status = { in: ["IN_TRANSIT", "PENDING", "DRAFT"] };
  } else if (bucket === "approved") {
    where.status = "APPROVED";
  } else if (bucket === "rejected") {
    where.status = { in: ["RETURNED", "REJECTED"] };
  }
  if (mine) where.openedById = auth.payload.sub;
  if (holder) where.currentHolderId = auth.payload.sub;

  try {
    const rows = await prisma.electronicFile.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 100,
      include: {
        pcm: {
          select: {
            id: true,
            callUpNumber: true,
            fullName: true,
            photographUrl: true,
            institution: true,
            deploymentState: true,
            dateReporting: true,
            stateCode: true,
          },
        },
        minutes: {
          orderBy: { createdAt: "asc" },
          take: 1,
          select: { body: true },
        },
      },
    });

    return jsonOk({
      files: rows.map((f) => ({
        id: f.id,
        kind: "efile",
        type: f.type,
        subject: f.subject,
        priority: f.priority,
        status: f.status,
        groundCode: f.groundCode,
        exitRequestId: f.exitRequestId,
        openedByName: f.openedByName,
        currentHolderName: f.currentHolderName,
        createdAt: f.createdAt,
        preview: f.minutes[0]?.body ?? null,
        pcm: f.pcm,
      })),
    });
  } catch {
    return jsonOk({ files: [] });
  }
}

export async function POST(req: Request) {
  const auth = await requireAuth(req);
  if (auth instanceof Response) return auth;

  if (!canAccessExitDesk(auth.payload.roles, auth.payload.permissions)) {
    return jsonError("Forbidden", 403);
  }

  const body = await req.json();
  const pcmId = String(body.pcmId ?? "");
  const typeRaw = String(body.type ?? "GENERAL").toUpperCase();
  const type = FILE_TYPES.includes(typeRaw as (typeof FILE_TYPES)[number])
    ? (typeRaw as (typeof FILE_TYPES)[number])
    : "GENERAL";
  const subject = String(body.subject ?? "").trim();
  const otherLabel = body.otherLabel ? String(body.otherLabel).trim() : "";
  const minute = body.minute ? String(body.minute).trim() : "";
  const priority = String(body.priority ?? "NORMAL").toUpperCase();
  const photoUrls: string[] = Array.isArray(body.photoUrls)
    ? body.photoUrls.map(String).filter(Boolean)
    : [];
  const nextToUserId = body.nextToUserId ? String(body.nextToUserId) : null;
  const nextToUserIds: string[] = Array.isArray(body.nextToUserIds)
    ? body.nextToUserIds.map(String).filter(Boolean)
    : nextToUserId
      ? [nextToUserId]
      : [];
  const ground = body.ground ? String(body.ground).trim().toUpperCase() : null;

  if (!pcmId) return jsonError("pcmId required");
  if (!subject && !minute && !otherLabel) return jsonError("Subject or minute required");

  if (type === "CAMP_EXIT") {
    return jsonError("Use camp-exit flow for type CAMP_EXIT", 400);
  }

  const pcm = await prisma.pcm.findUnique({ where: { id: pcmId } });
  if (!pcm) return jsonError("PCM not found", 404);

  const actor = await prisma.user.findUnique({
    where: { id: auth.payload.sub },
    select: { name: true, email: true },
  });
  const actorName = actor?.name?.trim() || actor?.email || auth.payload.email;

  const uniqueIds = [...new Set(nextToUserIds)];
  let primaryId: string | null = null;
  let primaryName: string | null = null;
  const ccList: { id: string; name: string }[] = [];

  if (uniqueIds.length) {
    const users = await prisma.user.findMany({
      where: { id: { in: uniqueIds }, isActive: true },
      select: { id: true, name: true, email: true },
    });
    const byId = new Map(users.map((u) => [u.id, u]));
    for (const id of uniqueIds) {
      const u = byId.get(id);
      if (!u) continue;
      const name = u.name?.trim() || u.email;
      if (!primaryId) {
        primaryId = u.id;
        primaryName = name;
      } else {
        ccList.push({ id: u.id, name });
      }
    }
  }

  const resolvedSubject =
    subject ||
    otherLabel ||
    minute.slice(0, 120) ||
    type;

  try {
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
        subject: resolvedSubject,
        priority: priority || "NORMAL",
        status: primaryId ? "IN_TRANSIT" : "PENDING",
        groundCode: ground,
        openedById: auth.payload.sub,
        openedByName: actorName,
        currentHolderId: primaryId,
        currentHolderName: primaryName,
        minutes: {
          create: {
            fromUserId: auth.payload.sub,
            fromName: actorName,
            toUserId: primaryId,
            toName: primaryName,
            ccJson: ccList.length ? JSON.stringify(ccList) : null,
            body: minute || subject || otherLabel || `File opened (${type}).`,
            action: primaryId ? "FORWARD" : "DRAFT",
            attachmentUrlsJson: photoUrls.length
              ? JSON.stringify(photoUrls)
              : null,
          },
        },
      },
      include: {
        pcm: {
          select: {
            id: true,
            callUpNumber: true,
            fullName: true,
            photographUrl: true,
            stateCode: true,
          },
        },
      },
    });

    const meta = clientMeta(req);
    await writeAudit({
      actorId: auth.payload.sub,
      actorEmail: auth.payload.email,
      actorRoleAtTime: auth.payload.roles.join(","),
      action: "efile.create",
      entityType: "ElectronicFile",
      entityId: file.id,
      pcmId,
      after: {
        type,
        subject: file.subject,
        nextAssigneeName: primaryName,
        cc: ccList.map((c) => c.name),
      },
      ip: meta.ip,
      userAgent: meta.userAgent,
    });

    return jsonOk({ file }, 201);
  } catch (e) {
    return jsonError(
      e instanceof Error ? e.message : "Could not create file — run db push?"
    );
  }
}
