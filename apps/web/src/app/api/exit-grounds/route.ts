import { prisma } from "@/lib/db";
import { requireAuth, jsonOk, jsonError } from "@/lib/api";

async function ensureDefaults() {
  const count = await prisma.exitGroundOption.count();
  if (count > 0) return;
  await prisma.exitGroundOption.createMany({
    data: [
      { code: "MARITAL", label: "Marital grounds", requiresClinic: false, sortOrder: 1 },
      { code: "MEDICAL", label: "Medical grounds", requiresClinic: true, sortOrder: 2 },
      { code: "TERRORISM", label: "Terrorism grounds", requiresClinic: false, sortOrder: 3 },
    ],
  });
}

export async function GET(req: Request) {
  const auth = await requireAuth(req);
  if (auth instanceof Response) return auth;
  try {
    await ensureDefaults();
  } catch {
    /* table may not exist until db push */
  }
  try {
    const items = await prisma.exitGroundOption.findMany({
      orderBy: [{ sortOrder: "asc" }, { label: "asc" }],
    });
    return jsonOk({ items });
  } catch {
    return jsonOk({
      items: [
        { id: "1", code: "MARITAL", label: "Marital grounds", requiresClinic: false, isActive: true },
        { id: "2", code: "MEDICAL", label: "Medical grounds", requiresClinic: true, isActive: true },
        { id: "3", code: "TERRORISM", label: "Terrorism grounds", requiresClinic: false, isActive: true },
      ],
    });
  }
}

export async function POST(req: Request) {
  const auth = await requireAuth(req, "user:create");
  if (auth instanceof Response) return auth;
  const body = await req.json();
  const code = String(body.code || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "_");
  const label = String(body.label || "").trim();
  if (!code || !label) return jsonError("code and label required");
  try {
    const item = await prisma.exitGroundOption.create({
      data: {
        code,
        label,
        requiresClinic: Boolean(body.requiresClinic),
        isActive: body.isActive !== false,
        sortOrder: Number(body.sortOrder) || 0,
      },
    });
    return jsonOk({ item }, 201);
  } catch (e) {
    return jsonError(e instanceof Error ? e.message : "Create failed");
  }
}

export async function PATCH(req: Request) {
  const auth = await requireAuth(req, "user:create");
  if (auth instanceof Response) return auth;
  const body = await req.json();
  const id = String(body.id || "");
  if (!id) return jsonError("id required");
  try {
    const item = await prisma.exitGroundOption.update({
      where: { id },
      data: {
        label: body.label !== undefined ? String(body.label) : undefined,
        requiresClinic:
          body.requiresClinic !== undefined ? Boolean(body.requiresClinic) : undefined,
        isActive: body.isActive !== undefined ? Boolean(body.isActive) : undefined,
        sortOrder: body.sortOrder !== undefined ? Number(body.sortOrder) : undefined,
      },
    });
    return jsonOk({ item });
  } catch (e) {
    return jsonError(e instanceof Error ? e.message : "Update failed");
  }
}

export async function DELETE(req: Request) {
  const auth = await requireAuth(req, "user:create");
  if (auth instanceof Response) return auth;
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return jsonError("id required");
  try {
    await prisma.exitGroundOption.delete({ where: { id } });
    return jsonOk({ deleted: true });
  } catch (e) {
    return jsonError(e instanceof Error ? e.message : "Delete failed");
  }
}
