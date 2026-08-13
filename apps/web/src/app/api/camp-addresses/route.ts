import { prisma } from "@/lib/db";
import { requireAuth, jsonOk, jsonError, clientMeta } from "@/lib/api";
import { writeAudit } from "@/lib/audit";

/**
 * GET — list camp addresses
 * - Staff with any auth: active only (for dropdowns) unless ?all=1 and camp:address:manage
 * - Public not allowed (staff intake uses bearer)
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const wantAll = searchParams.get("all") === "1";

  if (wantAll) {
    const auth = await requireAuth(req, "camp:address:manage");
    if (auth instanceof Response) return auth;
    const rows = await prisma.campAddress.findMany({
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    });
    return jsonOk({ campAddresses: rows });
  }

  // Dropdown consumers need login
  const auth = await requireAuth(req);
  if (auth instanceof Response) return auth;

  const rows = await prisma.campAddress.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      address: true,
      state: true,
      lga: true,
    },
  });
  return jsonOk({ campAddresses: rows });
}

export async function POST(req: Request) {
  const auth = await requireAuth(req, "camp:address:manage");
  if (auth instanceof Response) return auth;

  try {
    const body = await req.json();
    const name = String(body.name ?? "").trim();
    const address = String(body.address ?? "").trim();
    if (!name || !address) {
      return jsonError("name and address are required");
    }

    const row = await prisma.campAddress.create({
      data: {
        name,
        address,
        state: body.state ? String(body.state).trim() : null,
        lga: body.lga ? String(body.lga).trim() : null,
        notes: body.notes ? String(body.notes).trim() : null,
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
      action: "camp_address.create",
      entityType: "CampAddress",
      entityId: row.id,
      after: { name, address, state: row.state },
      ip: meta.ip,
      userAgent: meta.userAgent,
    });

    return jsonOk({ campAddress: row }, 201);
  } catch (e) {
    console.error(e);
    return jsonError(e instanceof Error ? e.message : "Create failed", 400);
  }
}
