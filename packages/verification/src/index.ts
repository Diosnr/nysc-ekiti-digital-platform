/**
 * NYSC Call-up Verification Adapter
 * Isolation boundary — domain code depends only on this interface.
 */

export interface VerifiedCallUpData {
  callUpNumber: string;
  fullName: string;
  gender?: string;
  institution?: string;
  course?: string;
  photographUrl?: string;
  stateCode?: string;
  dateOfBirth?: string;
  raw?: Record<string, unknown>;
  verifiedAt: Date;
  source: "manual" | "scraping" | "official_api";
}

export interface CallUpVerificationAdapter {
  verify(input: string): Promise<VerifiedCallUpData>;
}

/**
 * Manual adapter: input is JSON string of VerifiedCallUpData fields
 * (used for official-assisted / manual fallback intake).
 */
export class ManualVerificationAdapter implements CallUpVerificationAdapter {
  async verify(input: string): Promise<VerifiedCallUpData> {
    let data: Record<string, unknown>;
    try {
      data = JSON.parse(input);
    } catch {
      throw new Error(
        "Manual verification requires a JSON payload with callUpNumber and fullName"
      );
    }
    const callUpNumber = String(data.callUpNumber ?? "").trim();
    const fullName = String(data.fullName ?? "").trim();
    if (!callUpNumber || !fullName) {
      throw new Error("callUpNumber and fullName are required");
    }
    return {
      callUpNumber,
      fullName,
      gender: data.gender ? String(data.gender) : undefined,
      institution: data.institution ? String(data.institution) : undefined,
      course: data.course ? String(data.course) : undefined,
      photographUrl: data.photographUrl ? String(data.photographUrl) : undefined,
      stateCode: data.stateCode ? String(data.stateCode) : undefined,
      dateOfBirth: data.dateOfBirth ? String(data.dateOfBirth) : undefined,
      raw: data,
      verifiedAt: new Date(),
      source: "manual",
    };
  }
}

/**
 * Placeholder for future QR URL fetch / official API.
 * Does not scrape; documents authorization dependency.
 */
export class UnauthorizedRemoteAdapter implements CallUpVerificationAdapter {
  async verify(_input: string): Promise<VerifiedCallUpData> {
    throw new Error(
      "Remote NYSC verification is not authorized/configured. Use manual intake or set VERIFICATION_ADAPTER when approved."
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
      return new UnauthorizedRemoteAdapter();
    default:
      return new ManualVerificationAdapter();
  }
}
