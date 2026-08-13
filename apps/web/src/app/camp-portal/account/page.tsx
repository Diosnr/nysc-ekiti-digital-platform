"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result || ""));
    r.onerror = () => reject(new Error("read failed"));
    r.readAsDataURL(file);
  });
}

export default function AccountNinPage() {
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMsg(null);
    const form = e.currentTarget;
    const fd = new FormData(form);
    const callUpNumber = String(fd.get("callUpNumber") || "").trim();
    const fullName = String(fd.get("fullName") || "").trim();
    const nin = String(fd.get("nin") || "").trim();
    const front = (fd.get("ninFront") as File | null) ?? null;
    const back = (fd.get("ninBack") as File | null) ?? null;

    if (!front || !front.size) {
      setError("NIN card front image is required");
      setLoading(false);
      return;
    }

    try {
      const ninFrontDataUrl = await fileToDataUrl(front);
      const ninBackDataUrl = back && back.size ? await fileToDataUrl(back) : undefined;

      const res = await fetch("/api/camp-portal/account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          callUpNumber,
          fullName,
          nin,
          ninFrontDataUrl,
          ninBackDataUrl,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error ?? "Submission failed");
        return;
      }
      setMsg("NIN images submitted and linked to your call-up number.");
      form.reset();
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto max-w-xl px-4 py-12 sm:px-6">
      <Link href="/" className="text-sm font-medium text-nysc-green hover:underline">
        ← Home
      </Link>
      <h1 className="mt-4 text-2xl font-bold text-slate-900">Account — NIN card</h1>
      <p className="mt-2 text-sm text-slate-600">
        Upload NIN card images. They are linked to the call-up number you enter (must match a
        registered PCM where possible).
      </p>

      {error && (
        <p className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}
      {msg && (
        <p className="mt-4 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">
          {msg}
        </p>
      )}

      <form onSubmit={onSubmit} className="mt-8 space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div>
          <label className="text-xs font-semibold uppercase text-slate-500">Call-up number *</label>
          <input
            name="callUpNumber"
            required
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="text-xs font-semibold uppercase text-slate-500">Full name *</label>
          <input
            name="fullName"
            required
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="text-xs font-semibold uppercase text-slate-500">NIN (11 digits)</label>
          <input
            name="nin"
            pattern="[0-9]{11}"
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            placeholder="Optional if on the card image"
          />
        </div>
        <div>
          <label className="text-xs font-semibold uppercase text-slate-500">NIN card front *</label>
          <input
            name="ninFront"
            type="file"
            accept="image/*"
            required
            className="mt-1 block w-full text-sm"
          />
        </div>
        <div>
          <label className="text-xs font-semibold uppercase text-slate-500">NIN card back</label>
          <input name="ninBack" type="file" accept="image/*" className="mt-1 block w-full text-sm" />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-md bg-nysc-green px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
        >
          {loading ? "Uploading…" : "Submit NIN images"}
        </button>
      </form>
    </main>
  );
}
