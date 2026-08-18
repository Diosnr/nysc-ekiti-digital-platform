/**
 * NYSC Call-up Verification Adapter
 *
 * Real call-up QR codes encode:
 * https://mgt.nysc.org.ng/verify/CorpMemberVerify.aspx?svc=callup&callup=<token>
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

function absoluteUrl(src: string, pageUrl?: string): string {
  const s = src.trim();
  if (/^https?:\/\//i.test(s) || s.startsWith("data:")) return s;
  if (s.startsWith("//")) return `https:${s}`;
  try {
    const base = pageUrl || "https://mgt.nysc.org.ng/";
    return new URL(s, base).toString();
  } catch {
    return s;
  }
}

export function parseNyscVerifyHtml(
  html: string,
  pageUrl?: string
): Record<string, string> {
  const withoutScripts = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ");

  // Prefer embedded base64 passport photo
  const dataImg = withoutScripts.match(
    /<img[^>]+src=["'](data:image\/(?:jpeg|jpg|png|webp|gif);base64,[A-Za-z0-9+/=]+)["']/i
  );
  // Or remote / relative image (common on NYSC pages)
  const remoteImg =
    withoutScripts.match(
      /<img[^>]+src=["']((?:https?:)?\/\/[^"']+|\/?[^"']*\.(?:jpg|jpeg|png|webp|gif)[^"']*)["']/i
    ) ||
    withoutScripts.match(
      /<img[^>]+src=["'](\/[^"']+)["'][^>]*(?:photo|passport|corp|member)/i
    ) ||
    withoutScripts.match(/<img[^>]+id=["'][^"']*photo[^"']*["'][^>]+src=["']([^"']+)["']/i) ||
    withoutScripts.match(/<img[^>]+src=["']([^"']+)["'][^>]+id=["'][^"']*photo[^"']*["']/i);

  const photographUrl = dataImg?.[1]
    ? dataImg[1]
    : remoteImg?.[1]
      ? absoluteUrl(remoteImg[1], pageUrl)
      : undefined;

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
      if (!labelMap[value.toLowerCase()]) {
        out[key] = value;
      }
    }
  }

  out._authenticated =
    /call-up letter has been authenticated/i.test(plain) || /\bVerified\b/i.test(plain)
      ? "true"
      : "false";

  return out;
}

export function extractNyscVerifyUrl(input: string): string | null {
  const trimmed = input.replace(/[\u0000-\u001F]+/g, " ").trim();
  const match = trimmed.match(
    /https?:\/\/[^\s"'<>]*nysc\.org\.ng[^\s"'<>]*CorpMemberVerify\.aspx[^\s"'<>]*/i
  );
  if (match) {
    return match[0].replace(/[.,;)\]]+$/, "");
  }
  // Some scanners drop the scheme; recover if host+path present
  const bare = trimmed.match(
    /(?:https?:\/\/)?(?:www\.)?mgt\.nysc\.org\.ng\/[^\s"'<>]*CorpMemberVerify\.aspx[^\s"'<>]*/i
  );
  if (bare) {
    const u = bare[0].replace(/[.,;)\]]+$/, "");
    return /^https?:\/\//i.test(u) ? u : `https://${u}`;
  }
  if (/^https?:\/\//i.test(trimmed) && /nysc\.org\.ng/i.test(trimmed)) {
    return trimmed;
  }
  return null;
}

function isNyscVerifyUrl(url: string): boolean {
  try {
    const u = new URL(url);
    const hostOk = /nysc\.org\.ng$/i.test(u.hostname);
    const pathOk = /CorpMemberVerify\.aspx/i.test(u.pathname);
    const hasCallup = u.searchParams.has("callup") || u.searchParams.has("callUp");
    return hostOk && (pathOk || hasCallup);
  } catch {
    return false;
  }
}

export class QrPayloadAdapter implements CallUpVerificationAdapter {
  constructor(private allowGenericRemote: boolean) {}

  async verify(input: string): Promise<VerifiedCallUpData> {
    // USB/BT wedge scanners often append CR/LF or null bytes
    const trimmed = input.replace(/[\u0000-\u001F]+/g, " ").trim();

    if (trimmed.startsWith("{")) {
      const data = JSON.parse(trimmed) as Record<string, unknown>;
      return mapFields(data, "qr_payload");
    }

    const nyscUrl = extractNyscVerifyUrl(trimmed);
    if (nyscUrl || isNyscVerifyUrl(trimmed)) {
      return this.verifyNyscPage(nyscUrl || trimmed);
    }

    if (/^https?:\/\//i.test(trimmed)) {
      if (this.allowGenericRemote) {
        const res = await fetch(trimmed, {
          headers: {
            Accept: "application/json, text/html",
            "User-Agent":
              "Mozilla/5.0 (compatible; NYSC-Ekiti-CIS/1.0; call-up verification)",
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
        const html = await res.text();
        const parsed = parseNyscVerifyHtml(html, trimmed);
        if (parsed.fullName && parsed.callUpNumber) {
          return mapFields(parsed, "nysc_verify_page");
        }
        throw new Error(
          "Could not read call-up details from that URL. Enter details manually."
        );
      }

      throw new Error(
        "Scanned a URL that is not a recognized NYSC call-up verification link. Paste the full mgt.nysc.org.ng verify link or enter details manually."
      );
    }

    if (trimmed.length >= 4) {
      throw new Error(
        "Scanned text is not a full NYSC verification URL. Open the QR link or enter call-up number and name manually."
      );
    }

    throw new Error("Unrecognized QR payload. Enter details manually.");
  }

  private async verifyNyscPage(url: string): Promise<VerifiedCallUpData> {
    let res: Response;
    try {
      res = await fetch(url, {
        headers: {
          Accept: "text/html,application/xhtml+xml",
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        },
        redirect: "follow",
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "network error";
      throw new Error(
        `Could not reach NYSC verification page (${msg}). Check server network or enter details manually.`
      );
    }

    if (!res.ok) {
      throw new Error(`NYSC verification page returned HTTP ${res.status}`);
    }

    const html = await res.text();
    const parsed = parseNyscVerifyHtml(html, url);

    if (!parsed.fullName || !parsed.callUpNumber) {
      throw new Error(
        "NYSC page loaded but name/call-up number could not be read. Enter details manually."
      );
    }

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
