import { prisma } from "@/lib/db";
import { requireAuth, jsonOk, jsonError } from "@/lib/api";

export async function GET(req: Request) {
  const auth = await requireAuth(req, "audit:read");
  if (auth instanceof Response) return auth;

  const { searchParams } = new URL(req.url);
  const take = Math.min(Number(searchParams.get("limit") ?? 50), 200);
  const action = searchParams.get("action") ?? undefined;

  const logs = await prisma.auditLog.findMany({
    where: action ? { action } : undefined,
    orderBy: { createdAt: "desc" },
    take,
  });

  return jsonOk({ logs });
}
