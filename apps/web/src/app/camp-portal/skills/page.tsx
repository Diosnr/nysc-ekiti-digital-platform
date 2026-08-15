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

function SkillSelect({
  name,
  label,
  required,
}: {
  name: string;
  label: string;
  required?: boolean;
}) {
  const [value, setValue] = useState("");
  const [otherText, setOtherText] = useState("");
  const isOther = value === "Other";

  return (
    <div>
      <label className="text-xs font-semibold uppercase text-slate-500">{label}</label>
      <select
        className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
        value={value}
        required={required}
        onChange={(e) => {
          setValue(e.target.value);
          if (e.target.value !== "Other") setOtherText("");
        }}
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
      {isOther && (
        <input
          type="text"
          className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          placeholder="Type your skill…"
          value={otherText}
          required
          maxLength={80}
          onChange={(e) => setOtherText(e.target.value)}
        />
      )}
      {/* Hidden field carries final value for FormData */}
      <input
        type="hidden"
        name={name}
        value={isOther ? otherText.trim() : value}
      />
    </div>
  );
}

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
    const form = e.currentTarget;
    setLoading(true);
    setError(null);
    setMsg(null);
    const fd = new FormData(form);
    const skill1 = String(fd.get("skill1") || "").trim();
    const skill2 = String(fd.get("skill2") || "").trim();
    const skill3 = String(fd.get("skill3") || "").trim();
    if (!skill1) {
      setError("Skill 1 is required");
      setLoading(false);
      return;
    }
    const body = {
      callUpNumber: pcm.callUpNumber,
      fullName: pcm.fullName,
      skill1,
      skill2,
      skill3,
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
        Declare up to three skills. Choose Other to type a skill not listed.
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
            <SkillSelect name="skill1" label="Skill 1 *" required />
            <SkillSelect name="skill2" label="Skill 2" />
            <SkillSelect name="skill3" label="Skill 3" />
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
