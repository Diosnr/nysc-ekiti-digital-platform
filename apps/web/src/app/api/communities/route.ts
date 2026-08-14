import { prisma } from "@/lib/db";
import { requireAuth, jsonOk, jsonError, clientMeta } from "@/lib/api";
import { writeAudit } from "@/lib/audit";

/** Public list of active communities (for form dropdowns). */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const all = searchParams.get("all") === "1";
  const state = searchParams.get("state")?.trim();
  const lga = searchParams.get("lga")?.trim();

  if (all) {
    const auth = await requireAuth(req, "community:manage");
    if (auth instanceof Response) return auth;
    const rows = await prisma.community.findMany({
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    });
    return jsonOk({ communities: rows });
  }

  const rows = await prisma.community.findMany({
    where: {
      isActive: true,
      ...(state ? { state } : {}),
      ...(lga ? { lga } : {}),
    },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: { id: true, name: true, lga: true, state: true },
  });
  return jsonOk({ communities: rows });
}

export async function POST(req: Request) {
  const auth = await requireAuth(req, "community:manage");
  if (auth instanceof Response) return auth;

  try {
    const body = await req.json();
    const name = String(body.name ?? "").trim();
    if (!name) return jsonError("name is required");

    const row = await prisma.community.create({
      data: {
        name,
        lga: body.lga ? String(body.lga).trim() : null,
        state: body.state ? String(body.state).trim() : "Ekiti",
        isActive: body.isActive !== false,
        sortOrder: Number.isFinite(Number(body.sortOrder))
          ? Number(body.sortOrder)
          : 0,
      },
    });

    const meta = clientMeta(req);
    await writeAudit({
      actorId: auth.payload.sub,
      actorEmail: auth.payload.email,
      actorRoleAtTime: auth.payload.roles.join(","),
      action: "community.create",
      entityType: "Community",
      entityId: row.id,
      after: row,
      ip: meta.ip,
      userAgent: meta.userAgent,
    });

    return jsonOk({ community: row }, 201);
  } catch (e) {
    return jsonError(e instanceof Error ? e.message : "Create failed", 400);
  }
}
