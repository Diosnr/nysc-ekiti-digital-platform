import { prisma } from "@/lib/db";
import { requireAuth, jsonOk, jsonError, clientMeta } from "@/lib/api";
import { writeAudit } from "@/lib/audit";
import { hasBankAccess } from "@/lib/bank-access";

/** Lookup member for bank desk — returns identity + existing bank/NIN (audited). */
export async function GET(req: Request) {
  const auth = await requireAuth(req);
  if (auth instanceof Response) return auth;
  if (!hasBankAccess(auth.payload.roles, auth.payload.permissions)) {
    return jsonError("Forbidden — bank desk only", 403);
  }

  const url = new URL(req.url);
  const q = (url.searchParams.get("q") || "").trim();
  if (!q) return jsonError("Search query required");

  const pcm = await prisma.pcm.findFirst({
    where: {
      OR: [
        { callUpNumber: { equals: q, mode: "insensitive" } },
        { stateCode: { equals: q, mode: "insensitive" } },
        { fullName: { contains: q, mode: "insensitive" } },
      ],
    },
    orderBy: { updatedAt: "desc" },
    include: {
      bankRegistration: true,
      ninRecords: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  });

  if (!pcm) return jsonError("No corps member found", 404);

  const meta = clientMeta(req);
  await writeAudit({
    actorId: auth.payload.sub,
    actorEmail: auth.payload.email,
    actorRoleAtTime: auth.payload.roles.join(","),
    action: "bank.lookup",
    entityType: "Pcm",
    entityId: pcm.id,
    pcmId: pcm.id,
    ip: meta.ip,
    userAgent: meta.userAgent,
  });

  const nin = pcm.ninRecords[0] ?? null;

  return jsonOk({
    pcm: {
      id: pcm.id,
      fullName: pcm.fullName,
      callUpNumber: pcm.callUpNumber,
      stateCode: pcm.stateCode,
      gender: pcm.gender,
      photographUrl: pcm.photographUrl,
      status: pcm.status,
      phone: pcm.phone,
    },
    bank: pcm.bankRegistration
      ? {
          id: pcm.bankRegistration.id,
          bankName: pcm.bankRegistration.bankName,
          accountNumber: pcm.bankRegistration.accountNumber,
          accountName: pcm.bankRegistration.accountName,
          bvn: pcm.bankRegistration.bvn,
          note: pcm.bankRegistration.note,
          registeredByName: pcm.bankRegistration.registeredByName,
          registeredAt: pcm.bankRegistration.registeredAt,
          updatedAt: pcm.bankRegistration.updatedAt,
        }
      : null,
    nin: nin
      ? {
          id: nin.id,
          nin: nin.nin,
          frontUrl: nin.frontUrl,
          backUrl: nin.backUrl,
          createdAt: nin.createdAt,
        }
      : null,
  });
}
