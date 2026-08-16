/** Bank / account desk access — sensitive NIN + bank details. */

export function hasBankAccess(roles: string[], permissions: string[]): boolean {
  if (
    permissions.includes("*") ||
    permissions.includes("bank:register") ||
    permissions.includes("bank:update")
  ) {
    return true;
  }
  return roles.some(
    (r) =>
      r.toLowerCase().includes("bank account") ||
      r.toLowerCase() === "bank" ||
      r.toLowerCase().includes("account officer")
  );
}

export function isBankOnly(roles: string[], permissions: string[]): boolean {
  if (!hasBankAccess(roles, permissions)) return false;
  if (permissions.includes("*")) return false;
  if (roles.some((r) => r.toLowerCase() === "super admin")) return false;
  const ops = roles.some((r) =>
    [
      "security officer",
      "registration officer",
      "state coordinator",
      "camp director",
      "platoon",
      "clinic",
      "doctor",
      "nurse",
      "pharmacist",
      "pro",
      "accommodation",
    ].some((k) => r.toLowerCase().includes(k))
  );
  return !ops;
}
