import { prisma } from "@/lib/db";
import { jsonOk, jsonError } from "@/lib/api";
import { getCmBearerPayload } from "@/lib/cm-auth";
import { uploadDataUriToCloudinary } from "@/lib/cloudinary";

export async function POST(req: Request) {
  try {
    const payload = await getCmBearerPayload(req.headers.get("authorization"));
    if (!payload) {
      return jsonError("Unauthorized", 401);
    }

    const body = await req.json();
    const dataUrl = body.photoDataUrl ? String(body.photoDataUrl) : "";
    if (!dataUrl.startsWith("data:image")) {
      return jsonError("Profile photo image is required");
    }

    const url = await uploadDataUriToCloudinary(
      dataUrl,
      `pcm_profile_${payload.callUpNumber}`
    );
    if (!url) {
      return jsonError(
        "Could not upload photo. Check Cloudinary configuration.",
        400
      );
    }

    const pcm = await prisma.pcm.update({
      where: { id: payload.sub },
      data: { photographUrl: url },
      select: { id: true, photographUrl: true },
    });

    return jsonOk({ photographUrl: pcm.photographUrl });
  } catch (e) {
    console.error("cm photo", e);
    return jsonError("Could not update photo", 500);
  }
}
