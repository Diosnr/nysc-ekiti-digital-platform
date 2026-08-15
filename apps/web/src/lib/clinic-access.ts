/** Clinic / patient data access — classified. Server must enforce, not only UI. */

export function hasClinicAccess(roles: string[], permissions: string[]): boolean {
  if (permissions.includes("*") || permissions.includes("camp:clinic")) return true;
  const r = roles.map((x) => x.toLowerCase());
  return r.some(
    (x) =>
      x.includes("head of clinic") ||
      x.includes("camp doctor") ||
      x.includes("camp nurse") ||
      x.includes("camp pharmacist") ||
      x === "clinic"
  );
}

export function isClinicNurse(roles: string[]): boolean {
  return roles.some((r) => r.toLowerCase().includes("nurse"));
}

export function isClinicDoctor(roles: string[]): boolean {
  return roles.some(
    (r) =>
      r.toLowerCase().includes("doctor") ||
      r.toLowerCase().includes("head of clinic")
  );
}

export function isClinicPharmacist(roles: string[]): boolean {
  return roles.some((r) => r.toLowerCase().includes("pharmacist"));
}

export function isClinicOnly(roles: string[], permissions: string[]): boolean {
  if (!hasClinicAccess(roles, permissions)) return false;
  if (permissions.includes("*")) return false;
  if (roles.some((r) => r.toLowerCase() === "super admin")) return false;
  const ops = roles.some((r) =>
    [
      "security officer",
      "registration officer",
      "state coordinator",
      "camp director",
      "platoon",
      "bank account",
      "pro",
      "accommodation",
    ].some((k) => r.toLowerCase().includes(k))
  );
  return !ops;
}
