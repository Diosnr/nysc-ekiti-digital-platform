import { rotateRefreshToken } from "@/lib/auth-server";
import { jsonOk, jsonError, clientMeta } from "@/lib/api";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const refreshToken = String(body.refreshToken ?? "");
    if (!refreshToken) return jsonError("refreshToken required");

    const meta = clientMeta(req);
    const tokens = await rotateRefreshToken(refreshToken, meta);

    return jsonOk({
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user: tokens.user,
      roles: tokens.roles,
      permissions: tokens.permissions,
    });
  } catch {
    return jsonError("Invalid refresh token", 401);
  }
}
