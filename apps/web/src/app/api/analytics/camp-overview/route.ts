import { prisma } from "@/lib/db";
import { requireAuth, jsonOk, jsonError } from "@/lib/api";
import { isValidStateCode } from "@/lib/state-code";

function isExecutive(roles: string[], permissions: string[]): boolean {
  if (permissions.includes("*")) return true;
  const r = roles.map((x) => x.toLowerCase());
  return r.some(
    (x) =>
      x.includes("super admin") ||
      x.includes("state coordinator") ||
      x.includes("camp director")
  );
}

export async function GET(req: Request) {
  const auth = await requireAuth(req);
  if (auth instanceof Response) return auth;

  if (!isExecutive(auth.payload.roles, auth.payload.permissions)) {
    return jsonError("Forbidden", 403);
  }

  // Load state codes once for accurate CM/PCM (pattern EK/26B/0367, not "Ekiti")
  const codeRows = await prisma.pcm.findMany({
    select: { stateCode: true },
  });
  let cmCount = 0;
  let pcmCount = 0;
  for (const row of codeRows) {
    if (isValidStateCode(row.stateCode)) cmCount++;
    else pcmCount++;
  }

  const [
    totalOnRoll,
    verifiedOrRegistered,
    insideCamp,
    departed,
    exitRequested,
    exitByGround,
    openExits,
    medicalPathTouches,
    clinicStamped,
    specialStatusRows,
    skillRows,
    ninRows,
    officersActive,
  ] = await Promise.all([
    prisma.pcm.count(),
    prisma.pcm.count({
      where: { status: { in: ["VERIFIED", "REGISTERED", "MOBILISED"] } },
    }),
    prisma.pcm.count({
      where: {
        status: {
          in: [
            "CHECKED_IN",
            "CAMP_ACTIVE",
            "ACCOMMODATED",
            "PLATOON_ASSIGNED",
            "KIT_ISSUED",
            "BANK_REGISTERED",
            "CAMP_EXIT_REQUESTED",
          ],
        },
      },
    }),
    prisma.pcm.count({
      where: { status: { in: ["CHECKED_OUT", "CAMP_EXITED"] } },
    }),
    prisma.pcm.count({ where: { status: "CAMP_EXIT_REQUESTED" } }),
    prisma.campExitRequest.groupBy({
      by: ["ground"],
      where: { stage: "APPROVED" },
      _count: { _all: true },
    }),
    prisma.campExitRequest.count({
      where: {
        stage: {
          in: [
            "AWAITING_CLINIC",
            "AWAITING_CAMP_DIRECTOR",
            "AWAITING_STATE_COORDINATOR",
          ],
        },
      },
    }),
    prisma.campExitRequest.count({
      where: { ground: "MEDICAL" },
    }),
    prisma.campExitRequest.count({
      where: { clinicByName: { not: null } },
    }),
    prisma.pcmFamilyStatus.count(),
    prisma.pcmSkillProfile.count(),
    prisma.pcmNinRecord.count(),
    prisma.user.count({ where: { isActive: true } }),
  ]);

  const grounds = { MARITAL: 0, MEDICAL: 0, TERRORISM: 0 };
  for (const g of exitByGround) {
    if (g.ground in grounds) {
      grounds[g.ground as keyof typeof grounds] = g._count._all;
    }
  }

  return jsonOk({
    generatedAt: new Date().toISOString(),
    strength: {
      onRoll: totalOnRoll,
      corpsMembers: cmCount,
      prospectiveCorpsMembers: pcmCount,
      intakeComplete: verifiedOrRegistered,
      presentInCamp: insideCamp,
      departed,
      exitInFlight: exitRequested,
    },
    departures: {
      approvedTotal: grounds.MARITAL + grounds.MEDICAL + grounds.TERRORISM,
      byGround: grounds,
      awaitingDecision: openExits,
    },
    welfare: {
      medicalExitCases: medicalPathTouches,
      clinicReviewsCompleted: clinicStamped,
      specialStatusFilings: specialStatusRows,
      skillProfiles: skillRows,
      ninUploads: ninRows,
    },
    operations: {
      activeOfficers: officersActive,
    },
  });
}
