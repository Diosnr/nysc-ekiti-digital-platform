import { prisma } from "@/lib/db";
import { requireAuth, jsonOk, jsonError } from "@/lib/api";
import { loadUserAuthContext } from "@/lib/auth-server";
import { isLinePlatoonOfficer } from "@/lib/scope";

function canIssueKit(roles: string[], permissions: string[]) {
  if (permissions.includes("*") || permissions.includes("kit:issue")) return true;
  return roles.some((r) => r.toLowerCase().includes("platoon"));
}

/** Kit coverage snapshot + optional not-issued list */
export async function GET(req: Request) {
  const auth = await requireAuth(req);
  if (auth instanceof Response) return auth;
  if (!canIssueKit(auth.payload.roles, auth.payload.permissions)) {
    return jsonError("Forbidden", 403);
  }

  const url = new URL(req.url);
  const platoon = url.searchParams.get("platoon")?.trim() || "";
  const listMissing = url.searchParams.get("missing") === "1";
  const q = url.searchParams.get("q")?.trim() || "";

  const baseWhere: Record<string, unknown> = {
    status: {
      notIn: ["CHECKED_OUT", "CAMP_EXITED", "CLEARED", "COMPLETED"],
    },
  };
  const ctx = await loadUserAuthContext(auth.payload.sub);
  const lineOfficer = isLinePlatoonOfficer(
    auth.payload.roles,
    auth.payload.permissions
  );
  const scopedPlatoon = lineOfficer ? ctx?.user.platoonCode ?? "__none__" : platoon;
  if (scopedPlatoon) baseWhere.platoonCode = scopedPlatoon;

  const [issued, notIssued, withPlatoonNoKit, totalActive] = await Promise.all([
    prisma.pcm.count({
      where: { ...baseWhere, kitIssuedAt: { not: null } },
    }),
    prisma.pcm.count({
      where: { ...baseWhere, kitIssuedAt: null },
    }),
    prisma.pcm.count({
      where: {
        ...baseWhere,
        kitIssuedAt: null,
        platoonCode: { not: null },
      },
    }),
    prisma.pcm.count({ where: baseWhere }),
  ]);

  let missing: Array<{
    id: string;
    fullName: string;
    callUpNumber: string;
    stateCode: string | null;
    platoonCode: string | null;
    photographUrl: string | null;
    status: string;
  }> = [];

  if (listMissing) {
    const where: Record<string, unknown> = {
      ...baseWhere,
      kitIssuedAt: null,
    };
    if (q) {
      where.OR = [
        { fullName: { contains: q, mode: "insensitive" } },
        { callUpNumber: { contains: q, mode: "insensitive" } },
        { stateCode: { contains: q, mode: "insensitive" } },
      ];
    }
    missing = await prisma.pcm.findMany({
      where,
      orderBy: [{ platoonCode: "asc" }, { fullName: "asc" }],
      take: 80,
      select: {
        id: true,
        fullName: true,
        callUpNumber: true,
        stateCode: true,
        platoonCode: true,
        photographUrl: true,
        status: true,
      },
    });
  }

  const platoonCounts = await prisma.pcm.groupBy({
    by: ["platoonCode"],
    where: {
      ...baseWhere,
      platoonCode: { not: null },
    },
    _count: { id: true },
  });

  // Issued per platoon
  const issuedByPlatoon = await prisma.pcm.groupBy({
    by: ["platoonCode"],
    where: {
      ...baseWhere,
      platoonCode: { not: null },
      kitIssuedAt: { not: null },
    },
    _count: { id: true },
  });
  const issuedMap = new Map(
    issuedByPlatoon.map((r) => [r.platoonCode, r._count.id])
  );

  return jsonOk({
    summary: {
      totalActive,
      issued,
      notIssued,
      withPlatoonNoKit,
      coveragePct: totalActive ? Math.round((issued / totalActive) * 100) : 0,
    },
    platoons: platoonCounts
      .filter((p) => p.platoonCode)
      .map((p) => ({
        code: p.platoonCode!,
        total: p._count.id,
        issued: issuedMap.get(p.platoonCode) ?? 0,
        missing: p._count.id - (issuedMap.get(p.platoonCode) ?? 0),
      }))
      .sort((a, b) => a.code.localeCompare(b.code)),
    missing,
  });
}
