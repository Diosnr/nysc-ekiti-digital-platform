/**
 * Upload image to Cloudinary; return secure HTTPS URL for DB.
 * Env: CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET
 *
 * Accepts data:image URIs or remote http(s) URLs (e.g. NYSC verify page photos).
 * Already-Cloudinary URLs are returned as-is.
 */

async function signedUpload(
  fileValue: string,
  publicIdHint?: string
): Promise<string | null> {
  const cloud = process.env.CLOUDINARY_CLOUD_NAME?.trim();
  const key = process.env.CLOUDINARY_API_KEY?.trim();
  const secret = process.env.CLOUDINARY_API_SECRET?.trim();

  if (!cloud || !key || !secret) {
    console.warn("Cloudinary not configured — skipping photo upload");
    return null;
  }

  const timestamp = Math.floor(Date.now() / 1000).toString();
  const folder = "nysc-ekiti/pcm";
  const safe = (publicIdHint || "pcm")
    .replace(/[^a-zA-Z0-9_-]/g, "_")
    .slice(0, 32);
  const public_id = `${safe}_${timestamp}`;

  const params: Record<string, string> = {
    folder,
    overwrite: "true",
    public_id,
    timestamp,
  };

  const crypto = await import("crypto");
  const toSign =
    Object.keys(params)
      .sort()
      .map((k) => `${k}=${params[k]}`)
      .join("&") + secret;
  const signature = crypto.createHash("sha1").update(toSign).digest("hex");

  const form = new FormData();
  form.append("file", fileValue);
  form.append("api_key", key);
  form.append("timestamp", timestamp);
  form.append("folder", folder);
  form.append("public_id", public_id);
  form.append("overwrite", "true");
  form.append("signature", signature);

  try {
    const res = await fetch(
      `https://api.cloudinary.com/v1_1/${cloud}/image/upload`,
      { method: "POST", body: form }
    );
    const text = await res.text();
    if (!res.ok) {
      console.error("Cloudinary upload failed", res.status, text.slice(0, 400));
      return null;
    }
    const json = JSON.parse(text) as { secure_url?: string; url?: string };
    return json.secure_url || json.url || null;
  } catch (e) {
    console.error("Cloudinary network error", e);
    return null;
  }
}

export async function uploadDataUriToCloudinary(
  dataUri: string,
  publicIdHint?: string
): Promise<string | null> {
  const value = dataUri?.trim();
  if (!value) return null;

  // Already on our CDN
  if (/res\.cloudinary\.com/i.test(value)) {
    return value;
  }

  if (value.startsWith("data:image")) {
    return signedUpload(value, publicIdHint);
  }

  // Remote URL (NYSC or other) — Cloudinary can fetch it server-side
  if (/^https?:\/\//i.test(value)) {
    const uploaded = await signedUpload(value, publicIdHint);
    if (uploaded) return uploaded;

    // Fallback: fetch ourselves and convert to data URI
    try {
      const res = await fetch(value, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (compatible; NYSC-Ekiti-CIS/1.0; photo fetch)",
          Accept: "image/*,*/*",
        },
        redirect: "follow",
      });
      if (!res.ok) return null;
      const buf = Buffer.from(await res.arrayBuffer());
      const ctype = res.headers.get("content-type") || "image/jpeg";
      const b64 = buf.toString("base64");
      return signedUpload(`data:${ctype};base64,${b64}`, publicIdHint);
    } catch (e) {
      console.error("Remote photo fetch failed", e);
      return null;
    }
  }

  console.warn("Unsupported photo value for Cloudinary");
  return null;
}
