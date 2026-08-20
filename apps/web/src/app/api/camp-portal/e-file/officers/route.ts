import { prisma } from "@/lib/db";
import { jsonOk, jsonError } from "@/lib/api";
import { getCmBearerPayload } from "@/lib/cm-auth";

/** Active officers for CM "send to" picker (no emails). */
export async function GET(req: Request) {
  const payload = await getCmBearerPayload(req.headers.get("authorization"));
  if (!payload) {
    return jsonError("Unauthorized", 401);
  }

  const users = await prisma.user.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
    take: 200,
    select: {
      id: true,
      name: true,
      post: true,
      rank: true,
      roles: { include: { role: { select: { name: true } } } },
    },
  });

  const officers = users.map((u) => ({
    id: u.id,
    name: u.name?.trim() || u.post || "Officer",
    post: u.post,
    rank: u.rank,
    roles: u.roles.map((r) => r.role.name),
  }));

  return jsonOk({ officers });
}
