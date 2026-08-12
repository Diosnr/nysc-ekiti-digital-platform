import { loadUserAuthContext, getBearerPayload } from "@/lib/auth-server";
import { jsonOk, jsonError } from "@/lib/api";

export async function GET(req: Request) {
  const payload = await getBearerPayload(req.headers.get("authorization"));
  if (!payload) return jsonError("Unauthorized", 401);

  const ctx = await loadUserAuthContext(payload.sub);
  if (!ctx) return jsonError("Unauthorized", 401);

  return jsonOk(ctx);
}
