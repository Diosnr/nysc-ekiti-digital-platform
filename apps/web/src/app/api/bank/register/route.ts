import { prisma } from "@/lib/db";
import { requireAuth, jsonOk, jsonError, clientMeta } from "@/lib/api";
import { writeAudit } from "@/lib/audit";
import { hasBankAccess } from "@/lib/bank-access";
import { uploadDataUriToCloudinary } from "@/lib/cloudinary";

/**
 * Register or update bank details for a PCM.
 * Staff must enter account numbers — system never generates them (SoT).
 */
export async function POST(req: Request) {
  const auth = await requireAuth(req);
  if (auth instanceof Response) return auth;
  if (!hasBankAccess(auth.payload.roles, auth.payload.permissions)) {
    return jsonError("Forbidden — bank desk only", 403);
  }

  const body = await req.json().catch(() => ({}));
  const pcmId = String(body.pcmId ?? "").trim();
  if (!pcmId) return jsonError("pcmId required");

  const pcm = await prisma.pcm.findUnique({ where: { id: pcmId } });
  if (!pcm) return jsonError("Member not found", 404);

  const bankName = body.bankName ? String(body.bankName).trim() : null;
  const accountNumber = body.accountNumber
    ? String(body.accountNumber).replace(/\s/g, "").trim()
    : null;
  const accountName = body.accountName
    ? String(body.accountName).trim()
    : null;
  const bvn = body.bvn
    ? String(body.bvn).replace(/\D/g, "").slice(0, 11)
    : null;
  const note = body.note ? String(body.note).trim() : null;

  // Optional NIN capture from desk
  const ninDigits = body.nin
    ? String(body.nin).replace(/\D/g, "").slice(0, 11)
    : "";
  const front = body.ninFrontDataUrl ? String(body.ninFrontDataUrl) : "";
  const back = body.ninBackDataUrl ? String(body.ninBackDataUrl) : "";

  const actor = await prisma.user.findUnique({
    where: { id: auth.payload.sub },
    select: { name: true, email: true },
  });
  const actorName = actor?.name?.trim() || actor?.email || auth.payload.email;

  const existing = await prisma.pcmBankRegistration.findUnique({
    where: { pcmId },
  });

  const bank = await prisma.pcmBankRegistration.upsert({
    where: { pcmId },
    create: {
      pcmId,
      bankName,
      accountNumber,
      accountName: accountName || pcm.fullName,
      bvn: bvn || null,
      note,
      registeredById: auth.payload.sub,
      registeredByName: actorName,
    },
    update: {
      bankName: bankName ?? undefined,
      accountNumber: accountNumber ?? undefined,
      accountName: accountName ?? undefined,
      bvn: bvn ?? undefined,
      note: note ?? undefined,
      registeredById: auth.payload.sub,
      registeredByName: actorName,
    },
  });

  // Advance lifecycle if not already past bank
  const advanceable = [
    "MOBILISED",
    "VERIFIED",
    "CHECKED_IN",
    "ACCOMMODATED",
    "REGISTERED",
  ];
  if (advanceable.includes(pcm.status)) {
    await prisma.pcm.update({
      where: { id: pcmId },
      data: { status: "BANK_REGISTERED" },
    });
  }

  // NIN images if provided
  let ninRecord = null;
  if (front.startsWith("data:image") || ninDigits) {
    let frontUrl: string | null = null;
    let backUrl: string | null = null;
    if (front.startsWith("data:image")) {
      frontUrl = await uploadDataUriToCloudinary(
        front,
        `nin_front_${pcm.callUpNumber}`
      );
    }
    if (back.startsWith("data:image")) {
      backUrl = await uploadDataUriToCloudinary(
        back,
        `nin_back_${pcm.callUpNumber}`
      );
    }
    if (frontUrl || ninDigits) {
      ninRecord = await prisma.pcmNinRecord.create({
        data: {
          pcmId,
          callUpNumber: pcm.callUpNumber,
          fullName: pcm.fullName,
          nin: ninDigits || null,
          frontUrl,
          backUrl,
        },
      });
    }
  }

  const meta = clientMeta(req);
  await writeAudit({
    actorId: auth.payload.sub,
    actorEmail: auth.payload.email,
    actorRoleAtTime: auth.payload.roles.join(","),
    action: existing ? "bank.update" : "bank.register",
    entityType: "PcmBankRegistration",
    entityId: bank.id,
    pcmId,
    before: existing
      ? {
          bankName: existing.bankName,
          accountNumber: existing.accountNumber
            ? `****${existing.accountNumber.slice(-4)}`
            : null,
        }
      : undefined,
    after: {
      bankName: bank.bankName,
      accountNumber: bank.accountNumber
        ? `****${bank.accountNumber.slice(-4)}`
        : null,
      hasNinUpload: Boolean(ninRecord),
    },
    ip: meta.ip,
    userAgent: meta.userAgent,
  });

  return jsonOk(
    {
      bank: {
        id: bank.id,
        bankName: bank.bankName,
        accountNumber: bank.accountNumber,
        accountName: bank.accountName,
        bvn: bank.bvn,
        note: bank.note,
        registeredByName: bank.registeredByName,
        registeredAt: bank.registeredAt,
        updatedAt: bank.updatedAt,
      },
      ninId: ninRecord?.id ?? null,
    },
    existing ? 200 : 201
  );
}
