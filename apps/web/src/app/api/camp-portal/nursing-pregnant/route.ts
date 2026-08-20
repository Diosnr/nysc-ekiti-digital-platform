import { prisma } from "@/lib/db";
import { jsonOk, jsonError } from "@/lib/api";
import { getCmBearerPayload } from "@/lib/cm-auth";

export async function POST(req: Request) {
  try {
    const payload = await getCmBearerPayload(req.headers.get("authorization"));
    if (!payload) {
      return jsonError("Unauthorized — sign in to My Portal", 401);
    }

    const body = await req.json();
    const address = String(body.address ?? body.husbandAddress ?? "").trim();
    const statuses: string[] = Array.isArray(body.statuses)
      ? body.statuses.map(String)
      : body.status
        ? [String(body.status)]
        : [];

    if (!address) return jsonError("Address is required");
    if (statuses.length === 0) return jsonError("Select at least one status");

    const hasSingle = statuses.includes("single_mother");
    const hasMarried = statuses.includes("married_woman");
    if (hasSingle && hasMarried) {
      return jsonError("Single mother cannot be combined with Married Women");
    }

    const callUpNumber = payload.callUpNumber;
    const fullName = payload.fullName;

    const pcm = await prisma.pcm.findUnique({ where: { id: payload.sub } });
    if (!pcm) {
      return jsonError("Session invalid", 401);
    }

    const row = await prisma.pcmFamilyStatus.create({
      data: {
        pcmId: pcm.id,
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

    if (body.phone) {
      await prisma.pcm.update({
        where: { id: pcm.id },
        data: { phone: String(body.phone).replace(/\D/g, "") || pcm.phone },
      });
    }

    return jsonOk({ linked: true, id: row.id, pcmId: pcm.id });
  } catch (e) {
    console.error(e);
    return jsonError(e instanceof Error ? e.message : "Failed", 400);
  }
}
