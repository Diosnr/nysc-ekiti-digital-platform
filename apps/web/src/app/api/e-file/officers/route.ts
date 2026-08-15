import { prisma } from "@/lib/db";
import { requireAuth, jsonOk, jsonError } from "@/lib/api";
import { canAccessExitDesk, roleHintsForStage, type ExitStage } from "@/lib/exit-workflow";

/** Active officers for "send next to" picker on e-filing. */
export async function GET(req: Request) {
  const auth = await requireAuth(req);
  if (auth instanceof Response) return auth;
  if (!canAccessExitDesk(auth.payload.roles, auth.payload.permissions)) {
    return jsonError("Forbidden", 403);
  }

  const stage = (new URL(req.url).searchParams.get("stage") || "") as ExitStage;
  const hints = stage ? roleHintsForStage(stage) : [];

  const users = await prisma.user.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
    take: 200,
    select: {
      id: true,
      name: true,
      email: true,
      post: true,
      roles: { include: { role: { select: { name: true } } } },
    },
  });

  const officers = users.map((u) => {
    const roles = u.roles.map((r) => r.role.name);
    const roleLower = roles.map((x) => x.toLowerCase());
    const matchesHint =
      hints.length === 0 ||
      hints.some((h) => roleLower.some((r) => r.includes(h)));
    return {
      id: u.id,
      name: u.name?.trim() || u.email,
      email: u.email,
      post: u.post,
      roles,
      suggested: matchesHint,
    };
  });

  // Suggested first
  officers.sort((a, b) => Number(b.suggested) - Number(a.suggested) || a.name.localeCompare(b.name));

  return jsonOk({ officers });
}
