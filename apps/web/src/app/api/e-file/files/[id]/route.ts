import { prisma } from "@/lib/db";
import { requireAuth, jsonOk, jsonError, clientMeta } from "@/lib/api";
import { writeAudit } from "@/lib/audit";
import { canAccessExitDesk } from "@/lib/exit-workflow";

type Params = { params: Promise<{ id: string }> };

type MinuteAction = "DRAFT" | "FORWARD" | "RETURN" | "REJECT" | "RECOMMEND" | "APPROVE";

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
          },
        },
        minutes: {
          orderBy: { createdAt: "asc" },
          select: {
            id: true,
            fromName: true,
            toName: true,
            body: true,
            action: true,
            createdAt: true,
            attachmentUrlsJson: true,
          },
        },
      },
    });
    if (!file) return jsonError("Not found", 404);

    return jsonOk({
      file: {
        ...file,
        minutes: file.minutes.map((m) => ({
          ...m,
          attachments: m.attachmentUrlsJson
            ? (() => {
                try {
                  const v = JSON.parse(m.attachmentUrlsJson!);
                  return Array.isArray(v) ? v.map(String) : [];
                } catch {
                  return [];
                }
              })()
            : [],
          attachmentUrlsJson: undefined,
        })),
      },
    });
  } catch {
    return jsonError("Not found", 404);
  }
}

export async function PATCH(req: Request, { params }: Params) {
  const auth = await requireAuth(req);
  if (auth instanceof Response) return auth;
  if (!canAccessExitDesk(auth.payload.roles, auth.payload.permissions)) {
    return jsonError("Forbidden", 403);
  }

  const { id } = await params;
  const body = await req.json();
  const decision = String(body.decision ?? "").toLowerCase();
  const note = body.note ? String(body.note).trim() : "";
  const nextToUserId = body.nextToUserId ? String(body.nextToUserId) : null;

  if (!["forward", "approve", "return", "reject"].includes(decision)) {
    return jsonError("decision must be forward, approve, return, or reject");
  }

  const file = await prisma.electronicFile.findUnique({ where: { id } });
  if (!file) return jsonError("Not found", 404);
  if (["APPROVED", "REJECTED", "CLOSED"].includes(file.status)) {
    return jsonError("File already closed", 400);
  }

  const isSuper =
    auth.payload.permissions.includes("*") ||
    auth.payload.roles.some((r) => r.toLowerCase().includes("super admin"));
  const isHolder = file.currentHolderId === auth.payload.sub;
  const isOpener = file.openedById === auth.payload.sub;
  if (!isSuper && !isHolder && !isOpener) {
    return jsonError("Not assigned to this file", 403);
  }

  const actor = await prisma.user.findUnique({
    where: { id: auth.payload.sub },
    select: { name: true, email: true },
  });
  const actorName = actor?.name?.trim() || actor?.email || auth.payload.email;

  let nextAssigneeId: string | null = null;
  let nextAssigneeName: string | null = null;
  if (nextToUserId && (decision === "forward" || decision === "approve")) {
    const next = await prisma.user.findFirst({
      where: { id: nextToUserId, isActive: true },
      select: { id: true, name: true, email: true },
    });
    if (next) {
      nextAssigneeId = next.id;
      nextAssigneeName = next.name?.trim() || next.email;
    }
  }

  let status = file.status;
  let action: MinuteAction = "FORWARD";
  if (decision === "approve") {
    status = nextAssigneeId ? "IN_TRANSIT" : "APPROVED";
    action = nextAssigneeId ? "RECOMMEND" : "APPROVE";
  } else if (decision === "return") {
    status = "RETURNED";
    action = "RETURN";
    nextAssigneeId = file.openedById;
    nextAssigneeName = file.openedByName;
  } else if (decision === "reject") {
    status = "REJECTED";
    action = "REJECT";
  } else {
    status = "IN_TRANSIT";
    action = "FORWARD";
  }

  const updated = await prisma.electronicFile.update({
    where: { id },
    data: {
      status,
      currentHolderId:
        status === "APPROVED" || status === "REJECTED"
          ? null
          : nextAssigneeId ?? file.currentHolderId,
      currentHolderName:
        status === "APPROVED" || status === "REJECTED"
          ? null
          : nextAssigneeName ?? file.currentHolderName,
    },
  });

  await prisma.minuteSheet.create({
    data: {
      fileId: id,
      fromUserId: auth.payload.sub,
      fromName: actorName,
      toUserId: nextAssigneeId,
      toName: nextAssigneeName,
      body: note || `${action} by ${actorName}`,
      action,
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
    after: { status, nextAssigneeName, note },
    ip: meta.ip,
    userAgent: meta.userAgent,
  });

  return jsonOk({ file: updated });
}
