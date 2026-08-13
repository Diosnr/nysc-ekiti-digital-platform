/**
 * Upload image to Cloudinary; return secure HTTPS URL for DB.
 * Env: CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET
 */

export async function uploadDataUriToCloudinary(
  dataUri: string,
  publicIdHint?: string
): Promise<string | null> {
  const cloud = process.env.CLOUDINARY_CLOUD_NAME?.trim();
  const key = process.env.CLOUDINARY_API_KEY?.trim();
  const secret = process.env.CLOUDINARY_API_SECRET?.trim();

  if (!cloud || !key || !secret) {
    console.warn("Cloudinary not configured — skipping photo upload");
    return null;
  }

  // Already a CDN / remote URL
  if (/^https?:\/\//i.test(dataUri) && !dataUri.startsWith("data:")) {
    return dataUri;
  }

  if (!dataUri.startsWith("data:image")) {
    console.warn("Not a data:image URI");
    return null;
  }

  const timestamp = Math.floor(Date.now() / 1000).toString();
  const folder = "nysc-ekiti/pcm";
  // Unique every time so re-intake / re-upload never collides
  const safe = (publicIdHint || "pcm")
    .replace(/[^a-zA-Z0-9_-]/g, "_")
    .slice(0, 32);
  const public_id = `${safe}_${timestamp}`;

  // Params that must be signed (alphabetical order for signature)
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
  form.append("file", dataUri);
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
