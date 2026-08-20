import { prisma } from "@/lib/db";
import { jsonOk, jsonError } from "@/lib/api";
import { getCmBearerPayload } from "@/lib/cm-auth";

/** List electronic files for the logged-in corps member (read-only). */
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
