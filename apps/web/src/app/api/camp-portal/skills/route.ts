import { prisma } from "@/lib/db";
import { jsonOk, jsonError } from "@/lib/api";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const callUpNumber = String(body.callUpNumber ?? "").trim();
    const fullName = String(body.fullName ?? "").trim();
    if (!callUpNumber || !fullName) {
      return jsonError("Call-up number and full name are required");
    }

    const pcm = await prisma.pcm.findUnique({ where: { callUpNumber } });
    const row = await prisma.pcmSkillProfile.create({
      data: {
        pcmId: pcm?.id ?? null,
        callUpNumber,
        fullName,
        skill1: body.skill1 ? String(body.skill1) : null,
        skill2: body.skill2 ? String(body.skill2) : null,
        skill3: body.skill3 ? String(body.skill3) : null,
      },
    });

    return jsonOk({ linked: Boolean(pcm), id: row.id, pcmId: pcm?.id });
  } catch (e) {
    console.error(e);
    return jsonError(e instanceof Error ? e.message : "Failed", 400);
  }
}
