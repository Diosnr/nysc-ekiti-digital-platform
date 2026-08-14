import { prisma } from "@/lib/db";
import { jsonOk, jsonError } from "@/lib/api";

/**
 * Public call-up lookup for Camp Portal forms.
 * Returns only call-up + full name when the PCM exists (no other PII).
 */
export async function GET(req: Request) {
  const callUp = new URL(req.url).searchParams.get("callUp")?.trim();
  if (!callUp || callUp.length < 4) {
    return jsonError("Enter a call-up number to search");
  }

  try {
    const pcm = await prisma.pcm.findFirst({
      where: {
        callUpNumber: { equals: callUp, mode: "insensitive" },
      },
      select: {
        callUpNumber: true,
        fullName: true,
      },
    });

    if (!pcm) {
      return jsonOk({ found: false });
    }

    return jsonOk({
      found: true,
      callUpNumber: pcm.callUpNumber,
      fullName: pcm.fullName,
    });
  } catch (e) {
    console.error("pcm-lookup", e);
    return jsonError("Lookup failed", 500);
  }
}
