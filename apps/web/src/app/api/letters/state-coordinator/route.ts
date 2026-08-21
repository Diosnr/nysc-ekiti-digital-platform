import { prisma } from "@/lib/db";
import { jsonOk, jsonError } from "@/lib/api";
import { getBearerPayload } from "@/lib/auth-server";
import { getCmBearerPayload } from "@/lib/cm-auth";

/**
 * Resolve the State Coordinator (or grantor) for official letter signatures.
 * Accepts staff Bearer OR corps-member Bearer (so CM can download signed exit letters).
 * Prefers an active user with role "State Coordinator" who has uploaded signatureUrl.
 */
export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  const staff = await getBearerPayload(authHeader);
  const cm = staff ? null : await getCmBearerPayload(authHeader);

  if (!staff && !cm) {
    return jsonError("Unauthorized", 401);
  }

  try {
    // Prefer active State Coordinator with a signature on file
    const withSig = await prisma.user.findFirst({
      where: {
        isActive: true,
        signatureUrl: { not: null },
        roles: {
          some: {
            role: {
              name: { equals: "State Coordinator", mode: "insensitive" },
              isActive: true,
            },
          },
        },
      },
      select: {
        id: true,
        name: true,
        rank: true,
        post: true,
        signatureUrl: true,
      },
      orderBy: { updatedAt: "desc" },
    });

    if (withSig?.signatureUrl) {
      return jsonOk({
        signer: {
          name: withSig.name,
          rank: withSig.rank,
          post: withSig.post || "State Coordinator, NYSC Ekiti State",
          signatureUrl: withSig.signatureUrl,
        },
      });
    }

    // Fallback: any State Coordinator (even without signature image yet)
    const anyCoord = await prisma.user.findFirst({
      where: {
        isActive: true,
        roles: {
          some: {
            role: {
              name: { equals: "State Coordinator", mode: "insensitive" },
              isActive: true,
            },
          },
        },
      },
      select: {
        name: true,
        rank: true,
        post: true,
        signatureUrl: true,
      },
      orderBy: { updatedAt: "desc" },
    });

    if (anyCoord) {
      return jsonOk({
        signer: {
          name: anyCoord.name,
          rank: anyCoord.rank,
          post: anyCoord.post || "State Coordinator, NYSC Ekiti State",
          signatureUrl: anyCoord.signatureUrl,
        },
      });
    }

    return jsonOk({
      signer: {
        name: "State Coordinator",
        rank: null,
        post: "State Coordinator, NYSC Ekiti State",
        signatureUrl: null,
      },
    });
  } catch (e) {
    console.error("state-coordinator letter signer", e);
    return jsonError("Could not resolve signer", 500);
  }
}
