import { jsonOk, jsonError } from "@/lib/api";
import { getCmBearerPayload } from "@/lib/cm-auth";
import { prisma } from "@/lib/db";

export async function GET(req: Request) {
  const payload = await getCmBearerPayload(req.headers.get("authorization"));
  if (!payload) {
    return jsonError("Unauthorized", 401);
  }

  const pcm = await prisma.pcm.findUnique({
    where: { id: payload.sub },
    select: {
      id: true,
      callUpNumber: true,
      fullName: true,
      stateCode: true,
      phone: true,
      gender: true,
      photographUrl: true,
      portalPasswordHash: true,
    },
  });

  if (!pcm) {
    return jsonError("Session invalid", 401);
  }

  return jsonOk({
    pcm: {
      id: pcm.id,
      callUpNumber: pcm.callUpNumber,
      fullName: pcm.fullName,
      stateCode: pcm.stateCode,
      phone: pcm.phone,
      gender: pcm.gender,
      photographUrl: pcm.photographUrl,
      hasCustomPassword: Boolean(pcm.portalPasswordHash),
    },
  });
}
