"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { CallUpLookup } from "@/components/CallUpLookup";

const SKILL_OPTIONS = [
  "ICT / Computer",
  "Teaching",
  "Agriculture",
  "Health / First aid",
  "Sports",
  "Music / Drama",
  "Craft / Handiwork",
  "Driving",
  "Catering",
  "Tailoring",
  "Other",
];

export default function SkillsPage() {
  const [pcm, setPcm] = useState<{ callUpNumber: string; fullName: string } | null>(
    null
  );
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!pcm) {
      setError("Search and select a registered call-up number first");
      return;
    }
    // Capture form before any await / state updates (React can clear currentTarget)
    const form = e.currentTarget;
    setLoading(true);
    setError(null);
    setMsg(null);
    const fd = new FormData(form);
    const body = {
      callUpNumber: pcm.callUpNumber,
      fullName: pcm.fullName,
      skill1: String(fd.get("skill1") || ""),
      skill2: String(fd.get("skill2") || ""),
      skill3: String(fd.get("skill3") || ""),
    };
    try {
      const res = await fetch("/api/camp-portal/skills", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error ?? "Submission failed");
        return;
      }
      // Success only — do not call form.reset() after setPcm(null) unmounts the form
      setError(null);
      setMsg("Skills submitted successfully.");
      setPcm(null);
    } catch {
      setError("Network error — please try again");
      setMsg(null);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto max-w-xl px-4 py-12 sm:px-6">
      <Link href="/" className="text-sm font-medium text-nysc-green hover:underline">
        ← Home
      </Link>
      <h1 className="mt-4 text-2xl font-bold text-slate-900">Skills</h1>
      <p className="mt-2 text-sm text-slate-600">
        Declare up to three skills. Search your registered call-up number first.
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

      <div className="mt-8 space-y-4">
        <CallUpLookup onFound={setPcm} onClear={() => setPcm(null)} />

        {pcm && (
          <form
            onSubmit={onSubmit}
            className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
          >
            {(["skill1", "skill2", "skill3"] as const).map((name, i) => (
              <div key={name}>
                <label className="text-xs font-semibold uppercase text-slate-500">
                  Skill {i + 1}
                  {i === 0 ? " *" : ""}
                </label>
                <select
                  name={name}
                  required={i === 0}
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  defaultValue=""
                >
                  <option value="" disabled>
                    Select…
                  </option>
                  {SKILL_OPTIONS.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
            ))}
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-md bg-nysc-green px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
            >
              {loading ? "Submitting…" : "Submit skills"}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
