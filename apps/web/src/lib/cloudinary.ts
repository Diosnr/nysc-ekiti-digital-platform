/**
 * Upload image to Cloudinary; return secure URL for DB storage.
 * Requires CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET.
 * If unset, returns null (caller may skip photo or keep temporary behaviour).
 */

export async function uploadDataUriToCloudinary(
  dataUri: string,
  publicIdHint?: string
): Promise<string | null> {
  const cloud = process.env.CLOUDINARY_CLOUD_NAME;
  const key = process.env.CLOUDINARY_API_KEY;
  const secret = process.env.CLOUDINARY_API_SECRET;

  if (!cloud || !key || !secret) {
    console.warn("Cloudinary not configured — skipping photo upload");
    return null;
  }

  if (!dataUri.startsWith("data:image")) {
    // Already a remote URL
    if (/^https?:\/\//i.test(dataUri)) return dataUri;
    return null;
  }

  const form = new FormData();
  form.append("file", dataUri);
  form.append("upload_preset", process.env.CLOUDINARY_UPLOAD_PRESET || "");

  // Signed upload without preset (server-side)
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const folder = "nysc-ekiti/pcm";
  const public_id = publicIdHint
    ? `pcm_${publicIdHint.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 40)}`
    : undefined;

  const params: Record<string, string> = {
    timestamp,
    folder,
  };
  if (public_id) params.public_id = public_id;

  const crypto = await import("crypto");
  const toSign = Object.keys(params)
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join("&");
  const signature = crypto
    .createHash("sha1")
    .update(toSign + secret)
    .digest("hex");

  form.append("api_key", key);
  form.append("timestamp", timestamp);
  form.append("folder", folder);
  form.append("signature", signature);
  if (public_id) form.append("public_id", public_id);

  // Remove empty upload_preset if we signed instead
  form.delete("upload_preset");

  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${cloud}/image/upload`,
    { method: "POST", body: form }
  );

  if (!res.ok) {
    const text = await res.text();
    console.error("Cloudinary upload failed", res.status, text.slice(0, 300));
    return null;
  }

  const json = (await res.json()) as { secure_url?: string };
  return json.secure_url ?? null;
}
