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
    // Store as note on PCM when found; always accept submission for camp workflow
    if (pcm) {
      const note = [
        pcm.notes,
        `[Nursing/Pregnant] status=${body.status}; husband=${body.husbandName || "-"}; address=${body.husbandAddress}; state=${body.residenceState || "-"}; LGA=${body.residenceLga || "-"}; community=${body.residenceCommunity || "-"}; phone=${body.phone || "-"}`,
      ]
        .filter(Boolean)
        .join("\n");
      await prisma.pcm.update({
        where: { id: pcm.id },
        data: { notes: note, phone: body.phone ? String(body.phone) : pcm.phone },
      });
      return jsonOk({ linked: true, pcmId: pcm.id });
    }

    return jsonOk({
      linked: false,
      message:
        "Saved for camp review. Call-up not yet in registry — staff can link after intake.",
    });
  } catch (e) {
    console.error(e);
    return jsonError(e instanceof Error ? e.message : "Failed", 400);
  }
}
