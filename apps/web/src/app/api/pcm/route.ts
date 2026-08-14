import { prisma } from "@/lib/db";
import { requireAuth, jsonOk, jsonError } from "@/lib/api";

export async function GET(req: Request) {
  const auth = await requireAuth(req);
  if (auth instanceof Response) return auth;

  const can =
    auth.payload.permissions.includes("*") ||
    auth.payload.permissions.includes("pcm:read") ||
    auth.payload.permissions.includes("pcm:search") ||
    auth.payload.roles.some((r) =>
      ["Security Officer", "Registration Officer", "Platoon Officer", "Head of Platoon Officers", "Bank Account Officer"].includes(r)
    ) ||
    auth.payload.roles.some((r) => r.toLowerCase().includes("platoon"));
  if (!can) return jsonError("Forbidden", 403);

  const url = new URL(req.url);
  const q = (url.searchParams.get("q") || "").trim();
  const callUp = (url.searchParams.get("callUp") || "").trim();

  const where =
    q || callUp
      ? {
          OR: [
            ...(callUp
              ? [{ callUpNumber: { equals: callUp, mode: "insensitive" as const } }]
              : []),
            ...(q
              ? [
                  { callUpNumber: { contains: q, mode: "insensitive" as const } },
                  { fullName: { contains: q, mode: "insensitive" as const } },
                  { stateCode: { contains: q, mode: "insensitive" as const } },
                  { deploymentState: { contains: q, mode: "insensitive" as const } },
                ]
              : []),
          ],
        }
      : {};

  const pcms = await prisma.pcm.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true,
      callUpNumber: true,
      fullName: true,
      gender: true,
      institution: true,
      status: true,
      deploymentState: true,
      photographUrl: true,
      campAddress: true,
      dateReporting: true,
      batchYear: true,
      stateCode: true,
      platoonCode: true,
      kitIssuedAt: true,
      kitIssuedByName: true,
    },
  });

  return jsonOk({ pcms });
}
