/**
 * NYSC Call-up Verification Adapter
 *
 * Isolation boundary: the rest of the system depends only on this interface.
 * Implementations (manual, scraping, official API) can be swapped without
 * rewriting PCM intake or domain logic.
 *
 * IMPORTANT: Do not assume that any automation against an NYSC endpoint is
 * authorized merely because the endpoint is technically reachable.
 * Treat authorization as an external dependency.
 */

export interface VerifiedCallUpData {
  /** Call-up / state code or equivalent unique identifier */
  callUpNumber: string;
  fullName: string;
  gender?: string;
  institution?: string;
  course?: string;
  photographUrl?: string;
  raw?: Record<string, unknown>;
  verifiedAt: Date;
  source: "manual" | "scraping" | "official_api";
}

export interface CallUpVerificationAdapter {
  /**
   * Accept a QR payload, verification URL, or manual reference and return
   * normalized verified data. Implementations must not redirect the user away
   * from the platform as part of the normal flow.
   */
  verify(input: string): Promise<VerifiedCallUpData>;
}

/**
 * Manual fallback adapter — used when automated verification is unavailable
 * or not yet authorized. Expects structured manual entry upstream.
 */
export class ManualVerificationAdapter implements CallUpVerificationAdapter {
  async verify(input: string): Promise<VerifiedCallUpData> {
    // In real use the calling service supplies already-collected fields.
    // This adapter exists to satisfy the interface and enable development.
    throw new Error(
      "ManualVerificationAdapter requires structured data from the calling service; raw string verification is not supported."
    );
  }
}

export function createVerificationAdapter(
  mode: "manual" | "scraping" | "official_api" = "manual"
): CallUpVerificationAdapter {
  switch (mode) {
    case "manual":
      return new ManualVerificationAdapter();
    case "scraping":
    case "official_api":
      // Placeholders — concrete implementations added when authorized.
      throw new Error(
        `Verification adapter mode "${mode}" is not yet implemented or authorized.`
      );
    default:
      return new ManualVerificationAdapter();
  }
}
