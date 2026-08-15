import { prisma } from "@/lib/db";
import { requireAuth, jsonOk, jsonError } from "@/lib/api";
import { fetchIdCardPhotoToCloudinary, idCardVerifyUrl } from "@/lib/nysc-photo";

/**
 * Fill missing PCM photos from NYSC ID card pages (Cloudinary).
 * Processes a small batch so Vercel does not time out — call repeatedly.
 * Body: { limit?: number (default 15, max 30) }
 */
export async function POST(req: Request) {
  const auth = await requireAuth(req, "registration:complete");
  if (auth instanceof Response) return auth;

  const body = await req.json().catch(() => ({}));
  const limit = Math.min(30, Math.max(1, Number(body.limit) || 15));

  const missing = await prisma.pcm.findMany({
    where: {
      OR: [{ photographUrl: null }, { photographUrl: "" }],
    },
    select: { id: true, callUpNumber: true, notes: true },
    take: limit,
    orderBy: { createdAt: "desc" },
  });

  let filled = 0;
  let failed = 0;
  const details: { callUp: string; ok: boolean; error?: string }[] = [];

  for (const pcm of missing) {
    // Prefer URL already stored in notes
    let source: string | undefined;
    const m = pcm.notes?.match(/ID card:\s*(https?:\/\/\S+)/i);
    if (m) source = m[1];

    const { photographUrl, sourceUrl } = await fetchIdCardPhotoToCloudinary(
      pcm.callUpNumber,
      source || idCardVerifyUrl(pcm.callUpNumber)
    );

    if (photographUrl) {
      const noteLine = `ID card: ${sourceUrl}`;
      const notes =
        pcm.notes && pcm.notes.includes(sourceUrl)
          ? pcm.notes
          : pcm.notes
            ? `${pcm.notes} | ${noteLine}`
            : noteLine;

      await prisma.pcm.update({
        where: { id: pcm.id },
        data: { photographUrl, notes },
      });
      filled++;
      details.push({ callUp: pcm.callUpNumber, ok: true });
    } else {
      failed++;
      details.push({
        callUp: pcm.callUpNumber,
        ok: false,
        error: "No photo on ID card page or Cloudinary failed",
      });
    }
  }

  const remaining = await prisma.pcm.count({
    where: {
      OR: [{ photographUrl: null }, { photographUrl: "" }],
    },
  });

  return jsonOk({
    processed: missing.length,
    filled,
    failed,
    remaining,
    details: details.slice(0, 20),
    hint:
      remaining > 0
        ? "Call this endpoint again until remaining is 0"
        : "All PCMs have photos (or none left without)",
  });
}
