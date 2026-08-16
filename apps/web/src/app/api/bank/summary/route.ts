import { prisma } from "@/lib/db";
import { requireAuth, jsonOk, jsonError } from "@/lib/api";
import { hasBankAccess } from "@/lib/bank-access";

export async function GET(req: Request) {
  const auth = await requireAuth(req);
  if (auth instanceof Response) return auth;
  if (!hasBankAccess(auth.payload.roles, auth.payload.permissions)) {
    return jsonError("Forbidden — bank desk only", 403);
  }

  try {
    const [registered, recent] = await Promise.all([
      prisma.pcmBankRegistration.count(),
      prisma.pcmBankRegistration.findMany({
        orderBy: { updatedAt: "desc" },
        take: 15,
        include: {
          pcm: {
            select: {
              id: true,
              fullName: true,
              callUpNumber: true,
              stateCode: true,
              photographUrl: true,
            },
          },
        },
      }),
    ]);

    return jsonOk({
      registered,
      recent: recent.map((r) => ({
        id: r.id,
        bankName: r.bankName,
        accountNumber: r.accountNumber
          ? `****${r.accountNumber.slice(-4)}`
          : null,
        registeredByName: r.registeredByName,
        updatedAt: r.updatedAt,
        pcm: r.pcm,
      })),
    });
  } catch (e) {
    return jsonError(
      e instanceof Error ? e.message : "Bank tables missing — deploy schema"
    );
  }
}
