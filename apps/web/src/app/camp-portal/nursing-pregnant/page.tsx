"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";

export default function NursingPregnantPage() {
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMsg(null);
    const fd = new FormData(e.currentTarget);
    const body = Object.fromEntries(fd.entries());
    try {
      const res = await fetch("/api/camp-portal/nursing-pregnant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error ?? "Submission failed");
        return;
      }
      setMsg("Submitted successfully. Keep your call-up number for camp.");
      e.currentTarget.reset();
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
      <h1 className="mt-4 text-2xl font-bold text-slate-900">Nursing / Pregnant women</h1>
      <p className="mt-2 text-sm text-slate-600">
        Capture status and husband’s address for posting consideration. Use the call-up number on
        your letter so this links to your record.
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
            placeholder="e.g. NYSC/EST/2026/…"
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
        <fieldset className="space-y-2">
          <legend className="text-xs font-semibold uppercase text-slate-500">Status *</legend>
          <label className="flex items-center gap-2 text-sm">
            <input type="radio" name="status" value="pregnant" required /> Pregnant
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="radio" name="status" value="nursing" /> Nursing mother
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="radio" name="status" value="both" /> Both
          </label>
        </fieldset>
        <div>
          <label className="text-xs font-semibold uppercase text-slate-500">Husband’s full name</label>
          <input
            name="husbandName"
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="text-xs font-semibold uppercase text-slate-500">Husband’s address *</label>
          <textarea
            name="husbandAddress"
            required
            rows={3}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="text-xs font-semibold uppercase text-slate-500">State of residence</label>
            <input
              name="residenceState"
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="text-xs font-semibold uppercase text-slate-500">LGA</label>
            <input
              name="residenceLga"
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
        </div>
        <div>
          <label className="text-xs font-semibold uppercase text-slate-500">Community / town</label>
          <input
            name="residenceCommunity"
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="text-xs font-semibold uppercase text-slate-500">Phone</label>
          <input
            name="phone"
            type="tel"
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-md bg-nysc-green px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
        >
          {loading ? "Submitting…" : "Submit"}
        </button>
      </form>
    </main>
  );
}
