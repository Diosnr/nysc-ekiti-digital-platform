import { jsonOk, jsonError } from "@/lib/api";
import { lgasForState, NIGERIA_STATES } from "@/lib/nigeria";

/** Public: LGAs for a Nigerian state. */
export async function GET(req: Request) {
  const state = new URL(req.url).searchParams.get("state")?.trim();
  if (!state) {
    return jsonOk({ states: [...NIGERIA_STATES], lgas: [] });
  }
  const lgas = lgasForState(state);
  if (!lgas.length) {
    return jsonError(`No LGA list for state: ${state}`, 404);
  }
  return jsonOk({ state, lgas });
}
