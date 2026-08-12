/**
 * Geographic scope helpers for LGI / ZI data queries.
 * Scope is enforced on the server — never only in the UI.
 *
 * Convention:
 * - User.lgaCode set → restrict to that LGA when role implies LGI-style access
 * - User.zoneCode set → restrict to that zone when role implies ZI-style access
 * - Neither / HQ roles → no geographic filter from this helper
 */

import type { AccessTokenPayload } from "@nysc/auth";

export type GeoScope = {
  lgaCode?: string;
  zoneCode?: string;
  unrestricted: boolean;
};

const UNRESTRICTED_ROLE_HINTS = [
  "super admin",
  "state coordinator",
  "camp director",
  "head cim",
  "registry",
];

export function resolveGeoScope(
  payload: AccessTokenPayload,
  profile?: { lgaCode?: string | null; zoneCode?: string | null }
): GeoScope {
  const rolesLower = payload.roles.map((r) => r.toLowerCase());
  const isUnrestricted =
    payload.permissions.includes("*") ||
    rolesLower.some((r) => UNRESTRICTED_ROLE_HINTS.some((h) => r.includes(h)));

  if (isUnrestricted) {
    return { unrestricted: true };
  }

  const lgaCode = profile?.lgaCode ?? undefined;
  const zoneCode = profile?.zoneCode ?? undefined;

  // Prefer tighter LGA scope when present
  if (lgaCode) {
    return { unrestricted: false, lgaCode };
  }
  if (zoneCode) {
    return { unrestricted: false, zoneCode };
  }

  // No scope fields: deny-all for scoped roles is safer than show-all.
  // Callers should treat unrestricted:false with no codes as empty result set.
  return { unrestricted: false };
}

/**
 * Build a Prisma-compatible where fragment for PCM (or any entity with lgaCode/zoneCode).
 * Usage: where: { AND: [..., pcmScopeWhere(scope)] }
 */
export function pcmScopeWhere(scope: GeoScope): Record<string, unknown> {
  if (scope.unrestricted) return {};
  if (scope.lgaCode) return { lgaCode: scope.lgaCode };
  if (scope.zoneCode) return { zoneCode: scope.zoneCode };
  // Scoped user without codes → match nothing
  return { id: "__none__" };
}
