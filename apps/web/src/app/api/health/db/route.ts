import { prisma } from "@/lib/db";
import { jsonOk, jsonError } from "@/lib/api";

/** Public diagnostic — does not expose secrets */
export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    let pcmTable = false;
    let pcmCount: number | null = null;
    let pcmColumnsOk = false;
    try {
      pcmCount = await prisma.pcm.count();
      pcmTable = true;
      // touch new columns
      await prisma.pcm.findFirst({
        select: {
          id: true,
          deploymentState: true,
          batchYear: true,
          dateReporting: true,
          campAddress: true,
          photographUrl: true,
        },
      });
      pcmColumnsOk = true;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return jsonOk({
        ok: true,
        database: "reachable",
        pcmTable,
        pcmCount,
        pcmColumnsOk: false,
        hint:
          "Run db push against Neon: npx prisma db push --schema=packages/database/prisma/schema.prisma",
        detail: msg.slice(0, 200),
      });
    }
    return jsonOk({
      ok: true,
      database: "reachable",
      pcmTable: true,
      pcmCount,
      pcmColumnsOk: true,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "db error";
    return jsonError("Database not reachable: " + message.slice(0, 150), 503);
  }
}
