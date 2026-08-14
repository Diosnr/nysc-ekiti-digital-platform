/**
 * State code format e.g. EK/26B/0368 — last digit is platoon 1–10.
 * Digit 0 → Platoon 10; digits 1–9 → Platoon 1–9.
 */
export function platoonFromStateCode(stateCode: string | null | undefined): string | null {
  if (!stateCode) return null;
  const digits = stateCode.replace(/\D/g, "");
  if (!digits.length) return null;
  const last = digits[digits.length - 1];
  if (last === "0") return "10";
  if (last >= "1" && last <= "9") return last;
  return null;
}

export function platoonLabel(code: string | null | undefined): string {
  if (!code) return "—";
  return `Platoon ${code}`;
}
