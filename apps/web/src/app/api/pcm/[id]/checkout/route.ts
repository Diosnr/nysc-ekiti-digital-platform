import { prisma } from "@/lib/db";
import { requireAnyAuth, jsonOk, jsonError, clientMeta } from "@/lib/api";
import { writeAudit } from "@/lib/audit";
import { evaluateCheckoutEligibility } from "@/lib/dates";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Params) {
  const auth = await requireAnyAuth(req, ["security:checkin", "pcm:update"]);
  if (auth instanceof Response) return auth;

  const { id } = await params;
  const pcm = await prisma.pcm.findUnique({ where: { id } });
  if (!pcm) return jsonError("PCM not found", 404);

  if (pcm.status === "CHECKED_OUT") {
    return jsonOk({ pcm, message: "Already checked out" });
  }

  const eligibility = evaluateCheckoutEligibility(pcm);
  if (!eligibility.canCheckout) {
    return jsonError(eligibility.message, 400);
  }

  let body: {
    exitReason?: string;
    exitDestinationState?: string;
  } = {};
  try {
    body = await req.json();
  } catch {
    /* optional body */
  }

  const exitReason = String(body.exitReason ?? "").trim();
  const exitDestinationState = String(body.exitDestinationState ?? "").trim();
  if (!exitReason) return jsonError("Reason for exit is required");
  if (!exitDestinationState) return jsonError("Destination state is required");

  const checkedOutAt = new Date();
  const updated = await prisma.pcm.update({
    where: { id },
    data: {
      status: "CHECKED_OUT",
      exitReason,
      exitDestinationState,
      checkedOutAt,
    },
  });

  const meta = clientMeta(req);
  await writeAudit({
    actorId: auth.payload.sub,
    actorEmail: auth.payload.email,
    actorRoleAtTime: auth.payload.roles.join(","),
    action: "pcm.security.checkout",
    entityType: "Pcm",
    entityId: id,
    pcmId: id,
    before: { status: pcm.status },
    after: {
      status: updated.status,
      exitReason,
      exitDestinationState,
      checkedOutAt: checkedOutAt.toISOString(),
      eligibility: eligibility.reason,
    },
    ip: meta.ip,
    userAgent: meta.userAgent,
  });

  return jsonOk({ pcm: updated, eligibility });
}
