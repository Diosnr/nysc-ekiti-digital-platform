import { prisma } from "@/lib/db";
import { requireAuth, jsonOk } from "@/lib/api";

export async function GET(req: Request) {
  const auth = await requireAuth(req, ["permission:manage", "role:read"]);
  // requireAuth with array uses hasPermission which is AND — fix: allow either
  // For simplicity, check role:read OR permission:manage manually if first fails.
  if (auth instanceof Response) {
    const auth2 = await requireAuth(req, "role:read");
    if (auth2 instanceof Response) return auth2;
  }

  const permissions = await prisma.permission.findMany({
    orderBy: [{ module: "asc" }, { key: "asc" }],
  });

  return jsonOk({ permissions });
}
