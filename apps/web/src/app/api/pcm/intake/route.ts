import { prisma } from "@/lib/db";
import { getBearerPayload } from "@/lib/auth-server";
import { jsonOk, jsonError, clientMeta } from "@/lib/api";
import { writeAudit } from "@/lib/audit";
import { createVerificationAdapter } from "@nysc/verification";
import { hasPermission } from "@nysc/auth";
import { uploadDataUriToCloudinary } from "@/lib/cloudinary";

/**
 * Staff-only PCM intake.
 * previewOnly: parse NYSC QR page → return fields (no write)
 * confirm: create PCM (photo required)
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const payload = await getBearerPayload(req.headers.get("authorization"));

    if (!payload) {
      return jsonError("Staff login required for PCM intake", 401);
    }
    const allowed =
      hasPermission(payload.permissions, "pcm:create") ||
      hasPermission(payload.permissions, "pcm:verify") ||
      payload.roles?.includes("Security Officer") ||
      payload.roles?.includes("Registration Officer") ||
      payload.roles?.includes("Super Admin");
    if (!allowed) {
      return jsonError("Forbidden", 403);
    }

    const mode = (body.mode as string) === "qr" ? "qr" : "manual";
    const previewOnly = Boolean(body.previewOnly);
    const confirm = Boolean(body.confirm);

    if (mode === "qr" && (previewOnly || !confirm)) {
      const input = String(body.input ?? body.qrPayload ?? "").trim();
      if (!input) return jsonError("Missing QR payload");

      const adapter = createVerificationAdapter("qr");
      let verified;
      try {
        verified = await adapter.verify(input);
      } catch (e) {
        return jsonError(
          e instanceof Error ? e.message : "Verification failed",
          422
        );
      }

      if (
        !verified.fullName ||
        verified.fullName === "PENDING_VERIFICATION" ||
        !verified.callUpNumber ||
        verified.callUpNumber.startsWith("PENDING-")
      ) {
        return jsonError(
          "Could not read name/call-up from NYSC page. Try again or use manual intake.",
          422
        );
      }

      const existing = await prisma.pcm.findUnique({
        where: { callUpNumber: verified.callUpNumber },
      });

      return jsonOk({
        status: "preview",
        alreadyRegistered: Boolean(existing),
        existingId: existing?.id,
        fields: {
          callUpNumber: verified.callUpNumber,
          fullName: verified.fullName,
          gender: verified.gender ?? "",
          institution: verified.institution ?? "",
          deploymentState:
            verified.deploymentState || verified.stateCode || "",
          campAddress: verified.campAddress ?? "",
          dateReporting: verified.dateReporting ?? "",
          batchYear: verified.batchYear ?? "",
          photographUrl: verified.photographUrl ?? "",
          verificationUrl: input,
          source: verified.source,
        },
      });
    }

    const data = body.data ?? {};
    const callUpNumber = String(data.callUpNumber ?? "").trim();
    const fullName = String(data.fullName ?? "").trim();
    const gender = data.gender ? String(data.gender).trim() : "";
    const institution = data.institution ? String(data.institution).trim() : "";
    const deploymentState = data.deploymentState
      ? String(data.deploymentState).trim()
      : "";
    const campAddress = data.campAddress ? String(data.campAddress).trim() : "";
    const dateReporting = data.dateReporting
      ? String(data.dateReporting).trim()
      : "";
    const batchYear = data.batchYear ? String(data.batchYear).trim() : "";

    if (!callUpNumber || !fullName) {
      return jsonError("Call-up number and full name are required");
    }

    let photographUrl: string | null = data.photographUrl
      ? String(data.photographUrl)
      : null;

    if (!photographUrl) {
      return jsonError("Photo is required for intake", 400);
    }

    if (photographUrl.startsWith("data:image")) {
      const uploaded = await uploadDataUriToCloudinary(
        photographUrl,
        callUpNumber
      );
      if (!uploaded) {
        return jsonError(
          "Photo upload failed. Check Cloudinary env vars (CLOUDINARY_CLOUD_NAME, API_KEY, API_SECRET) on Vercel, then redeploy.",
          400
        );
      }
      photographUrl = uploaded;
    }

    if (!/^https?:\/\//i.test(photographUrl)) {
      return jsonError("Invalid photograph URL after upload", 400);
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
        gender: gender || null,
        institution: institution || null,
        photographUrl,
        deploymentState: deploymentState || null,
        stateCode: deploymentState || null,
        campAddress: campAddress || null,
        dateReporting: dateReporting || null,
        batchYear: batchYear || null,
        stream: batchYear || null,
        status: "VERIFIED",
        createdById: payload.sub,
        verifications: {
          create: {
            source: mode === "qr" ? "nysc_verify_page" : "manual",
            inputRef: body.verificationUrl
              ? String(body.verificationUrl).slice(0, 500)
              : mode,
            rawJson: JSON.stringify({
              callUpNumber,
              fullName,
              deploymentState,
              batchYear,
              dateReporting,
              hasPhoto: true,
            }),
            verifiedAt: new Date(),
          },
        },
      },
    });

    const meta = clientMeta(req);
    await writeAudit({
      actorId: payload.sub,
      actorEmail: payload.email,
      actorRoleAtTime: payload.roles.join(","),
      action: "pcm.intake.staff",
      entityType: "Pcm",
      entityId: pcm.id,
      pcmId: pcm.id,
      after: {
        callUpNumber: pcm.callUpNumber,
        fullName: pcm.fullName,
        deploymentState: pcm.deploymentState,
        batchYear: pcm.batchYear,
        photographUrl: pcm.photographUrl,
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
        "Database schema updating — retry in a minute after deploy finishes.",
        503
      );
    }
    return jsonError(message, 400);
  }
}
