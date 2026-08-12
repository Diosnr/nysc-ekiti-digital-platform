import { prisma } from "@/lib/db";
import { requireAuth, jsonOk, jsonError, clientMeta } from "@/lib/api";
import { loadUserAuthContext } from "@/lib/auth-server";
import { resolveGeoScope, pcmScopeWhere } from "@/lib/scope";

/** GET /api/pcm?q=&callUp=  — search with LGA/zone scope */
export async function GET(req: Request) {
  const auth = await requireAuth(req, "pcm:read");
  if (auth instanceof Response) {
    const alt = await requireAuth(req, "pcm:search");
    if (alt instanceof Response) return auth;
  }
  const gate =
    auth instanceof Response ? await requireAuth(req, "pcm:search") : auth;
  if (gate instanceof Response) return gate;

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
              ],
            }
          : {},
      ],
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return jsonOk({ pcms, scope });
}
