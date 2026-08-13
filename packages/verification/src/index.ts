/**
 * NYSC Call-up Verification Adapter
 *
 * Real call-up letter QR codes encode URLs like:
 * https://mgt.nysc.org.ng/verify/CorpMemberVerify.aspx?svc=callup&callup=<token>
 *
 * The public verification page returns HTML with authenticated fields.
 * We fetch that page server-side and normalize fields so the PCM never
 * leaves the NYSC Ekiti platform.
 */

export interface VerifiedCallUpData {
  callUpNumber: string;
  fullName: string;
  gender?: string;
  institution?: string;
  course?: string;
  photographUrl?: string;
  stateCode?: string;
  deploymentState?: string;
  campAddress?: string;
  batchYear?: string;
  dateReporting?: string;
  dateOfBirth?: string;
  phone?: string;
  email?: string;
  raw?: Record<string, unknown>;
  verifiedAt: Date;
  source: "manual" | "qr_payload" | "nysc_verify_page" | "official_api";
}

export interface CallUpVerificationAdapter {
  verify(input: string): Promise<VerifiedCallUpData>;
}

function requireFields(data: Record<string, unknown>): {
  callUpNumber: string;
  fullName: string;
} {
  const callUpNumber = String(
    data.callUpNumber ?? data.callup ?? data.stateCode ?? ""
  ).trim();
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
    deploymentState: data.deploymentState
      ? String(data.deploymentState)
      : undefined,
    campAddress: data.campAddress ? String(data.campAddress) : undefined,
    batchYear: data.batchYear ? String(data.batchYear) : undefined,
    dateReporting: data.dateReporting ? String(data.dateReporting) : undefined,
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
      throw new Error(
        "Manual verification requires JSON with callUpNumber and fullName"
      );
    }
    return mapFields(data, "manual");
  }
}

/**
 * Parse the official NYSC CorpMemberVerify.aspx HTML.
 * Label/value pairs appear as consecutive text nodes after stripping tags.
 */
export function parseNyscVerifyHtml(html: string): Record<string, string> {
  const withoutScripts = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ");

  // Photograph: prefer corps member photo (large data URI), skip tiny logos
  const imgMatch = withoutScripts.match(
    /<img[^>]+src=["'](data:image\/(?:jpeg|jpg|png|webp);base64,[A-Za-z0-9+/=]+)["']/i
  );
  const photographUrl = imgMatch?.[1];

  const plain = withoutScripts
    .replace(/<[^>]+>/g, "\n")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&#\d+;/g, " ");
  const lines = plain
    .split("\n")
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter(Boolean);

  const out: Record<string, string> = {};
  if (photographUrl) out.photographUrl = photographUrl;

  const labelMap: Record<string, string> = {
    "full name": "fullName",
    "call-up number": "callUpNumber",
    "call up number": "callUpNumber",
    gender: "gender",
    institution: "institution",
    course: "course",
    "state of deployment": "deploymentState",
    "camp address": "campAddress",
    "date reporting": "dateReporting",
    "batch / year": "batchYear",
    "batch/year": "batchYear",
  };

  for (let i = 0; i < lines.length - 1; i++) {
    const key = labelMap[lines[i].toLowerCase()];
    if (key && !out[key]) {
      const value = lines[i + 1];
      // skip if next line is another known label
      if (!labelMap[value.toLowerCase()]) {
        out[key] = value;
      }
    }
  }

  // Authenticated banner check (soft)
  const authenticated =
    /call-up letter has been authenticated/i.test(plain) ||
    /\bVerified\b/i.test(plain);
  out._authenticated = authenticated ? "true" : "false";

  return out;
}

function isNyscVerifyUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return (
      /nysc\.org\.ng$/i.test(u.hostname) &&
      /CorpMemberVerify\.aspx/i.test(u.pathname)
    );
  } catch {
    return false;
  }
}

/**
 * QR / URL adapter — handles real NYSC verification links by default.
 */
export class QrPayloadAdapter implements CallUpVerificationAdapter {
  constructor(private allowGenericRemote: boolean) {}

  async verify(input: string): Promise<VerifiedCallUpData> {
    const trimmed = input.trim();

    // 1) JSON embedded in QR
    if (trimmed.startsWith("{")) {
      const data = JSON.parse(trimmed) as Record<string, unknown>;
      return mapFields(data, "qr_payload");
    }

    // 2) URL
    if (/^https?:\/\//i.test(trimmed)) {
      // Official NYSC call-up verification page (what real QRs encode)
      if (isNyscVerifyUrl(trimmed)) {
        return this.verifyNyscPage(trimmed);
      }

      if (this.allowGenericRemote) {
        const res = await fetch(trimmed, {
          headers: {
            Accept: "application/json, text/html",
            "User-Agent":
              "NYSC-Ekiti-CIS/1.0 (call-up verification; +https://nysc.gov.ng)",
          },
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
        throw new Error(
          "Verification URL returned HTML that is not a known NYSC verify page. Use manual entry."
        );
      }

      const url = new URL(trimmed);
      const guess =
        url.searchParams.get("callup") ||
        url.searchParams.get("callUpNumber") ||
        url.searchParams.get("id") ||
        "";
      return {
        callUpNumber: guess || `PENDING-${Date.now()}`,
        fullName: "PENDING_VERIFICATION",
        raw: { verificationUrl: trimmed },
        verifiedAt: new Date(),
        source: "qr_payload",
      };
    }

    // 3) Plain string
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

  private async verifyNyscPage(url: string): Promise<VerifiedCallUpData> {
    const res = await fetch(url, {
      headers: {
        Accept: "text/html",
        "User-Agent":
          "Mozilla/5.0 (compatible; NYSC-Ekiti-CIS/1.0; call-up letter verification)",
      },
      redirect: "follow",
    });
    if (!res.ok) {
      throw new Error(`NYSC verification page returned HTTP ${res.status}`);
    }
    const html = await res.text();
    const parsed = parseNyscVerifyHtml(html);

    if (!parsed.fullName || !parsed.callUpNumber) {
      throw new Error(
        "Could not read name/call-up from NYSC verification page. Enter details manually."
      );
    }

    // Prefer deployment state as operational state; keep stateCode for business key later
    return mapFields(
      {
        callUpNumber: parsed.callUpNumber,
        fullName: parsed.fullName,
        gender: parsed.gender,
        institution: parsed.institution,
        course: parsed.course,
        photographUrl: parsed.photographUrl,
        deploymentState: parsed.deploymentState,
        stateCode: parsed.deploymentState,
        campAddress: parsed.campAddress,
        batchYear: parsed.batchYear,
        dateReporting: parsed.dateReporting,
        verificationUrl: url,
        authenticated: parsed._authenticated,
      },
      "nysc_verify_page"
    );
  }
}

export function createVerificationAdapter(
  mode: "manual" | "qr" | "scraping" | "official_api" = "manual"
): CallUpVerificationAdapter {
  const remoteFlag = process.env.VERIFICATION_ADAPTER;
  const allowGenericRemote =
    remoteFlag === "scraping" ||
    remoteFlag === "official_api" ||
    process.env.VERIFICATION_ALLOW_REMOTE === "true";

  switch (mode) {
    case "manual":
      return new ManualVerificationAdapter();
    case "qr":
    case "scraping":
    case "official_api":
      return new QrPayloadAdapter(allowGenericRemote || mode !== "qr");
    default:
      return new ManualVerificationAdapter();
  }
}
