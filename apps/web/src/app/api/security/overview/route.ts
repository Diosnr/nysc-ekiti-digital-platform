import { prisma } from "@/lib/db";
import { requireAnyAuth, jsonOk } from "@/lib/api";

/** Statuses that mean the member is still inside camp (present). */
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

export async function GET(req: Request) {
  const auth = await requireAnyAuth(req, ["security:checkin", "pcm:read"]);
  if (auth instanceof Response) return auth;

  const [checkedIn, checkedOut, pendingExit] = await Promise.all([
    prisma.pcm.count({
      where: { status: { in: [...IN_CAMP_STATUSES] } },
    }),
    prisma.pcm.count({
      where: { status: { in: [...OUT_STATUSES] } },
    }),
    prisma.pcm.count({
      where: {
        campExitGrantedAt: { not: null },
        status: { notIn: [...OUT_STATUSES] },
      },
    }),
  ]);

  return jsonOk({
    generatedAt: new Date().toISOString(),
    checkedIn,
    checkedOut,
    pendingExit,
  });
}
