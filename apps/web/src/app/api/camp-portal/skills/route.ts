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
    const skills = [body.skill1, body.skill2, body.skill3].filter(Boolean).join(", ");

    const pcm = await prisma.pcm.findUnique({ where: { callUpNumber } });
    if (pcm) {
      const note = [pcm.notes, `[Skills] ${skills}`].filter(Boolean).join("\n");
      await prisma.pcm.update({ where: { id: pcm.id }, data: { notes: note } });
      return jsonOk({ linked: true, pcmId: pcm.id });
    }
    return jsonOk({
      linked: false,
      message: "Recorded. Call-up not in registry yet — staff can link after intake.",
    });
  } catch (e) {
    console.error(e);
    return jsonError(e instanceof Error ? e.message : "Failed", 400);
  }
}
