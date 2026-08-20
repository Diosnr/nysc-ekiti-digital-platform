"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getCmToken, clearCmToken, cmFetch } from "@/lib/cm-api";
import { digitsOnly } from "@/lib/sanitize";

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result || ""));
    r.onerror = () => reject(new Error("read failed"));
    r.readAsDataURL(file);
  });
}

export default function AccountNinPage() {
  const router = useRouter();
  const [pcm, setPcm] = useState<{ callUpNumber: string; fullName: string } | null>(null);
  const [nin, setNin] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const token = getCmToken();
    if (!token) {
      router.replace("/camp-portal/login");
      return;
    }
    cmFetch("/api/camp-portal/auth/me")
      .then(async (res) => {
        if (!res.ok) {
          clearCmToken();
          router.replace("/camp-portal/login");
          return;
        }
        const data = await res.json();
        setPcm({
          callUpNumber: data.pcm.callUpNumber,
          fullName: data.pcm.fullName,
        });
      })
      .catch(() => {
        clearCmToken();
        router.replace("/camp-portal/login");
      })
      .finally(() => setChecking(false));
  }, [router]);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!pcm) return;
    const form = e.currentTarget;
    setLoading(true);
    setError(null);
    setMsg(null);
    const fd = new FormData(form);
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

      const res = await cmFetch("/api/camp-portal/account", {
        method: "POST",
        body: JSON.stringify({
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
      setError(null);
      setMsg("NIN images submitted and linked to your call-up number.");
      setNin("");
    } catch {
      setError("Network error — please try again");
      setMsg(null);
    } finally {
      setLoading(false);
    }
  }

  if (checking) {
    return (
      <main className="mx-auto max-w-xl px-4 py-16 text-center text-sm text-slate-500">
        Loading…
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-xl px-4 py-12 sm:px-6">
      <Link
        href="/camp-portal"
        className="text-sm font-medium text-nysc-green hover:underline"
      >
        ← My Portal
      </Link>
      <h1 className="mt-4 text-2xl font-bold text-slate-900">Account — NIN card</h1>
      <p className="mt-2 text-sm text-slate-600">
        Upload NIN card images for your registered profile.
      </p>
      {pcm && (
        <p className="mt-1 text-xs text-slate-500">
          Submitting as {pcm.fullName} ({pcm.callUpNumber})
        </p>
      )}

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

      {pcm && (
        <form
          onSubmit={onSubmit}
          className="mt-8 space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
        >
          <div>
            <label className="text-xs font-semibold uppercase text-slate-500">
              NIN (11 digits)
            </label>
            <input
              inputMode="numeric"
              maxLength={11}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              placeholder="Optional if on the card image"
              value={nin}
              onChange={(e) => setNin(digitsOnly(e.target.value).slice(0, 11))}
            />
          </div>
          <div>
            <label className="text-xs font-semibold uppercase text-slate-500">
              NIN card front *
            </label>
            <input
              name="ninFront"
              type="file"
              accept="image/*"
              required
              className="mt-1 block w-full text-sm"
            />
          </div>
          <div>
            <label className="text-xs font-semibold uppercase text-slate-500">
              NIN card back
            </label>
            <input
              name="ninBack"
              type="file"
              accept="image/*"
              className="mt-1 block w-full text-sm"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-md bg-nysc-green px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
          >
            {loading ? "Uploading…" : "Submit NIN images"}
          </button>
        </form>
      )}
    </main>
  );
}
