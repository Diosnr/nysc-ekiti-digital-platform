import { prisma } from "@/lib/db";
import { requireAuth, jsonOk, jsonError } from "@/lib/api";
import { loadUserAuthContext } from "@/lib/auth-server";
import { isLinePlatoonOfficer } from "@/lib/scope";
import { isValidStateCode } from "@/lib/state-code";

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
  const kind = (url.searchParams.get("kind") || "").trim().toLowerCase();
  const cursor = (url.searchParams.get("cursor") || "").trim() || undefined;
  const limit = Math.min(50, Math.max(10, Number(url.searchParams.get("limit")) || 30));

  const filters: Record<string, unknown>[] = [];

  const isLinePlatoon =
    ctx && isLinePlatoonOfficer(ctx.roles, ctx.permissions);

  if (isLinePlatoon) {
    if (!ctx.user.platoonCode) {
      return jsonOk({ pcms: [], nextCursor: null, hasMore: false });
    }
    filters.push({ platoonCode: ctx.user.platoonCode });
  }

  /**
   * CM = formal state code e.g. EK/26B/0367 (must contain "/" path segments).
   * PCM = null/empty OR junk values like "Ekiti" (no valid code pattern).
   * DB filter approximates pattern; we post-filter with isValidStateCode.
   */
  if (kind === "cm") {
    filters.push({ stateCode: { not: null } });
    filters.push({ NOT: { stateCode: "" } });
    filters.push({ stateCode: { contains: "/" } });
  } else if (kind === "pcm") {
    filters.push({
      OR: [
        { stateCode: null },
        { stateCode: "" },
        // names / junk without slash path → treat as PCM
        { NOT: { stateCode: { contains: "/" } } },
      ],
    });
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

  // Over-fetch slightly so post-filter still fills a page for CM
  const take = kind === "cm" || kind === "pcm" ? limit + 20 : limit + 1;

  const rows = await prisma.pcm.findMany({
    where,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: take + 1,
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
      course: true,
      status: true,
      deploymentState: true,
      photographUrl: true,
      campAddress: true,
      dateReporting: true,
      batchYear: true,
      stream: true,
      originState: true,
      stateCode: true,
      platoonCode: true,
      ppaName: true,
      ppaAddress: true,
      kitIssuedAt: true,
      kitIssuedByName: true,
      campExitGrantedAt: true,
      exitReason: true,
      exitDestinationState: true,
      exitDestinationLga: true,
      expectedReturnAt: true,
      checkedOutAt: true,
      createdAt: true,
    },
  });

  let filtered = rows;
  if (kind === "cm") {
    filtered = rows.filter((p) => isValidStateCode(p.stateCode));
  } else if (kind === "pcm") {
    filtered = rows.filter((p) => !isValidStateCode(p.stateCode));
  }

  const hasMore = filtered.length > limit;
  const page = hasMore ? filtered.slice(0, limit) : filtered;
  const nextCursor = hasMore ? page[page.length - 1]?.id ?? null : null;

  return jsonOk({ pcms: page, nextCursor, hasMore, limit, kind: kind || "all" });
}
