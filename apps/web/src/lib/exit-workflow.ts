/** Camp exit grounds and approval chain helpers */

export const EXIT_GROUNDS = [
  { value: "MARITAL", label: "Marital grounds" },
  { value: "MEDICAL", label: "Medical grounds" },
  { value: "TERRORISM", label: "Terrorism grounds" },
] as const;

export type ExitGround = (typeof EXIT_GROUNDS)[number]["value"];

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

export function groundLabel(g: string): string {
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

export function firstStageAfterInitiation(ground: ExitGround): ExitStage {
  return ground === "MEDICAL" ? "AWAITING_CLINIC" : "AWAITING_CAMP_DIRECTOR";
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

/** Platoon officers (or camp:exit:initiate) may start an exit request. */
export function canInitiateExit(roles: string[], permissions: string[]): boolean {
  if (permissions.includes("*") || permissions.includes("camp:exit:initiate")) {
    return true;
  }
  return isPlatoonRole(roles);
}

/** Nav / page access to camp exit desk (initiate or approve). */
export function canAccessExitDesk(roles: string[], permissions: string[]): boolean {
  if (
    permissions.includes("*") ||
    permissions.includes("camp:exeat") ||
    permissions.includes("camp:exit:initiate") ||
    permissions.includes("camp:clinic")
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
        x.includes("head of clinic")
    )
  );
}

/**
 * Who may Approve/Reject at the current open stage.
 * Never true for APPROVED / REJECTED / CANCELLED.
 */
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
  _ground: ExitGround
): ExitStage {
  if (current === "AWAITING_CLINIC") return "AWAITING_CAMP_DIRECTOR";
  if (current === "AWAITING_CAMP_DIRECTOR") return "AWAITING_STATE_COORDINATOR";
  if (current === "AWAITING_STATE_COORDINATOR") return "APPROVED";
  return current;
}
