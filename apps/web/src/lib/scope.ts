/**
 * Geographic scope helpers for LGI / ZI data queries.
 * Scope is enforced on the server — never only in the UI.
 *
 * Convention:
 * - User.lgaCode set → restrict to that LGA when role implies LGI-style access
 * - User.zoneCode set → restrict to that zone when role implies ZI-style access
 * - Camp / HQ / security roles → unrestricted (state-wide camp operations)
 * - Neither for LGI/ZI without codes → match nothing (safe default)
 */

import type { AccessTokenPayload } from "@nysc/auth";

export type GeoScope = {
  lgaCode?: string;
  zoneCode?: string;
  unrestricted: boolean;
};

/** Roles that see all PCMs in the state (camp + secretariat), not LGA-filtered. */
const UNRESTRICTED_ROLE_HINTS = [
  "super admin",
  "state coordinator",
  "camp director",
  "head cim",
  "registry",
  "security officer",
  "registration officer",
  "accommodation officer",
  "platoon officer",
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

  if (lgaCode) {
    return { unrestricted: false, lgaCode };
  }
  if (zoneCode) {
    return { unrestricted: false, zoneCode };
  }

  // Scoped role (e.g. LGI) without codes → empty result set
  return { unrestricted: false };
}

export function pcmScopeWhere(scope: GeoScope): Record<string, unknown> {
  if (scope.unrestricted) return {};
  if (scope.lgaCode) return { lgaCode: scope.lgaCode };
  if (scope.zoneCode) return { zoneCode: scope.zoneCode };
  return { id: "__none__" };
}
