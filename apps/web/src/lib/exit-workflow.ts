/** Camp exit grounds and approval chain helpers */

export const EXIT_GROUNDS = [
  { value: "MARITAL", label: "Marital grounds", requiresClinic: false },
  { value: "MEDICAL", label: "Medical grounds", requiresClinic: true },
  { value: "TERRORISM", label: "Terrorism grounds", requiresClinic: false },
] as const;

export type ExitGround = string;

export type ExitStage =
  | "AWAITING_CLINIC"
  | "AWAITING_CAMP_DIRECTOR"
  | "AWAITING_STATE_COORDINATOR"
  | "APPROVED"
  | "REJECTED"
  | "CANCELLED";

export const TERMINAL_EXIT_STAGES: ExitStage[] = [
  "APPROVED",
  "REJECTED",
  "CANCELLED",
];

export function isTerminalExitStage(stage: string): boolean {
  return TERMINAL_EXIT_STAGES.includes(stage as ExitStage);
}

export function groundLabel(g: string, catalog?: { code: string; label: string }[]): string {
  if (catalog?.length) {
    const hit = catalog.find((x) => x.code === g);
    if (hit) return hit.label;
  }
  return EXIT_GROUNDS.find((x) => x.value === g)?.label ?? g;
}

export function stageLabel(s: string): string {
  const map: Record<string, string> = {
    AWAITING_CLINIC: "Pending clinic",
    AWAITING_CAMP_DIRECTOR: "Pending camp director",
    AWAITING_STATE_COORDINATOR: "Pending state coordinator",
    APPROVED: "Approved",
    REJECTED: "Rejected",
    CANCELLED: "Cancelled",
  };
  return map[s] ?? s;
}

/** Default first stage: clinic if medical / requiresClinic, else director. */
export function firstStageAfterInitiation(
  ground: string,
  requiresClinic?: boolean
): ExitStage {
  if (requiresClinic === true) return "AWAITING_CLINIC";
  if (requiresClinic === false) return "AWAITING_CAMP_DIRECTOR";
  if (ground === "MEDICAL") return "AWAITING_CLINIC";
  return "AWAITING_CAMP_DIRECTOR";
}

/** Role keywords expected at each stage (for officer picker defaults). */
export function roleHintsForStage(stage: ExitStage): string[] {
  if (stage === "AWAITING_CLINIC") {
    return ["head of clinic", "camp doctor", "camp nurse", "camp pharmacist"];
  }
  if (stage === "AWAITING_CAMP_DIRECTOR") return ["camp director"];
  if (stage === "AWAITING_STATE_COORDINATOR") return ["state coordinator"];
  return [];
}

export function stageForRoles(roles: string[]): ExitStage | null {
  const r = roles.map((x) => x.toLowerCase());
  if (r.some((x) => x.includes("super admin"))) return null;
  if (
    r.some(
      (x) =>
        x.includes("camp doctor") ||
        x.includes("camp nurse") ||
        x.includes("camp pharmacist") ||
        x.includes("head of clinic")
    )
  ) {
    return "AWAITING_CLINIC";
  }
  if (r.some((x) => x.includes("camp director"))) {
    return "AWAITING_CAMP_DIRECTOR";
  }
  if (r.some((x) => x.includes("state coordinator"))) {
    return "AWAITING_STATE_COORDINATOR";
  }
  return null;
}

function isPlatoonRole(roles: string[]): boolean {
  const r = roles.map((x) => x.toLowerCase());
  return r.some(
    (x) =>
      x.includes("platoon officer") ||
      x === "platoon" ||
      x.includes("head of platoon")
  );
}

export function canInitiateExit(roles: string[], permissions: string[]): boolean {
  if (permissions.includes("*") || permissions.includes("camp:exit:initiate")) {
    return true;
  }
  return isPlatoonRole(roles);
}

export function canAccessExitDesk(roles: string[], permissions: string[]): boolean {
  if (
    permissions.includes("*") ||
    permissions.includes("camp:exeat") ||
    permissions.includes("camp:exit:initiate") ||
    permissions.includes("camp:clinic") ||
    permissions.includes("file:create") ||
    permissions.includes("file:forward")
  ) {
    return true;
  }
  const r = roles.map((x) => x.toLowerCase());
  return (
    isPlatoonRole(roles) ||
    r.some(
      (x) =>
        x.includes("state coordinator") ||
        x.includes("camp director") ||
        x.includes("camp doctor") ||
        x.includes("camp nurse") ||
        x.includes("camp pharmacist") ||
        x.includes("head of clinic") ||
        x.includes("lgi") ||
        x.includes("zonal") ||
        x.includes("head cim") ||
        x.includes("registry")
    )
  );
}

export function canActOnStage(
  stage: ExitStage,
  roles: string[],
  permissions: string[]
): boolean {
  if (isTerminalExitStage(stage)) return false;

  if (permissions.includes("*")) return true;
  const r = roles.map((x) => x.toLowerCase());
  if (r.some((x) => x.includes("super admin"))) return true;

  if (stage === "AWAITING_CLINIC") {
    return r.some(
      (x) =>
        x.includes("camp doctor") ||
        x.includes("camp nurse") ||
        x.includes("camp pharmacist") ||
        x.includes("head of clinic")
    );
  }
  if (stage === "AWAITING_CAMP_DIRECTOR") {
    return r.some((x) => x.includes("camp director"));
  }
  if (stage === "AWAITING_STATE_COORDINATOR") {
    return (
      r.some((x) => x.includes("state coordinator")) ||
      permissions.includes("camp:exeat")
    );
  }
  return false;
}

export function nextStageAfterApprove(
  current: ExitStage,
  _ground?: string
): ExitStage {
  if (current === "AWAITING_CLINIC") return "AWAITING_CAMP_DIRECTOR";
  if (current === "AWAITING_CAMP_DIRECTOR") return "AWAITING_STATE_COORDINATOR";
  if (current === "AWAITING_STATE_COORDINATOR") return "APPROVED";
  return current;
}
