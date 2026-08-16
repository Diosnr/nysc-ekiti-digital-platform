import { prisma } from "@/lib/db";
import { requireAuth, jsonOk, jsonError, clientMeta } from "@/lib/api";
import { writeAudit } from "@/lib/audit";
import { isValidStateCode, normalizeStateCode } from "@/lib/state-code";

/**
 * Super Admin: clear invalid stateCode values (e.g. "Ekiti") so CM/PCM logic is accurate.
 * Valid codes are normalized to uppercase EK/26B/0367 form.
 */
export async function POST(req: Request) {
  const auth = await requireAuth(req);
  if (auth instanceof Response) return auth;

  const isSuper =
    auth.payload.permissions.includes("*") ||
    auth.payload.roles.some((r) => r.toLowerCase() === "super admin");
  if (!isSuper) return jsonError("Super Admin only", 403);

  const rows = await prisma.pcm.findMany({
    where: { stateCode: { not: null } },
    select: { id: true, stateCode: true, callUpNumber: true },
  });

  let cleared = 0;
  let normalized = 0;
  const samples: { callUp: string; before: string; after: string | null }[] =
    [];

  for (const row of rows) {
    const before = row.stateCode || "";
    if (isValidStateCode(before)) {
      const n = normalizeStateCode(before);
      if (n !== before) {
        await prisma.pcm.update({
          where: { id: row.id },
          data: { stateCode: n },
        });
        normalized++;
        if (samples.length < 25) {
          samples.push({
            callUp: row.callUpNumber,
            before,
            after: n,
          });
        }
      }
      continue;
    }
    // Junk / state name → clear (member stays PCM until real code assigned)
    await prisma.pcm.update({
      where: { id: row.id },
      data: { stateCode: null },
    });
    cleared++;
    if (samples.length < 25) {
      samples.push({
        callUp: row.callUpNumber,
        before,
        after: null,
      });
    }
  }

  const meta = clientMeta(req);
  await writeAudit({
    actorId: auth.payload.sub,
    actorEmail: auth.payload.email,
    actorRoleAtTime: auth.payload.roles.join(","),
    action: "admin.cleanup_state_codes",
    entityType: "Pcm",
    after: { cleared, normalized, scanned: rows.length },
    ip: meta.ip,
    userAgent: meta.userAgent,
  });

  return jsonOk({
    scanned: rows.length,
    cleared,
    normalized,
    samples,
    message:
      "Invalid state codes cleared (e.g. Ekiti). Valid codes normalized. Re-run registration import with real codes if needed.",
  });
}
