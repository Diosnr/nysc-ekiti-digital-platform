import { prisma } from "@/lib/db";
import { getBearerPayload } from "@/lib/auth-server";
import { jsonOk, jsonError, clientMeta } from "@/lib/api";
import { writeAudit } from "@/lib/audit";
import { createVerificationAdapter } from "@nysc/verification";
import { hasPermission } from "@nysc/auth";
import { uploadDataUriToCloudinary } from "@/lib/cloudinary";

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
      return jsonError(message, 422);
    }

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
          deploymentState: verified.deploymentState,
          dateReporting: verified.dateReporting,
          batchYear: verified.batchYear,
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

    // Photo: upload base64 to Cloudinary; store URL only
    let photographUrl: string | null =
      body.data?.photographUrl || verified.photographUrl || null;
    if (photographUrl?.startsWith("data:image")) {
      const uploaded = await uploadDataUriToCloudinary(
        photographUrl,
        callUpNumber
      );
      photographUrl = uploaded;
    }

    const deploymentState =
      body.data?.deploymentState ||
      verified.deploymentState ||
      verified.stateCode ||
      null;
    const batchYear = body.data?.batchYear || verified.batchYear || null;
    const dateReporting =
      body.data?.dateReporting || verified.dateReporting || null;
    const campAddress = body.data?.campAddress || verified.campAddress || null;

    const pcm = await prisma.pcm.create({
      data: {
        callUpNumber,
        fullName,
        gender: body.data?.gender || verified.gender,
        institution: body.data?.institution || verified.institution,
        course: body.data?.course || verified.course,
        photographUrl,
        deploymentState,
        stateCode: deploymentState,
        campAddress,
        dateReporting,
        batchYear,
        stream: batchYear,
        phone: body.data?.phone || verified.phone,
        email: body.data?.email || verified.email,
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
              deploymentState,
              campAddress,
              batchYear,
              dateReporting,
              hasPhoto: Boolean(photographUrl),
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
        deploymentState: pcm.deploymentState,
        batchYear: pcm.batchYear,
        dateReporting: pcm.dateReporting,
        hasPhoto: Boolean(pcm.photographUrl),
        source: verified.source,
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
          deploymentState: pcm.deploymentState,
          campAddress: pcm.campAddress,
          dateReporting: pcm.dateReporting,
          batchYear: pcm.batchYear,
          photographUrl: pcm.photographUrl,
          status: pcm.status,
        },
      },
      201
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : "Intake failed";
    console.error("pcm intake", e);
    if (/P1001|P2021|does not exist|Can't reach database/i.test(message)) {
      return jsonError(
        "Database not ready. Run prisma db push + seed against your Neon DATABASE_URL.",
        503
      );
    }
    return jsonError(message, 400);
  }
}
