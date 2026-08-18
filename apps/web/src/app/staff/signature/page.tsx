"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { StaffShell } from "@/components/staff/StaffShell";
import { staffFetch } from "@/lib/staff-api";

export default function SignatureOnboardingPage() {
  const router = useRouter();
  const [preview, setPreview] = useState<string | null>(null);
  const [existing, setExisting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    staffFetch("/api/staff/signature")
      .then(async (res) => {
        if (!res.ok) return;
        const data = await res.json();
        if (data.signatureUrl) {
          setExisting(data.signatureUrl);
          setPreview(data.signatureUrl);
        }
      })
      .catch(() => {});
  }, []);

  function onFile(file: File | null) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Please choose an image file (PNG or JPG)");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result || "");
      if (dataUrl.startsWith("data:image")) {
        setPreview(dataUrl);
        setError(null);
      }
    };
    reader.readAsDataURL(file);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!preview) {
      setError("Upload a clear image of your signature first");
      return;
    }
    setLoading(true);
    setError(null);
    setMsg(null);
    try {
      const res = await staffFetch("/api/staff/signature", {
        method: "POST",
        body: JSON.stringify({ signatureUrl: preview }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Upload failed");
        return;
      }
      setExisting(data.user?.signatureUrl ?? preview);
      setMsg("Signature saved. You can continue to e-file.");
      setTimeout(() => router.push("/staff/e-file"), 1200);
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <StaffShell>
      <div className="mx-auto max-w-lg">
        <h1 className="text-2xl font-bold text-slate-900">Your signature</h1>
        <p className="mt-2 text-sm text-slate-600">
          All officers who use the e-file desk must upload a signature. It will
          be used on digital minutes and official papers later.
        </p>

        {error && (
          <p className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}
        {msg && (
          <p className="mt-4 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
            {msg}
          </p>
        )}

        <form
          onSubmit={onSubmit}
          className="mt-6 space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
        >
          {preview && (
            <div className="rounded-lg border border-slate-100 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase text-slate-500">
                Preview
              </p>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={preview}
                alt="Signature preview"
                className="mt-2 max-h-40 w-auto bg-white object-contain"
              />
            </div>
          )}

          <div>
            <label className="text-xs font-semibold uppercase text-slate-500">
              Upload signature image
            </label>
            <input
              type="file"
              accept="image/*"
              className="mt-1 block w-full text-sm"
              onChange={(e) => onFile(e.target.files?.[0] ?? null)}
            />
            <p className="mt-1 text-xs text-slate-500">
              Sign on white paper, photograph or scan, then upload (PNG/JPG).
            </p>
          </div>

          <button
            type="submit"
            disabled={loading || !preview}
            className="w-full rounded-md bg-nysc-green px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
          >
            {loading
              ? "Saving…"
              : existing
                ? "Update signature"
                : "Save signature"}
          </button>
        </form>
      </div>
    </StaffShell>
  );
}
