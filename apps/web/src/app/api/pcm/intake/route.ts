import { prisma } from "@/lib/db";
import { getBearerPayload } from "@/lib/auth-server";
import { jsonOk, jsonError, clientMeta } from "@/lib/api";
import { writeAudit } from "@/lib/audit";
import { createVerificationAdapter } from "@nysc/verification";
import { hasPermission } from "@nysc/auth";

/**
 * POST /api/pcm/intake
 * Public self-service OR staff-assisted.
 * QR mode accepts real NYSC CorpMemberVerify.aspx URLs and fills identity from the page.
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

    const verified = await adapter.verify(input);

    const needsCompletion =
      verified.fullName === "PENDING_VERIFICATION" ||
      verified.callUpNumber.startsWith("PENDING-");

    if (needsCompletion && mode === "qr" && !body.data?.fullName) {
      return jsonOk({
        status: "needs_completion",
        partial: {
          callUpNumber: verified.callUpNumber.startsWith("PENDING-")
            ? ""
            : verified.callUpNumber,
          verificationUrl:
            verified.raw && typeof verified.raw === "object"
              ? (verified.raw as { verificationUrl?: string }).verificationUrl
              : undefined,
          source: verified.source,
        },
        message:
          "QR scanned. Confirm call-up number and full name from your call-up letter to finish registration.",
      });
    }

    const callUpNumber = String(
      body.data?.callUpNumber || verified.callUpNumber
    ).trim();
    const fullName = String(body.data?.fullName || verified.fullName).trim();
    if (!callUpNumber || !fullName || fullName === "PENDING_VERIFICATION") {
      return jsonError("callUpNumber and fullName are required");
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
              ...verified.raw,
              source: verified.source,
              deploymentState: verified.deploymentState,
              campAddress: verified.campAddress,
              batchYear: verified.batchYear,
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
          photographUrl: pcm.photographUrl ? "[photo stored]" : null,
        },
      },
      201
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : "Intake failed";
    console.error("pcm intake", e);
    return jsonError(message, 400);
  }
}
