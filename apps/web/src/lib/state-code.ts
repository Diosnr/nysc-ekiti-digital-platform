/**
 * NYSC state code (corps member code) — not deployment state name.
 *
 * Format (Ekiti): EK / last-2-digits-of-year + Batch letter / serial
 * Example: EK/26B/0367
 *
 * "Ekiti", "EKITI", bare "EK" are NOT state codes.
 */

/** Case-insensitive: XX/yyL/nnnn… e.g. EK/26B/0367 */
export const STATE_CODE_PATTERN =
  /^[A-Za-z]{2}\/\d{2}[A-Za-z]\/\d{1,6}$/;

export function normalizeStateCode(raw: string | null | undefined): string {
  if (raw == null) return "";
  return String(raw)
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "")
    .replace(/-/g, "/");
}

export function isValidStateCode(raw: string | null | undefined): boolean {
  const n = normalizeStateCode(raw);
  if (!n) return false;
  return STATE_CODE_PATTERN.test(n);
}

/**
 * Returns a normalized valid state code, or null if input is missing/invalid.
 * Rejects deployment state names like "Ekiti".
 */
export function toStoredStateCode(
  raw: string | null | undefined
): string | null {
  const n = normalizeStateCode(raw);
  if (!n) return null;
  if (!STATE_CODE_PATTERN.test(n)) return null;
  return n;
}

/** True if value looks like a state *name* or other non-code junk. */
export function looksLikeStateNameNotCode(
  raw: string | null | undefined
): boolean {
  if (raw == null || !String(raw).trim()) return false;
  const n = normalizeStateCode(raw);
  if (isValidStateCode(n)) return false;
  // has no slash path → almost certainly a name
  if (!n.includes("/")) return true;
  return !STATE_CODE_PATTERN.test(n);
}
