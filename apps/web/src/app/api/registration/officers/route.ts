import { prisma } from "@/lib/db";
import { requireAuth, jsonOk, jsonError } from "@/lib/api";

/**
 * LGI / Zonal Inspector officers for registration dropdowns.
 * type=lgi | zi
 */
export async function GET(req: Request) {
  const auth = await requireAuth(req, "registration:complete");
  if (auth instanceof Response) return auth;

  const type = new URL(req.url).searchParams.get("type")?.toLowerCase();
  if (type !== "lgi" && type !== "zi") {
    return jsonError("type must be lgi or zi");
  }

  const roleName = type === "lgi" ? "LGI" : "Zonal Inspector";

  const users = await prisma.user.findMany({
    where: {
      isActive: true,
      roles: { some: { role: { name: roleName } } },
    },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      lgaCode: true,
      zoneCode: true,
    },
  });

  return jsonOk({
    officers: users.map((u) => ({
      id: u.id,
      name: u.name || u.email,
      phone: u.phone || "",
      lgaCode: u.lgaCode,
      zoneCode: u.zoneCode,
    })),
  });
}
