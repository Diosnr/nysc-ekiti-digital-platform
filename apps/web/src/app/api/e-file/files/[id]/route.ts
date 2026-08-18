import { prisma } from "@/lib/db";
import { requireAuth, jsonOk, jsonError, clientMeta } from "@/lib/api";
import { writeAudit } from "@/lib/audit";
import { canAccessExitDesk } from "@/lib/exit-workflow";

type Params = { params: Promise<{ id: string }> };

const OPEN_STATUSES = ["DRAFT", "IN_TRANSIT", "PENDING"] as const;

function canActOnFile(
  file: { currentHolderId: string | null; openedById: string | null; status: string },
  userId: string,
  roles: string[],
  permissions: string[]
) {
  if (permissions.includes("*") || permissions.includes("file:forward")) return true;
  if (roles.some((r) => r.toLowerCase() === "super admin")) return true;
  if (!OPEN_STATUSES.includes(file.status as (typeof OPEN_STATUSES)[number])) return false;
  if (file.currentHolderId && file.currentHolderId === userId) return true;
  // Unassigned pending files: opener or anyone on exit desk can pick up
  if (!file.currentHolderId && canAccessExitDesk(roles, permissions)) return true;
  return false;
}

function parseAttachments(json: string | null): string[] {
  if (!json) return [];
  try {
    const v = JSON.parse(json);
    return Array.isArray(v) ? v.map(String) : [];
  } catch {
    return [];
  }
}

export async function GET(req: Request, { params }: Params) {
  const auth = await requireAuth(req);
  if (auth instanceof Response) return auth;
  if (!canAccessExitDesk(auth.payload.roles, auth.payload.permissions)) {
    return jsonError("Forbidden", 403);
  }

  const { id } = await params;

  try {
    const file = await prisma.electronicFile.findUnique({
      where: { id },
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
            gender: true,
            stream: true,
            originState: true,
            course: true,
            ppaName: true,
            status: true,
          },
        },
        minutes: {
          orderBy: { createdAt: "asc" },
          select: {
            id: true,
            fromName: true,
            toName: true,
            ccJson: true,
            body: true,
            action: true,
            createdAt: true,
            attachmentUrlsJson: true,
            includePcmProfile: true,
          },
        },
      },
    });
    if (!file) return jsonError("Not found", 404);

    // Camp-exit dual-write files should be handled via exit-requests API
    if (file.type === "CAMP_EXIT" && file.exitRequestId) {
      return jsonError("Use exit request endpoint for camp-exit files", 400);
    }

    return jsonOk({
      file: {
        id: file.id,
        kind: "efile",
        type: file.type,
        subject: file.subject,
        priority: file.priority,
        status: file.status,
        groundCode: file.groundCode,
        openedById: file.openedById,
        openedByName: file.openedByName,
        currentHolderId: file.currentHolderId,
        currentHolderName: file.currentHolderName,
        createdAt: file.createdAt,
        updatedAt: file.updatedAt,
        canAct: canActOnFile(
          file,
          auth.payload.sub,
          auth.payload.roles,
          auth.payload.permissions
        ),
        pcm: file.pcm,
        minutes: file.minutes.map((m) => ({
          id: m.id,
          fromName: m.fromName,
          toName: m.toName,
          cc: m.ccJson
            ? (() => {
                try {
                  return JSON.parse(m.ccJson!);
                } catch {
                  return [];
                }
              })()
            : [],
          body: m.body,
          action: m.action,
          createdAt: m.createdAt,
          attachments: parseAttachments(m.attachmentUrlsJson),
          includePcmProfile: Boolean(
            (m as { includePcmProfile?: boolean }).includePcmProfile
          ),
        })),
      },
    });
  } catch (e) {
    return jsonError(e instanceof Error ? e.message : "Failed to load file");
  }
}

