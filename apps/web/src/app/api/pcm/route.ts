import { prisma } from "@/lib/db";
import { requireAnyAuth, jsonOk, jsonError } from "@/lib/api";
import { loadUserAuthContext } from "@/lib/auth-server";
import { resolveGeoScope, pcmScopeWhere } from "@/lib/scope";

/** GET /api/pcm?q= — search with LGA/zone scope */
export async function GET(req: Request) {
  const gate = await requireAnyAuth(req, ["pcm:read", "pcm:search"]);
  if (gate instanceof Response) return gate;

  try {
    const ctx = await loadUserAuthContext(gate.payload.sub);
    const scope = resolveGeoScope(gate.payload, {
      lgaCode: ctx?.user.lgaCode,
      zoneCode: ctx?.user.zoneCode,
    });

    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q")?.trim();
    const callUp = searchParams.get("callUp")?.trim();
    const scopeWhere = pcmScopeWhere(scope);

    const pcms = await prisma.pcm.findMany({
      where: {
        AND: [
          scopeWhere,
          callUp
            ? { callUpNumber: { contains: callUp, mode: "insensitive" } }
            : {},
          q
            ? {
                OR: [
                  { fullName: { contains: q, mode: "insensitive" } },
                  { callUpNumber: { contains: q, mode: "insensitive" } },
                  { stateCode: { contains: q, mode: "insensitive" } },
                  { deploymentState: { contains: q, mode: "insensitive" } },
                ],
              }
            : {},
        ],
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    return jsonOk({ pcms, scope });
  } catch (e) {
    const message = e instanceof Error ? e.message : "PCM list failed";
    console.error("GET /api/pcm", e);
    if (/does not exist|P2021|Unknown arg|Unknown field/i.test(message)) {
      return jsonError(
        "Database schema is out of date. Run: npx prisma db push --schema=packages/database/prisma/schema.prisma (using your Neon DATABASE_URL)",
        503
      );
    }
    if (/P1001|Can't reach/i.test(message)) {
      return jsonError("Cannot reach database. Check DATABASE_URL on Vercel.", 503);
    }
    return jsonError(message, 500);
  }
}
