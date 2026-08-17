import { prisma } from "@/lib/db";
import { requireAnyAuth, jsonOk, jsonError } from "@/lib/api";

const IN_CAMP_STATUSES = [
  "CHECKED_IN",
  "CAMP_ACTIVE",
  "ACCOMMODATED",
  "PLATOON_ASSIGNED",
  "KIT_ISSUED",
  "BANK_REGISTERED",
  "CAMP_EXIT_REQUESTED",
] as const;

const OUT_STATUSES = ["CHECKED_OUT", "CAMP_EXITED"] as const;

type ListType = "checked-in" | "checked-out" | "pending-exit";

function whereFor(type: ListType) {
  if (type === "checked-in") {
    return { status: { in: [...IN_CAMP_STATUSES] } };
  }
  if (type === "checked-out") {
    return { status: { in: [...OUT_STATUSES] } };
  }
  return {
    campExitGrantedAt: { not: null },
    status: { notIn: [...OUT_STATUSES] },
  };
}

function csvEscape(v: unknown): string {
  const s = v == null ? "" : String(v);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function toCsv(headers: string[], rows: Record<string, unknown>[]) {
  const lines = [headers.join(",")];
  for (const row of rows) {
    lines.push(headers.map((h) => csvEscape(row[h])).join(","));
  }
  return lines.join("\n");
}

export async function GET(req: Request) {
  const auth = await requireAnyAuth(req, ["security:checkin", "pcm:read"]);
  if (auth instanceof Response) return auth;

  const url = new URL(req.url);
  const type = (url.searchParams.get("type") || "").trim() as ListType;
  if (!["checked-in", "checked-out", "pending-exit"].includes(type)) {
    return jsonError("type must be checked-in, checked-out, or pending-exit");
  }

  const format = (url.searchParams.get("format") || "json").toLowerCase();
  const q = (url.searchParams.get("q") || "").trim();
  const cursor = (url.searchParams.get("cursor") || "").trim() || undefined;
  const limit = Math.min(
    100,
    Math.max(10, Number(url.searchParams.get("limit")) || 50)
  );

  const baseWhere = whereFor(type);
  const filters: Record<string, unknown>[] = [baseWhere];
  if (q) {
    filters.push({
      OR: [
        { callUpNumber: { contains: q, mode: "insensitive" } },
        { fullName: { contains: q, mode: "insensitive" } },
        { stateCode: { contains: q, mode: "insensitive" } },
      ],
    });
  }
  const where = { AND: filters };

  const select = {
    id: true,
    callUpNumber: true,
    fullName: true,
    gender: true,
    institution: true,
    status: true,
    deploymentState: true,
    stateCode: true,
    photographUrl: true,
    dateReporting: true,
    campExitGrantedAt: true,
    exitReason: true,
    exitDestinationState: true,
    exitDestinationLga: true,
    expectedReturnAt: true,
    checkedOutAt: true,
    createdAt: true,
  } as const;

  if (format === "csv") {
    const rows = await prisma.pcm.findMany({
      where,
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      select,
    });

    const headers = [
      "callUpNumber",
      "fullName",
      "gender",
      "institution",
      "status",
      "deploymentState",
      "stateCode",
      "dateReporting",
      "campExitGrantedAt",
      "exitReason",
      "exitDestinationState",
      "exitDestinationLga",
      "expectedReturnAt",
      "checkedOutAt",
    ];

    const csv = toCsv(
      headers,
      rows.map((r) => ({
        callUpNumber: r.callUpNumber,
        fullName: r.fullName,
        gender: r.gender,
        institution: r.institution,
        status: r.status,
        deploymentState: r.deploymentState,
        stateCode: r.stateCode,
        dateReporting: r.dateReporting,
        campExitGrantedAt: r.campExitGrantedAt?.toISOString() ?? "",
        exitReason: r.exitReason,
        exitDestinationState: r.exitDestinationState,
        exitDestinationLga: r.exitDestinationLga,
        expectedReturnAt: r.expectedReturnAt?.toISOString() ?? "",
        checkedOutAt: r.checkedOutAt?.toISOString() ?? "",
      }))
    );

    const filename =
      type === "checked-in"
        ? "security-checked-in.csv"
        : type === "checked-out"
          ? "security-checked-out.csv"
          : "security-pending-exit.csv";

    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  }

  const rows = await prisma.pcm.findMany({
    where,
    orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
    take: limit + 1,
    ...(cursor
      ? {
          cursor: { id: cursor },
          skip: 1,
        }
      : {}),
    select,
  });

  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  const nextCursor = hasMore ? page[page.length - 1]?.id ?? null : null;

  return jsonOk({
    type,
    pcms: page,
    nextCursor,
    hasMore,
    limit,
  });
}
