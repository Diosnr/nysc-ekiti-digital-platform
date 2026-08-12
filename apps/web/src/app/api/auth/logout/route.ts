import { revokeRefreshToken, getBearerPayload } from "@/lib/auth-server";
import { writeAudit } from "@/lib/audit";
import { jsonOk, jsonError, clientMeta } from "@/lib/api";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const refreshToken = String((body as { refreshToken?: string }).refreshToken ?? "");
    if (refreshToken) {
      await revokeRefreshToken(refreshToken);
    }

    const payload = await getBearerPayload(req.headers.get("authorization"));
    const meta = clientMeta(req);
    if (payload) {
      await writeAudit({
        actorId: payload.sub,
        actorEmail: payload.email,
        actorRoleAtTime: payload.roles.join(","),
        action: "auth.logout",
        entityType: "User",
        entityId: payload.sub,
        ip: meta.ip,
        userAgent: meta.userAgent,
      });
    }

    return jsonOk({ ok: true });
  } catch {
    return jsonError("Logout failed", 500);
  }
}
