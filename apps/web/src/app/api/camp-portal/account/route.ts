import { prisma } from "@/lib/db";
import { jsonOk, jsonError } from "@/lib/api";
import { getCmBearerPayload } from "@/lib/cm-auth";
import { uploadDataUriToCloudinary } from "@/lib/cloudinary";

export async function POST(req: Request) {
  try {
    const payload = await getCmBearerPayload(req.headers.get("authorization"));
    if (!payload) {
      return jsonError("Unauthorized — sign in to My Portal", 401);
    }

    const body = await req.json();
    const nin = body.nin ? String(body.nin).replace(/\D/g, "").slice(0, 11) : "";
    const front = body.ninFrontDataUrl ? String(body.ninFrontDataUrl) : "";
    const back = body.ninBackDataUrl ? String(body.ninBackDataUrl) : "";

    if (!front.startsWith("data:image")) {
      return jsonError("NIN front image is required");
    }

    const callUpNumber = payload.callUpNumber;
    const fullName = payload.fullName;

    const frontUrl = await uploadDataUriToCloudinary(
      front,
      `nin_front_${callUpNumber}`
    );
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

    const pcm = await prisma.pcm.findUnique({ where: { id: payload.sub } });
    if (!pcm) {
      return jsonError("Session invalid", 401);
    }

    const row = await prisma.pcmNinRecord.create({
      data: {
        pcmId: pcm.id,
        callUpNumber,
        fullName,
        nin: nin || null,
        frontUrl,
        backUrl,
      },
    });

    return jsonOk({
      linked: true,
      id: row.id,
      pcmId: pcm.id,
      frontUrl,
      backUrl,
    });
  } catch (e) {
    console.error(e);
    return jsonError(e instanceof Error ? e.message : "Failed", 400);
  }
}
