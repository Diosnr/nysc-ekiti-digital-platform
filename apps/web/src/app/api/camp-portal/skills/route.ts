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
    const skill1 = body.skill1 ? String(body.skill1).trim() : "";
    const skill2 = body.skill2 ? String(body.skill2).trim() : "";
    const skill3 = body.skill3 ? String(body.skill3).trim() : "";

    if (!skill1) {
      return jsonError("Skill 1 is required");
    }

    const callUpNumber = payload.callUpNumber;
    const fullName = payload.fullName;

    const pcm = await prisma.pcm.findUnique({ where: { id: payload.sub } });
    if (!pcm) {
      return jsonError("Session invalid", 401);
    }

    const row = await prisma.pcmSkillProfile.create({
      data: {
        pcmId: pcm.id,
        callUpNumber,
        fullName,
        skill1,
        skill2: skill2 || null,
        skill3: skill3 || null,
      },
    });

    return jsonOk({ linked: true, id: row.id, pcmId: pcm.id });
  } catch (e) {
    console.error(e);
    return jsonError(e instanceof Error ? e.message : "Failed", 400);
  }
}
