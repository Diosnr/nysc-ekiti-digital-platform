import { prisma } from "@/lib/db";
import { getBearerPayload } from "@/lib/auth-server";
import { jsonOk, jsonError, clientMeta } from "@/lib/api";
import { writeAudit } from "@/lib/audit";
import { createVerificationAdapter } from "@nysc/verification";
import { hasPermission } from "@nysc/auth";

/**
 * POST /api/pcm/intake
 * QR mode: fetch NYSC CorpMemberVerify page and create PCM with prefilled fields.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const mode = (body.mode as string) === "qr" ? "qr" : "manual";
    const payload = await getBearerPayload(req.headers.get("authorization"));

    if (payload) {
      const allowed =
        hasPermission(payload.permissions, "pcm:create") ||
        hasPermission(payload.permissions, "pcm:verify");
      if (!allowed) {
        return jsonError("Forbidden", 403);
      }
    }

    const adapter = createVerificationAdapter(mode === "qr" ? "qr" : "manual");
    const input =
      mode === "manual"
        ? JSON.stringify(body.data ?? body)
        : String(body.input ?? body.qrPayload ?? "");

    if (!input || input === "{}" || input === "") {
      return jsonError("Missing intake data or QR payload");
    }

    let verified;
    try {
      verified = await adapter.verify(input);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Verification failed";
      // Client can still complete manually; return structured failure
      return jsonError(message, 422);
    }

    // Merge optional manual overrides (e.g. phone) on top of verified page data
    const callUpNumber = String(
      body.data?.callUpNumber || verified.callUpNumber
    ).trim();
    const fullName = String(body.data?.fullName || verified.fullName).trim();

    if (!callUpNumber || !fullName || fullName === "PENDING_VERIFICATION") {
      return jsonOk({
        status: "needs_completion",
        partial: {
          callUpNumber: callUpNumber.startsWith("PENDING-") ? "" : callUpNumber,
          fullName: fullName === "PENDING_VERIFICATION" ? "" : fullName,
          gender: verified.gender,
          institution: verified.institution,
          course: verified.course,
          stateCode: verified.stateCode || verified.deploymentState,
        },
        message:
          "Could not complete identity from QR alone. Confirm call-up number and full name from your letter.",
      });
    }

    const existing = await prisma.pcm.findUnique({ where: { callUpNumber } });
    if (existing) {
      return jsonError(
        `This call-up number is already registered (${existing.fullName}).`,
        409
      );
    }

    const pcm = await prisma.pcm.create({
      data: {
        callUpNumber,
        fullName,
        gender: body.data?.gender || verified.gender,
        institution: body.data?.institution || verified.institution,
        course: body.data?.course || verified.course,
        photographUrl: body.data?.photographUrl || verified.photographUrl,
        stateCode:
          body.data?.stateCode ||
          verified.stateCode ||
          verified.deploymentState,
        phone: body.data?.phone || verified.phone,
        email: body.data?.email || verified.email,
        stream: verified.batchYear,
        notes: [
          verified.campAddress && `Camp: ${verified.campAddress}`,
          verified.dateReporting && `Report: ${verified.dateReporting}`,
        ]
          .filter(Boolean)
          .join(" | ") || undefined,
        status: "VERIFIED",
        createdById: payload?.sub,
        verifications: {
          create: {
            source: verified.source,
            inputRef:
              mode === "qr"
                ? String(body.input ?? body.qrPayload ?? "").slice(0, 500)
                : "manual",
            rawJson: JSON.stringify({
              source: verified.source,
              deploymentState: verified.deploymentState,
              campAddress: verified.campAddress,
              batchYear: verified.batchYear,
              verificationUrl:
                verified.raw &&
                typeof verified.raw === "object" &&
                "verificationUrl" in verified.raw
                  ? (verified.raw as { verificationUrl?: string }).verificationUrl
                  : undefined,
            }),
            verifiedAt: verified.verifiedAt,
          },
        },
      },
    });

    const meta = clientMeta(req);
    await writeAudit({
      actorId: payload?.sub,
      actorEmail: payload?.email,
      actorRoleAtTime: payload?.roles?.join(","),
      action: payload ? "pcm.intake.staff" : "pcm.intake.self_service",
      entityType: "Pcm",
      entityId: pcm.id,
      pcmId: pcm.id,
      after: {
        callUpNumber: pcm.callUpNumber,
        fullName: pcm.fullName,
        source: verified.source,
        mode,
      },
      ip: meta.ip,
      userAgent: meta.userAgent,
    });

    return jsonOk(
      {
        status: "created",
        pcm: {
          id: pcm.id,
          callUpNumber: pcm.callUpNumber,
          fullName: pcm.fullName,
          gender: pcm.gender,
          institution: pcm.institution,
          stateCode: pcm.stateCode,
          status: pcm.status,
          hasPhoto: Boolean(pcm.photographUrl),
        },
      },
      201
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : "Intake failed";
    console.error("pcm intake", e);
    // Prisma table missing, etc.
    if (/P1001|P2021|does not exist|Can't reach database/i.test(message)) {
      return jsonError(
        "Database not ready. Run prisma db push + seed against your Neon DATABASE_URL.",
        503
      );
    }
    return jsonError(message, 400);
  }
}