export async function PATCH(req: Request, { params }: Params) {
  const auth = await requireAuth(req);
  if (auth instanceof Response) return auth;
  if (!canAccessExitDesk(auth.payload.roles, auth.payload.permissions)) {
    return jsonError("Forbidden", 403);
  }

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const decision = String(body.decision ?? "").toLowerCase();
  const note = body.note ? String(body.note).trim() : "";
  const includePcmProfile = Boolean(body.includePcmProfile);
  const nextToUserId = body.nextToUserId ? String(body.nextToUserId) : null;
  const nextToUserIds: string[] = Array.isArray(body.nextToUserIds)
    ? body.nextToUserIds.map(String).filter(Boolean)
    : nextToUserId
      ? [nextToUserId]
      : [];

  if (!["forward", "return", "approve", "reject"].includes(decision)) {
    return jsonError("decision must be forward, return, approve or reject");
  }

  const file = await prisma.electronicFile.findUnique({ where: { id } });
  if (!file) return jsonError("Not found", 404);
  if (file.type === "CAMP_EXIT" && file.exitRequestId) {
    return jsonError("Use exit request endpoint for camp-exit files", 400);
  }
  if (!["DRAFT", "IN_TRANSIT", "PENDING"].includes(file.status)) {
    return jsonError("File already closed", 400);
  }
  if (
    !canActOnFile(
      file,
      auth.payload.sub,
      auth.payload.roles,
      auth.payload.permissions
    )
  ) {
    return jsonError("Not your turn to act on this file", 403);
  }

  const actor = await prisma.user.findUnique({
    where: { id: auth.payload.sub },
    select: { name: true, email: true },
  });
  const actorName = actor?.name?.trim() || actor?.email || auth.payload.email;

  // Resolve recipients
  const uniqueIds = [...new Set(nextToUserIds)];
  let primaryId: string | null = null;
  let primaryName: string | null = null;
  const ccList: { id: string; name: string }[] = [];

  if (uniqueIds.length && (decision === "forward" || decision === "return")) {
    const users = await prisma.user.findMany({
      where: { id: { in: uniqueIds }, isActive: true },
      select: { id: true, name: true, email: true },
    });
    const byId = new Map(users.map((u) => [u.id, u]));
    for (const uid of uniqueIds) {
      const u = byId.get(uid);
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

  // Return defaults to opener if no recipient picked
  if (decision === "return" && !primaryId && file.openedById) {
    primaryId = file.openedById;
    primaryName = file.openedByName;
  }

  let newStatus: "IN_TRANSIT" | "PENDING" | "APPROVED" | "RETURNED" | "REJECTED" | "CLOSED" =
    "IN_TRANSIT";
  let action: "FORWARD" | "RETURN" | "REJECT" | "RECOMMEND" | "APPROVE" = "FORWARD";
  let holderId: string | null = primaryId;
  let holderName: string | null = primaryName;

  if (decision === "forward") {
    if (!primaryId) return jsonError("Select at least one officer to forward to");
    newStatus = "IN_TRANSIT";
    action = "FORWARD";
  } else if (decision === "return") {
    newStatus = "RETURNED";
    action = "RETURN";
    // Keep open for rework: status RETURNED but allow re-open? Domain uses RETURNED as terminal-ish.
    // For operational flow: return to opener as PENDING so they can re-forward.
    if (primaryId) {
      newStatus = "PENDING";
      action = "RETURN";
    }
  } else if (decision === "approve") {
    newStatus = "APPROVED";
    action = "APPROVE";
    holderId = null;
    holderName = null;
  } else if (decision === "reject") {
    newStatus = "REJECTED";
    action = "REJECT";
    holderId = null;
    holderName = null;
  }

  const minuteBody =
    note ||
    (decision === "approve"
      ? "Approved and closed."
      : decision === "reject"
        ? "Rejected / not recommended."
        : decision === "return"
          ? "Returned for further action."
          : `Forwarded to ${primaryName || "next officer"}.`);

  const updated = await prisma.electronicFile.update({
    where: { id },
    data: {
      status: newStatus,
      currentHolderId: holderId,
      currentHolderName: holderName,
      minutes: {
        create: {
          fromUserId: auth.payload.sub,
          fromName: actorName,
          toUserId: holderId,
          toName: holderName,
          ccJson: ccList.length ? JSON.stringify(ccList) : null,
          body: minuteBody,
          action,
          includePcmProfile:
            decision === "forward" || decision === "return"
              ? includePcmProfile
              : false,
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
    action: `efile.${decision}`,
    entityType: "ElectronicFile",
    entityId: id,
    pcmId: file.pcmId,
    after: {
      decision,
      status: newStatus,
      holderName,
      note: note || null,
      cc: ccList.map((c) => c.name),
    },
    ip: meta.ip,
    userAgent: meta.userAgent,
  });

  return jsonOk({ file: updated });
}
