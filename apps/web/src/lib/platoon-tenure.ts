import { prisma } from "@/lib/db";

/**
 * Set officer's current platoon and close previous open tenure for audit.
 * Platoon codes: "1"…"10".
 */
export async function setOfficerPlatoon(opts: {
  userId: string;
  officerName: string;
  platoonCode: string | null;
  assignedById?: string;
  assignedByName?: string;
  note?: string;
}) {
  const code = opts.platoonCode?.trim() || null;

  await prisma.platoonOfficerTenure.updateMany({
    where: { userId: opts.userId, endedAt: null },
    data: { endedAt: new Date() },
  });

  await prisma.user.update({
    where: { id: opts.userId },
    data: { platoonCode: code },
  });

  if (code) {
    await prisma.platoonOfficerTenure.create({
      data: {
        userId: opts.userId,
        platoonCode: code,
        officerName: opts.officerName,
        assignedById: opts.assignedById,
        assignedByName: opts.assignedByName,
        note: opts.note,
      },
    });
  }
}

export function isPlatoonOfficerRole(roleNames: string[]): boolean {
  return roleNames.some((r) => {
    const x = r.toLowerCase();
    return x.includes("platoon officer") || x === "platoon";
  });
}
