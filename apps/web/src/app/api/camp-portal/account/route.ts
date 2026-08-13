import { prisma } from "@/lib/db";
import { jsonOk, jsonError } from "@/lib/api";
import { uploadDataUriToCloudinary } from "@/lib/cloudinary";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const callUpNumber = String(body.callUpNumber ?? "").trim();
    const fullName = String(body.fullName ?? "").trim();
    const nin = body.nin ? String(body.nin).trim() : "";
    const front = body.ninFrontDataUrl ? String(body.ninFrontDataUrl) : "";
    const back = body.ninBackDataUrl ? String(body.ninBackDataUrl) : "";

    if (!callUpNumber || !fullName) {
      return jsonError("Call-up number and full name are required");
    }
    if (!front.startsWith("data:image")) {
      return jsonError("NIN front image is required");
    }

    const frontUrl = await uploadDataUriToCloudinary(front, `nin_front_${callUpNumber}`);
    if (!frontUrl) {
      return jsonError(
        "Could not upload NIN image. Check Cloudinary configuration.",
        400
      );
    }
    let backUrl: string | null = null;
    if (back.startsWith("data:image")) {
      backUrl = await uploadDataUriToCloudinary(back, `nin_back_${callUpNumber}`);
    }

    const pcm = await prisma.pcm.findUnique({ where: { callUpNumber } });
    if (pcm) {
      const note = [
        pcm.notes,
        `[NIN] nin=${nin || "-"}; front=${frontUrl}; back=${backUrl || "-"}`,
      ]
        .filter(Boolean)
        .join("\n");
      await prisma.pcm.update({ where: { id: pcm.id }, data: { notes: note } });
      return jsonOk({ linked: true, pcmId: pcm.id, frontUrl, backUrl });
    }

    return jsonOk({
      linked: false,
      frontUrl,
      backUrl,
      message:
        "Images uploaded. Call-up not in registry yet — staff can attach after intake.",
    });
  } catch (e) {
    console.error(e);
    return jsonError(e instanceof Error ? e.message : "Failed", 400);
  }
}
