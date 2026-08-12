import { prisma } from "@/lib/db";
import { requireAuth, jsonOk, jsonError } from "@/lib/api";
import { loadUserAuthContext } from "@/lib/auth-server";
import { resolveGeoScope, pcmScopeWhere } from "@/lib/scope";

type Params = { params: Promise<{ id: string }> };

export async function GET(req: Request, { params }: Params) {
  const auth = await requireAuth(req, "pcm:read");
  if (auth instanceof Response) return auth;

  const { id } = await params;
  const ctx = await loadUserAuthContext(auth.payload.sub);
  const scope = resolveGeoScope(auth.payload, {
    lgaCode: ctx?.user.lgaCode,
    zoneCode: ctx?.user.zoneCode,
  });

  const pcm = await prisma.pcm.findFirst({
    where: {
      AND: [{ id }, pcmScopeWhere(scope)],
    },
    include: { verifications: { orderBy: { verifiedAt: "desc" }, take: 5 } },
  });

  if (!pcm) return jsonError("PCM not found", 404);
  return jsonOk({ pcm });
}
