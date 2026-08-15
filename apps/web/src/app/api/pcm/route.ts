import { prisma } from "@/lib/db";
import { requireAuth, jsonOk, jsonError } from "@/lib/api";
import { loadUserAuthContext } from "@/lib/auth-server";
import { isPlatoonOfficerRole } from "@/lib/platoon-tenure";

export async function GET(req: Request) {
  const auth = await requireAuth(req);
  if (auth instanceof Response) return auth;

  const can =
    auth.payload.permissions.includes("*") ||
    auth.payload.permissions.includes("pcm:read") ||
    auth.payload.permissions.includes("pcm:search") ||
    auth.payload.roles.some((r) =>
      [
        "Security Officer",
        "Registration Officer",
        "Platoon Officer",
        "Head of Platoon Officers",
        "Bank Account Officer",
      ].includes(r)
    ) ||
    auth.payload.roles.some((r) => r.toLowerCase().includes("platoon"));
  if (!can) return jsonError("Forbidden", 403);

  const ctx = await loadUserAuthContext(auth.payload.sub);
  const url = new URL(req.url);
  const q = (url.searchParams.get("q") || "").trim();
  const callUp = (url.searchParams.get("callUp") || "").trim();
  const cursor = (url.searchParams.get("cursor") || "").trim() || undefined;
  const limit = Math.min(50, Math.max(10, Number(url.searchParams.get("limit")) || 30));

  const filters: Record<string, unknown>[] = [];

  const isLinePlatoon =
    ctx &&
    isPlatoonOfficerRole(ctx.roles) &&
    !ctx.roles.some((r) => r.toLowerCase().includes("head of platoon")) &&
    !ctx.permissions.includes("*");

  if (isLinePlatoon) {
    if (!ctx.user.platoonCode) {
      return jsonOk({ pcms: [], nextCursor: null, hasMore: false });
    }
    filters.push({ platoonCode: ctx.user.platoonCode });
  }

  if (q || callUp) {
    filters.push({
      OR: [
        ...(callUp
          ? [{ callUpNumber: { equals: callUp, mode: "insensitive" as const } }]
          : []),
        ...(q
          ? [
              { callUpNumber: { contains: q, mode: "insensitive" as const } },
              { fullName: { contains: q, mode: "insensitive" as const } },
              { stateCode: { contains: q, mode: "insensitive" as const } },
              { deploymentState: { contains: q, mode: "insensitive" as const } },
            ]
          : []),
      ],
    });
  }

  const where = filters.length ? { AND: filters } : {};

  const pcms = await prisma.pcm.findMany({
    where,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: limit + 1,
    ...(cursor
      ? {
          cursor: { id: cursor },
          skip: 1,
        }
      : {}),
    select: {
      id: true,
      callUpNumber: true,
      fullName: true,
      gender: true,
      institution: true,
      status: true,
      deploymentState: true,
      photographUrl: true,
      campAddress: true,
      dateReporting: true,
      batchYear: true,
      stateCode: true,
      platoonCode: true,
      kitIssuedAt: true,
      kitIssuedByName: true,
      createdAt: true,
    },
  });

  const hasMore = pcms.length > limit;
  const page = hasMore ? pcms.slice(0, limit) : pcms;
  const nextCursor = hasMore ? page[page.length - 1]?.id ?? null : null;

  return jsonOk({ pcms: page, nextCursor, hasMore, limit });
}
