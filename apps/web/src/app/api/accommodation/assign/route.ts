import { prisma } from "@/lib/db";
import { requireAuth, jsonOk, jsonError, clientMeta } from "@/lib/api";
import { writeAudit } from "@/lib/audit";

function canAssign(roles: string[], permissions: string[]) {
  if (
    permissions.includes("*") ||
    permissions.includes("accommodation:assign") ||
    permissions.includes("accommodation:change") ||
    permissions.includes("hostel:manage")
  ) {
    return true;
  }
  return roles.some((r) => r.toLowerCase().includes("accommodation"));
}

function genderMatches(
  restriction: string,
  gender: string | null | undefined
): boolean {
  if (restriction === "MIXED") return true;
  if (!gender) return false;
  const g = gender.toLowerCase();
  const male = g.startsWith("m") || g === "male";
  const female = g.startsWith("f") || g === "female";
  if (restriction === "MALE") return male;
  if (restriction === "FEMALE") return female;
  return true;
}

/** Assign a vacant bed to a checked-in PCM (or change bed). */
export async function POST(req: Request) {
  const auth = await requireAuth(req);
  if (auth instanceof Response) return auth;
  if (!canAssign(auth.payload.roles, auth.payload.permissions)) {
    return jsonError("Forbidden", 403);
  }

  const body = await req.json();
  const pcmId = String(body.pcmId ?? "");
  const bedId = String(body.bedId ?? "");
  if (!pcmId || !bedId) return jsonError("pcmId and bedId required");

  const pcm = await prisma.pcm.findUnique({
    where: { id: pcmId },
    include: { bed: true },
  });
  if (!pcm) return jsonError("Corps member not found", 404);

  const allowedStatuses = [
    "CHECKED_IN",
    "ACCOMMODATED",
    "REGISTERED",
    "BANK_REGISTERED",
    "PLATOON_ASSIGNED",
    "KIT_ISSUED",
    "CAMP_ACTIVE",
  ];
  if (!allowedStatuses.includes(pcm.status)) {
    return jsonError(
      `Accommodation only after security check-in (current status: ${pcm.status})`,
      400
    );
  }

  const bed = await prisma.bed.findUnique({
    where: { id: bedId },
    include: { hostel: true },
  });
  if (!bed) return jsonError("Bed not found", 404);
  if (!bed.hostel.isActive) return jsonError("Hostel is inactive", 400);
  if (bed.status === "BLOCKED") return jsonError("Bed is blocked", 400);
  if (bed.status === "OCCUPIED" && bed.currentPcmId !== pcmId) {
    return jsonError("Bed is already occupied", 400);
  }

  if (!genderMatches(bed.hostel.genderRestriction, pcm.gender)) {
    return jsonError(
      `Gender mismatch: hostel is ${bed.hostel.genderRestriction}, corps member gender is ${pcm.gender || "unknown"}`,
      400
    );
  }

  const actor = await prisma.user.findUnique({
    where: { id: auth.payload.sub },
    select: { name: true, email: true },
  });
  const actorName = actor?.name?.trim() || actor?.email || auth.payload.email;

  try {
    const result = await prisma.$transaction(async (tx) => {
      // Release previous bed if any
      if (pcm.bed && pcm.bed.id !== bedId) {
        await tx.bed.update({
          where: { id: pcm.bed.id },
          data: {
            status: "VACANT",
            currentPcmId: null,
            assignedAt: null,
            assignedById: null,
            assignedByName: null,
          },
        });
      }

      const updatedBed = await tx.bed.update({
        where: { id: bedId },
        data: {
          status: "OCCUPIED",
          currentPcmId: pcmId,
          assignedAt: new Date(),
          assignedById: auth.payload.sub,
          assignedByName: actorName,
        },
        include: {
          hostel: true,
          currentPcm: {
            select: {
              id: true,
              fullName: true,
              callUpNumber: true,
              gender: true,
              photographUrl: true,
            },
          },
        },
      });

      const updatedPcm = await tx.pcm.update({
        where: { id: pcmId },
        data: {
          status:
            pcm.status === "CHECKED_IN" || pcm.status === "ACCOMMODATED"
              ? "ACCOMMODATED"
              : pcm.status,
        },
      });

      return { bed: updatedBed, pcm: updatedPcm };
    });

    const meta = clientMeta(req);
    await writeAudit({
      actorId: auth.payload.sub,
      actorEmail: auth.payload.email,
      actorRoleAtTime: auth.payload.roles.join(","),
      action: "accommodation.assign",
      entityType: "Bed",
      entityId: bedId,
      pcmId,
      after: {
        hostel: result.bed.hostel.name,
        bed: result.bed.code,
        pcm: pcm.fullName,
      },
      ip: meta.ip,
      userAgent: meta.userAgent,
    });

    return jsonOk({
      bed: {
        id: result.bed.id,
        code: result.bed.code,
        status: result.bed.status,
        hostelName: result.bed.hostel.name,
        pcm: result.bed.currentPcm,
      },
      pcm: {
        id: result.pcm.id,
        status: result.pcm.status,
        fullName: result.pcm.fullName,
      },
    });
  } catch (e) {
    return jsonError(e instanceof Error ? e.message : "Assignment failed");
  }
}

/** Release a bed (vacate). */
export async function DELETE(req: Request) {
  const auth = await requireAuth(req);
  if (auth instanceof Response) return auth;
  if (!canAssign(auth.payload.roles, auth.payload.permissions)) {
    return jsonError("Forbidden", 403);
  }

  const body = await req.json().catch(() => ({}));
  const bedId = String(body.bedId ?? "");
  const pcmId = body.pcmId ? String(body.pcmId) : null;
  if (!bedId && !pcmId) return jsonError("bedId or pcmId required");

  const bed = bedId
    ? await prisma.bed.findUnique({ where: { id: bedId }, include: { hostel: true } })
    : await prisma.bed.findFirst({
        where: { currentPcmId: pcmId! },
        include: { hostel: true },
      });

  if (!bed) return jsonError("Bed assignment not found", 404);

  const releasedPcmId = bed.currentPcmId;

  await prisma.bed.update({
    where: { id: bed.id },
    data: {
      status: "VACANT",
      currentPcmId: null,
      assignedAt: null,
      assignedById: null,
      assignedByName: null,
    },
  });

  // Optionally roll status back only if still ACCOMMODATED
  if (releasedPcmId) {
    const pcm = await prisma.pcm.findUnique({ where: { id: releasedPcmId } });
    if (pcm?.status === "ACCOMMODATED") {
      await prisma.pcm.update({
        where: { id: releasedPcmId },
        data: { status: "CHECKED_IN" },
      });
    }
  }

  const meta = clientMeta(req);
  await writeAudit({
    actorId: auth.payload.sub,
    actorEmail: auth.payload.email,
    actorRoleAtTime: auth.payload.roles.join(","),
    action: "accommodation.release",
    entityType: "Bed",
    entityId: bed.id,
    pcmId: releasedPcmId ?? undefined,
    after: { hostel: bed.hostel.name, bed: bed.code },
    ip: meta.ip,
    userAgent: meta.userAgent,
  });

  return jsonOk({ released: true, bedId: bed.id });
}
