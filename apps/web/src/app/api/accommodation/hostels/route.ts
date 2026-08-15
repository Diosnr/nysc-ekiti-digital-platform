import { prisma } from "@/lib/db";
import { requireAuth, jsonOk, jsonError, clientMeta } from "@/lib/api";
import { writeAudit } from "@/lib/audit";

function canRead(roles: string[], permissions: string[]) {
  if (permissions.includes("*") || permissions.includes("accommodation:read") || permissions.includes("hostel:manage")) {
    return true;
  }
  return roles.some((r) => r.toLowerCase().includes("accommodation"));
}

function canManage(roles: string[], permissions: string[]) {
  if (permissions.includes("*") || permissions.includes("hostel:manage")) return true;
  return roles.some((r) => r.toLowerCase().includes("accommodation"));
}

export async function GET(req: Request) {
  const auth = await requireAuth(req);
  if (auth instanceof Response) return auth;
  if (!canRead(auth.payload.roles, auth.payload.permissions)) {
    return jsonError("Forbidden", 403);
  }

  const hostels = await prisma.hostel.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: {
      beds: {
        orderBy: { code: "asc" },
        include: {
          currentPcm: {
            select: {
              id: true,
              fullName: true,
              callUpNumber: true,
              gender: true,
              photographUrl: true,
              stateCode: true,
            },
          },
        },
      },
    },
  });

  const summary = {
    hostels: hostels.length,
    beds: 0,
    vacant: 0,
    occupied: 0,
    blocked: 0,
  };
  for (const h of hostels) {
    for (const b of h.beds) {
      summary.beds += 1;
      if (b.status === "VACANT") summary.vacant += 1;
      else if (b.status === "OCCUPIED") summary.occupied += 1;
      else summary.blocked += 1;
    }
  }

  return jsonOk({
    summary,
    hostels: hostels.map((h) => ({
      id: h.id,
      name: h.name,
      genderRestriction: h.genderRestriction,
      capacity: h.capacity,
      isActive: h.isActive,
      notes: h.notes,
      sortOrder: h.sortOrder,
      bedCount: h.beds.length,
      vacant: h.beds.filter((b) => b.status === "VACANT").length,
      occupied: h.beds.filter((b) => b.status === "OCCUPIED").length,
      blocked: h.beds.filter((b) => b.status === "BLOCKED").length,
      beds: h.beds.map((b) => ({
        id: b.id,
        code: b.code,
        status: b.status,
        assignedAt: b.assignedAt,
        assignedByName: b.assignedByName,
        note: b.note,
        pcm: b.currentPcm,
      })),
    })),
  });
}

export async function POST(req: Request) {
  const auth = await requireAuth(req);
  if (auth instanceof Response) return auth;
  if (!canManage(auth.payload.roles, auth.payload.permissions)) {
    return jsonError("Forbidden", 403);
  }

  const body = await req.json();
  const name = String(body.name ?? "").trim();
  const capacity = Math.max(1, Math.min(500, Number(body.capacity) || 0));
  const genderRestriction = ["MALE", "FEMALE", "MIXED"].includes(
    String(body.genderRestriction ?? "").toUpperCase()
  )
    ? (String(body.genderRestriction).toUpperCase() as "MALE" | "FEMALE" | "MIXED")
    : "MIXED";
  const notes = body.notes ? String(body.notes).trim() : null;
  const createBeds = body.createBeds !== false;
  const bedPrefix = String(body.bedPrefix ?? "B").trim() || "B";

  if (!name) return jsonError("Hostel name required");
  if (!capacity) return jsonError("Capacity must be at least 1");

  try {
    const hostel = await prisma.hostel.create({
      data: {
        name,
        capacity,
        genderRestriction,
        notes,
        beds: createBeds
          ? {
              create: Array.from({ length: capacity }, (_, i) => ({
                code: `${bedPrefix}${String(i + 1).padStart(3, "0")}`,
                status: "VACANT" as const,
              })),
            }
          : undefined,
      },
      include: { beds: true },
    });

    const meta = clientMeta(req);
    await writeAudit({
      actorId: auth.payload.sub,
      actorEmail: auth.payload.email,
      actorRoleAtTime: auth.payload.roles.join(","),
      action: "hostel.create",
      entityType: "Hostel",
      entityId: hostel.id,
      after: { name, capacity, genderRestriction, beds: hostel.beds.length },
      ip: meta.ip,
      userAgent: meta.userAgent,
    });

    return jsonOk({ hostel }, 201);
  } catch (e) {
    return jsonError(e instanceof Error ? e.message : "Could not create hostel");
  }
}
