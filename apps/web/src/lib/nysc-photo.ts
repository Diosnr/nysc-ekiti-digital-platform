import { uploadDataUriToCloudinary } from "@/lib/cloudinary";

/** Official NYSC digital ID card page (embeds photo as data URI). */
export function idCardVerifyUrl(callUpNumber: string): string {
  return `https://mgt.nysc.org.ng/IDCard/Verify.aspx?c=${encodeURIComponent(callUpNumber.trim())}`;
}

/**
 * Fetch ID card HTML, extract embedded photo (data:image or http img),
 * upload to Cloudinary. Returns CDN URL or null.
 */
export async function fetchIdCardPhotoToCloudinary(
  callUpNumber: string,
  sourceUrl?: string
): Promise<{ photographUrl: string | null; sourceUrl: string }> {
  const url = sourceUrl?.trim() || idCardVerifyUrl(callUpNumber);
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) {
      console.warn("ID card page status", res.status, callUpNumber);
      return { photographUrl: null, sourceUrl: url };
    }
    const html = await res.text();

    // ASP.NET ImageUrl= or <img src= with data URI
    let dataUri =
      html.match(/ImageUrl\s*=\s*["'](data:image\/[^"']+)["']/i)?.[1] ||
      html.match(/src\s*=\s*["'](data:image\/[^"']+)["']/i)?.[1] ||
      null;

    if (dataUri) {
      // Unescape HTML entities if any
      dataUri = dataUri.replace(/&amp;/g, "&").replace(/&#43;/g, "+");
      const uploaded = await uploadDataUriToCloudinary(dataUri, callUpNumber);
      return { photographUrl: uploaded, sourceUrl: url };
    }

    // Absolute/relative http image on page (skip logos)
    const imgMatches = [
      ...html.matchAll(/src\s*=\s*["']([^"']+\.(?:jpg|jpeg|png|gif|webp)(?:\?[^"']*)?)["']/gi),
    ].map((m) => m[1]);
    for (const src of imgMatches) {
      if (/logo|icon|badge|header/i.test(src)) continue;
      let abs = src;
      if (src.startsWith("//")) abs = `https:${src}`;
      else if (src.startsWith("/")) abs = `https://mgt.nysc.org.ng${src}`;
      else if (!/^https?:/i.test(src)) continue;
      const uploaded = await uploadDataUriToCloudinary(abs, callUpNumber);
      if (uploaded) return { photographUrl: uploaded, sourceUrl: url };
    }

    return { photographUrl: null, sourceUrl: url };
  } catch (e) {
    console.error("fetchIdCardPhoto", callUpNumber, e);
    return { photographUrl: null, sourceUrl: url };
  }
}
