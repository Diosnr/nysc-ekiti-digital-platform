import { prisma } from "@/lib/db";
import { requireAuth, jsonOk, jsonError, clientMeta } from "@/lib/api";
import { writeAudit } from "@/lib/audit";
import { createVerificationAdapter } from "@nysc/verification";

/**
 * POST /api/pcm/intake
 * Body options:
 * - { mode: "manual", data: { callUpNumber, fullName, ... } }
 * - { mode: "qr", input: "<qr payload or url>" }  // remote only if authorized
 */
export async function POST(req: Request) {
  const auth = await requireAuth(req, "pcm:create");
  if (auth instanceof Response) {
    // allow verify permission as alternate for intake operators
    const alt = await requireAuth(req, "pcm:verify");
    if (alt instanceof Response) return auth;
  }

  const actor = auth instanceof Response ? null : auth.payload;
  // Re-resolve if first failed but second succeeded
  const gate =
    auth instanceof Response ? await requireAuth(req, "pcm:verify") : auth;
  if (gate instanceof Response) return gate;

  try {
    const body = await req.json();
    const mode = (body.mode as string) || "manual";
    const adapterMode =
      mode === "qr"
        ? ((process.env.VERIFICATION_ADAPTER as "manual" | "scraping" | "official_api") ??
          "manual")
        : "manual";

    const adapter = createVerificationAdapter(
      mode === "manual" ? "manual" : adapterMode
    );

    const input =
      mode === "manual"
        ? JSON.stringify(body.data ?? body)
        : String(body.input ?? body.qrPayload ?? "");

    const verified = await adapter.verify(input);

    const existing = await prisma.pcm.findUnique({
      where: { callUpNumber: verified.callUpNumber },
    });

    if (existing) {
      return jsonError(
        `Duplicate PCM: call-up ${verified.callUpNumber} already exists (${existing.fullName})`,
        409
      );
    }

    const pcm = await prisma.pcm.create({
      data: {
        callUpNumber: verified.callUpNumber,
        fullName: verified.fullName,
        gender: verified.gender,
        institution: verified.institution,
        course: verified.course,
        photographUrl: verified.photographUrl,
        stateCode: verified.stateCode,
        status: "VERIFIED",
        createdById: gate.payload.sub,
        verifications: {
          create: {
            source: verified.source,
            inputRef: mode === "qr" ? String(body.input ?? "").slice(0, 500) : "manual",
            rawJson: verified.raw ? JSON.stringify(verified.raw) : JSON.stringify(verified),
            verifiedAt: verified.verifiedAt,
          },
        },
      },
    });

    const meta = clientMeta(req);
    await writeAudit({
      actorId: gate.payload.sub,
      actorEmail: gate.payload.email,
      actorRoleAtTime: gate.payload.roles.join(","),
      action: "pcm.intake",
      entityType: "Pcm",
      entityId: pcm.id,
      pcmId: pcm.id,
      after: {
        callUpNumber: pcm.callUpNumber,
        fullName: pcm.fullName,
        source: verified.source,
      },
      ip: meta.ip,
      userAgent: meta.userAgent,
    });

    return jsonOk({ pcm }, 201);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Intake failed";
    console.error("pcm intake", e);
    return jsonError(message, 400);
  }
}
