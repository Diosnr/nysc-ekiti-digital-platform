import { prisma } from "@/lib/db";

type MinuteAction = "DRAFT" | "FORWARD" | "RETURN" | "REJECT" | "RECOMMEND" | "APPROVE";

/** Append a minute to the ElectronicFile linked to a camp exit request (best-effort). */
export async function appendExitMinute(opts: {
  exitRequestId: string;
  pcmId: string;
  fromUserId: string;
  fromName: string;
  toUserId?: string | null;
  toName?: string | null;
  body: string;
  action: MinuteAction;
  attachmentUrls?: string[];
  fileStatus?: "IN_TRANSIT" | "PENDING" | "APPROVED" | "RETURNED" | "REJECTED" | "CLOSED";
}) {
  try {
    let file = await prisma.electronicFile.findFirst({
      where: { exitRequestId: opts.exitRequestId },
    });
    if (!file) {
      file = await prisma.electronicFile.create({
        data: {
          pcmId: opts.pcmId,
          type: "CAMP_EXIT",
          subject: `Camp exit · ${opts.exitRequestId}`,
          priority: "NORMAL",
          status: opts.fileStatus || "IN_TRANSIT",
          exitRequestId: opts.exitRequestId,
          openedById: opts.fromUserId,
          openedByName: opts.fromName,
          currentHolderId: opts.toUserId || null,
          currentHolderName: opts.toName || null,
        },
      });
    } else {
      await prisma.electronicFile.update({
        where: { id: file.id },
        data: {
          status: opts.fileStatus || file.status,
          currentHolderId: opts.toUserId ?? file.currentHolderId,
          currentHolderName: opts.toName ?? file.currentHolderName,
        },
      });
    }

    const minute = await prisma.minuteSheet.create({
      data: {
        fileId: file.id,
        fromUserId: opts.fromUserId,
        fromName: opts.fromName,
        toUserId: opts.toUserId || null,
        toName: opts.toName || null,
        body: opts.body,
        action: opts.action,
        attachmentUrlsJson: opts.attachmentUrls?.length
          ? JSON.stringify(opts.attachmentUrls)
          : null,
      },
    });
    return { fileId: file.id, minuteId: minute.id };
  } catch {
    return null;
  }
}

export async function listMinutesForExit(exitRequestId: string) {
  try {
    const file = await prisma.electronicFile.findFirst({
      where: { exitRequestId },
      select: {
        id: true,
        status: true,
        currentHolderName: true,
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
    if (!file) return null;
    return {
      fileId: file.id,
      status: file.status,
      currentHolderName: file.currentHolderName,
      minutes: file.minutes.map((m) => ({
        id: m.id,
        fromName: m.fromName,
        toName: m.toName,
        body: m.body,
        action: m.action,
        createdAt: m.createdAt,
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
      })),
    };
  } catch {
    return null;
  }
}
