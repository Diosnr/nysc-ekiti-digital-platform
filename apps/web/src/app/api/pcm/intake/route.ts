import { prisma } from "@/lib/db";
import { getBearerPayload } from "@/lib/auth-server";
import { jsonOk, jsonError, clientMeta } from "@/lib/api";
import { writeAudit } from "@/lib/audit";
import { createVerificationAdapter } from "@nysc/verification";
import { hasPermission } from "@nysc/auth";

/**
 * POST /api/pcm/intake
 *
 * Public self-service (PCM) OR staff-assisted.
 * - mode: "manual" | "qr"
 * - Staff may send Authorization bearer (preferred for audit actor)
 * - Self-service works without auth for creating a new PCM from call-up
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const mode = (body.mode as string) === "qr" ? "qr" : "manual";
    const payload = await getBearerPayload(req.headers.get("authorization"));

    // If authenticated, require intake permission; public self-service allowed without token
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

    // Pending placeholder names must be completed before finalizing
    const needsCompletion =
      verified.fullName === "PENDING_VERIFICATION" ||
      verified.callUpNumber.startsWith("PENDING-");

    if (needsCompletion && mode === "qr" && !body.data?.fullName) {
      // Return partial so the self-service UI can ask for remaining fields
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

    // Merge manual completion fields if provided with QR scan
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
        stateCode: body.data?.stateCode || verified.stateCode,
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
            rawJson: JSON.stringify(verified.raw ?? verified),
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

    return jsonOk({ status: "created", pcm }, 201);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Intake failed";
    console.error("pcm intake", e);
    return jsonError(message, 400);
  }
}
