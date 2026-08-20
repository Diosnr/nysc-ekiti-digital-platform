"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { setCmToken } from "@/lib/cm-api";
import { phoneDigits } from "@/lib/sanitize";

export default function CmResetPage() {
  const router = useRouter();
  const [identifier, setIdentifier] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/camp-portal/auth/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier, fullName, phone }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Verification failed");
        return;
      }
      setCmToken(data.token);
      router.replace("/camp-portal");
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-[70vh] items-center justify-center px-4 py-12">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="mb-6 text-center">
          <h1 className="text-xl font-bold text-slate-900">Verify identity</h1>
          <p className="mt-1 text-sm text-slate-600">
            Provide details that match your registration to open My Portal
          </p>
        </div>

        {error && (
          <p className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}

        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-semibold uppercase text-slate-500">
              Call-up number or state code
            </label>
            <input
              type="text"
              required
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs font-semibold uppercase text-slate-500">
              Full name (as registered)
            </label>
            <input
              type="text"
              required
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs font-semibold uppercase text-slate-500">
              Phone (as registered at intake)
            </label>
            <input
              type="tel"
              required
              inputMode="tel"
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              value={phone}
              onChange={(e) => setPhone(phoneDigits(e.target.value))}
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-md bg-nysc-green px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
          >
            {loading ? "Verifying…" : "Verify & continue"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-600">
          <Link href="/camp-portal/login" className="text-nysc-green hover:underline">
            ← Back to login
          </Link>
        </p>
      </div>
    </div>
  );
}
