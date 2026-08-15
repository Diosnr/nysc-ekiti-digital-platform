import { prisma } from "@/lib/db";
import { requireAuth, jsonOk, jsonError, clientMeta } from "@/lib/api";
import { writeAudit } from "@/lib/audit";
import { canAccessExitDesk } from "@/lib/exit-workflow";

const FILE_TYPES = ["CAMP_EXIT", "LEAVE", "RELOCATION", "GENERAL"] as const;

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
  const minute = body.minute ? String(body.minute).trim() : "";
  const priority = String(body.priority ?? "NORMAL").toUpperCase();
  const photoUrls: string[] = Array.isArray(body.photoUrls)
    ? body.photoUrls.map(String).filter(Boolean)
    : [];
  const nextToUserId = body.nextToUserId ? String(body.nextToUserId) : null;
  const ground = body.ground ? String(body.ground).trim().toUpperCase() : null;

  if (!pcmId) return jsonError("pcmId required");
  if (!subject && !minute) return jsonError("Subject or minute required");

  // Camp exit has its own chain — redirect clients to exit-requests API
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

  let nextAssigneeId: string | null = null;
  let nextAssigneeName: string | null = null;
  if (nextToUserId) {
    const next = await prisma.user.findFirst({
      where: { id: nextToUserId, isActive: true },
      select: { id: true, name: true, email: true },
    });
    if (next) {
      nextAssigneeId = next.id;
      nextAssigneeName = next.name?.trim() || next.email;
    }
  }

  try {
    const file = await prisma.electronicFile.create({
      data: {
        pcmId,
        type,
        subject: subject || minute.slice(0, 120) || type,
        priority: priority || "NORMAL",
        status: nextAssigneeId ? "IN_TRANSIT" : "PENDING",
        groundCode: ground,
        openedById: auth.payload.sub,
        openedByName: actorName,
        currentHolderId: nextAssigneeId,
        currentHolderName: nextAssigneeName,
        minutes: {
          create: {
            fromUserId: auth.payload.sub,
            fromName: actorName,
            toUserId: nextAssigneeId,
            toName: nextAssigneeName,
            body: minute || subject || `File opened (${type}).`,
            action: nextAssigneeId ? "FORWARD" : "DRAFT",
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
      after: { type, subject: file.subject, nextAssigneeName },
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
