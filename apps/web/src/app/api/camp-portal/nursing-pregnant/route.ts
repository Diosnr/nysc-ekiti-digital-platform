import { prisma } from "@/lib/db";
import { jsonOk, jsonError } from "@/lib/api";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const callUpNumber = String(body.callUpNumber ?? "").trim();
    const fullName = String(body.fullName ?? "").trim();
    const address = String(body.address ?? body.husbandAddress ?? "").trim();
    const statuses: string[] = Array.isArray(body.statuses)
      ? body.statuses.map(String)
      : body.status
        ? [String(body.status)]
        : [];

    if (!callUpNumber || !fullName) {
      return jsonError("Call-up number and full name are required");
    }
    if (!address) return jsonError("Address is required");
    if (statuses.length === 0) return jsonError("Select at least one status");

    const hasSingle = statuses.includes("single_mother");
    const hasMarried = statuses.includes("married_woman");
    if (hasSingle && hasMarried) {
      return jsonError("Single mother cannot be combined with Married Women");
    }

    const pcm = await prisma.pcm.findUnique({ where: { callUpNumber } });

    const row = await prisma.pcmFamilyStatus.create({
      data: {
        pcmId: pcm?.id ?? null,
        callUpNumber,
        fullName,
        statusesJson: JSON.stringify(statuses),
        husbandName: hasSingle
          ? null
          : body.husbandName
            ? String(body.husbandName).trim()
            : null,
        address,
        state: body.residenceState ? String(body.residenceState) : null,
        lga: body.residenceLga ? String(body.residenceLga) : null,
        community: body.residenceCommunity
          ? String(body.residenceCommunity)
          : null,
        phone: body.phone ? String(body.phone).replace(/\D/g, "") : null,
      },
    });

    if (pcm && body.phone) {
      await prisma.pcm.update({
        where: { id: pcm.id },
        data: { phone: String(body.phone).replace(/\D/g, "") || pcm.phone },
      });
    }

    return jsonOk({ linked: Boolean(pcm), id: row.id, pcmId: pcm?.id });
  } catch (e) {
    console.error(e);
    return jsonError(e instanceof Error ? e.message : "Failed", 400);
  }
}
