/**
 * NYSC Call-up Verification Adapter
 *
 * Domain code depends only on this interface.
 * - Build the QR + intake UX fully.
 * - Remote fetch is gated by VERIFICATION_ADAPTER / authorization config,
 *   not by removing the product feature.
 * - Manual entry is always available as fallback.
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
  phone?: string;
  email?: string;
  raw?: Record<string, unknown>;
  verifiedAt: Date;
  source: "manual" | "qr_payload" | "scraping" | "official_api";
}

export interface CallUpVerificationAdapter {
  verify(input: string): Promise<VerifiedCallUpData>;
}

function requireFields(data: Record<string, unknown>): {
  callUpNumber: string;
  fullName: string;
} {
  const callUpNumber = String(data.callUpNumber ?? data.callup ?? data.stateCode ?? "").trim();
  const fullName = String(data.fullName ?? data.name ?? "").trim();
  if (!callUpNumber || !fullName) {
    throw new Error("callUpNumber and fullName are required");
  }
  return { callUpNumber, fullName };
}

function mapFields(
  data: Record<string, unknown>,
  source: VerifiedCallUpData["source"]
): VerifiedCallUpData {
  const { callUpNumber, fullName } = requireFields(data);
  return {
    callUpNumber,
    fullName,
    gender: data.gender ? String(data.gender) : undefined,
    institution: data.institution ? String(data.institution) : undefined,
    course: data.course ? String(data.course) : undefined,
    photographUrl: data.photographUrl
      ? String(data.photographUrl)
      : data.photo
        ? String(data.photo)
        : undefined,
    stateCode: data.stateCode ? String(data.stateCode) : undefined,
    dateOfBirth: data.dateOfBirth ? String(data.dateOfBirth) : undefined,
    phone: data.phone ? String(data.phone) : undefined,
    email: data.email ? String(data.email) : undefined,
    raw: data,
    verifiedAt: new Date(),
    source,
  };
}

/** Manual JSON / form payload */
export class ManualVerificationAdapter implements CallUpVerificationAdapter {
  async verify(input: string): Promise<VerifiedCallUpData> {
    let data: Record<string, unknown>;
    try {
      data = JSON.parse(input);
    } catch {
      throw new Error("Manual verification requires JSON with callUpNumber and fullName");
    }
    return mapFields(data, "manual");
  }
}

/**
 * QR payload adapter.
 * Accepts:
 * - JSON embedded in QR
 * - URL string (if VERIFICATION_ADAPTER allows remote, fetches/parses; else extracts what it can)
 */
export class QrPayloadAdapter implements CallUpVerificationAdapter {
  constructor(private allowRemote: boolean) {}

  async verify(input: string): Promise<VerifiedCallUpData> {
    const trimmed = input.trim();

    // 1) Direct JSON in QR
    if (trimmed.startsWith("{")) {
      const data = JSON.parse(trimmed) as Record<string, unknown>;
      return mapFields(data, "qr_payload");
    }

    // 2) URL from call-up letter QR
    if (/^https?:\/\//i.test(trimmed)) {
      if (this.allowRemote) {
        // Authorized/configured remote path — fetch and normalize.
        // Implementation is deliberately thin until official field mapping is confirmed.
        const res = await fetch(trimmed, {
          headers: { Accept: "application/json, text/html" },
          redirect: "follow",
        });
        if (!res.ok) {
          throw new Error(`Verification URL returned HTTP ${res.status}`);
        }
        const contentType = res.headers.get("content-type") ?? "";
        if (contentType.includes("application/json")) {
          const data = (await res.json()) as Record<string, unknown>;
          return mapFields(data, "official_api");
        }
        // HTML page: without approved parse rules we cannot invent fields.
        // Surface a clear message so operator can complete via manual fallback.
        throw new Error(
          "Verification URL returned a page. Configure an official field mapper or use manual entry with the call-up details."
        );
      }

      // Remote not enabled: still accept the scan — operator completes identity manually
      // using the call-up number if present in the URL, otherwise full manual form.
      const url = new URL(trimmed);
      const guess =
        url.searchParams.get("callup") ||
        url.searchParams.get("callUpNumber") ||
        url.searchParams.get("id") ||
        "";
      return {
        callUpNumber: guess || `PENDING-${Date.now()}`,
        fullName: "PENDING_VERIFICATION",
        raw: { verificationUrl: trimmed, note: "Remote fetch not enabled" },
        verifiedAt: new Date(),
        source: "qr_payload",
      };
    }

    // 3) Plain call-up string in QR
    if (trimmed.length >= 4) {
      return {
        callUpNumber: trimmed,
        fullName: "PENDING_VERIFICATION",
        raw: { plain: trimmed },
        verifiedAt: new Date(),
        source: "qr_payload",
      };
    }

    throw new Error("Unrecognized QR payload. Enter details manually.");
  }
}

export function createVerificationAdapter(
  mode: "manual" | "qr" | "scraping" | "official_api" = "manual"
): CallUpVerificationAdapter {
  const remoteFlag = process.env.VERIFICATION_ADAPTER;
  const allowRemote =
    remoteFlag === "scraping" ||
    remoteFlag === "official_api" ||
    process.env.VERIFICATION_ALLOW_REMOTE === "true";

  switch (mode) {
    case "manual":
      return new ManualVerificationAdapter();
    case "qr":
      return new QrPayloadAdapter(allowRemote);
    case "scraping":
    case "official_api":
      return new QrPayloadAdapter(true);
    default:
      return new ManualVerificationAdapter();
  }
}
