import { prisma } from "@/lib/db";
import { requireAuth, jsonError } from "@/lib/api";

function csvEscape(v: unknown): string {
  const s = v == null ? "" : String(v);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
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
  const auth = await requireAuth(req, "registration:complete");
  if (auth instanceof Response) return auth;

  const type = new URL(req.url).searchParams.get("type") || "skills";

  try {
    if (type === "skills") {
      const rows = await prisma.pcmSkillProfile.findMany({
        orderBy: { createdAt: "desc" },
      });
      const csv = toCsv(
        ["callUpNumber", "fullName", "skill1", "skill2", "skill3", "createdAt"],
        rows.map((r) => ({
          callUpNumber: r.callUpNumber,
          fullName: r.fullName,
          skill1: r.skill1,
          skill2: r.skill2,
          skill3: r.skill3,
          createdAt: r.createdAt.toISOString(),
        }))
      );
      return new Response(csv, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": 'attachment; filename="skilled-corps-members.csv"',
        },
      });
    }

    if (type === "special-status" || type === "married") {
      const rows = await prisma.pcmFamilyStatus.findMany({
        orderBy: { createdAt: "desc" },
      });
      const csv = toCsv(
        [
          "callUpNumber",
          "fullName",
          "statuses",
          "husbandName",
          "address",
          "state",
          "lga",
          "community",
          "phone",
          "createdAt",
        ],
        rows.map((r) => ({
          callUpNumber: r.callUpNumber,
          fullName: r.fullName,
          statuses: r.statusesJson,
          husbandName: r.husbandName,
          address: r.address,
          state: r.state,
          lga: r.lga,
          community: r.community,
          phone: r.phone,
          createdAt: r.createdAt.toISOString(),
        }))
      );
      return new Response(csv, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition":
            'attachment; filename="special-status-corps-members.csv"',
        },
      });
    }

    return jsonError("Unknown export type. Use skills or special-status");
  } catch (e) {
    console.error(e);
    return jsonError(e instanceof Error ? e.message : "Export failed", 500);
  }
}
