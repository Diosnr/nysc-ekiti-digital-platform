/** Format Date or yyyy-mm-dd as "05 Aug 2026" */
export function formatReportingDate(value: string | Date): string {
  const d =
    value instanceof Date
      ? value
      : new Date(value.includes("T") ? value : value + "T12:00:00");
  if (Number.isNaN(d.getTime())) return String(value);
  const day = String(d.getDate()).padStart(2, "0");
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  return `${day} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

/** Parse "05 Aug 2026" or ISO to yyyy-mm-dd for <input type="date"> */
export function toDateInputValue(value: string): string {
  if (!value) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Parse reporting date strings used on PCM records. */
export function parseReportingDate(value: string | null | undefined): Date | null {
  if (!value?.trim()) return null;
  const v = value.trim();
  // yyyy-mm-dd
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) {
    const d = new Date(v + "T12:00:00");
    return Number.isNaN(d.getTime()) ? null : d;
  }
  // 05 Aug 2026 / 5 August 2026
  const m = v.match(
    /^(\d{1,2})\s+([A-Za-z]{3,9})\s+(\d{4})$/
  );
  if (m) {
    const months: Record<string, number> = {
      jan: 0,
      january: 0,
      feb: 1,
      february: 1,
      mar: 2,
      march: 2,
      apr: 3,
      april: 3,
      may: 4,
      jun: 5,
      june: 5,
      jul: 6,
      july: 6,
      aug: 7,
      august: 7,
      sep: 8,
      sept: 8,
      september: 8,
      oct: 9,
      october: 9,
      nov: 10,
      november: 10,
      dec: 11,
      december: 11,
    };
    const mi = months[m[2].toLowerCase()];
    if (mi === undefined) return null;
    const d = new Date(Number(m[3]), mi, Number(m[1]), 12, 0, 0);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

const CAMP_WEEKS = 3;

/**
 * Checkout is allowed when:
 * 1. An administrator granted camp exit (campExitGrantedAt set), OR
 * 2. 3 weeks have elapsed since date of reporting.
 * In-camp statuses include CHECKED_IN, CAMP_ACTIVE, and related lifecycle states.
 */
export function evaluateCheckoutEligibility(pcm: {
  status?: string | null;
  dateReporting?: string | null;
  campExitGrantedAt?: string | Date | null;
}): {
  canCheckout: boolean;
  reason: "exit_granted" | "camp_completed" | "not_checked_in" | "not_eligible";
  message: string;
  eligibleFrom?: string;
} {
  const st = pcm.status ?? "";
  const inCamp = [
    "CHECKED_IN",
    "CAMP_ACTIVE",
    "ACCOMMODATED",
    "PLATOON_ASSIGNED",
    "KIT_ISSUED",
    "BANK_REGISTERED",
    "CAMP_EXIT_REQUESTED",
    "REGISTERED",
  ].includes(st);

  if (st === "CHECKED_OUT" || st === "CAMP_EXITED") {
    return {
      canCheckout: false,
      reason: "not_checked_in",
      message: "Member is already checked out.",
    };
  }

  if (!inCamp && st !== "VERIFIED" && st !== "MOBILISED") {
    return {
      canCheckout: false,
      reason: "not_checked_in",
      message: "Member must be on the camp roll (checked in) before checkout.",
    };
  }

  // Exit grant allows checkout even if still marked VERIFIED (edge) or any in-camp status
  if (pcm.campExitGrantedAt) {
    return {
      canCheckout: true,
      reason: "exit_granted",
      message: "Exit granted — security may check out this member.",
    };
  }

  if (!inCamp) {
    return {
      canCheckout: false,
      reason: "not_checked_in",
      message: "Member must be checked in before checkout.",
    };
  }

  const reported = parseReportingDate(pcm.dateReporting ?? undefined);
  if (reported) {
    const eligible = new Date(reported.getTime());
    eligible.setDate(eligible.getDate() + CAMP_WEEKS * 7);
    if (Date.now() >= eligible.getTime()) {
      return {
        canCheckout: true,
        reason: "camp_completed",
        message: `Camp duration met (${CAMP_WEEKS} weeks from reporting date).`,
        eligibleFrom: formatReportingDate(eligible),
      };
    }
    return {
      canCheckout: false,
      reason: "not_eligible",
      message: `Checkout opens after ${CAMP_WEEKS} weeks from reporting (${formatReportingDate(reported)}), or when exit is granted by an administrator.`,
      eligibleFrom: formatReportingDate(eligible),
    };
  }

  return {
    canCheckout: false,
    reason: "not_eligible",
    message:
      "No reporting date on file. Checkout requires administrator exit grant, or a reporting date plus 3 weeks.",
  };
}
