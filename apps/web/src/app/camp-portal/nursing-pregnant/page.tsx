"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { CallUpLookup } from "@/components/CallUpLookup";
import { EKITI_LGAS, NIGERIA_STATES } from "@/lib/nigeria";

type Community = { id: string; name: string; lga: string | null; state: string | null };

export default function EkitiMarriedWomenPage() {
  const [pcm, setPcm] = useState<{ callUpNumber: string; fullName: string } | null>(
    null
  );
  const [communities, setCommunities] = useState<Community[]>([]);
  const [state, setState] = useState("Ekiti");
  const [lga, setLga] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const qs = new URLSearchParams();
    if (state) qs.set("state", state);
    if (lga) qs.set("lga", lga);
    fetch(`/api/communities?${qs}`)
      .then((r) => r.json())
      .then((d) => setCommunities(d.communities ?? []))
      .catch(() => setCommunities([]));
  }, [state, lga]);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!pcm) {
      setError("Search and select a registered call-up number first");
      return;
    }
    setLoading(true);
    setError(null);
    setMsg(null);
    const fd = new FormData(e.currentTarget);
    const body = {
      callUpNumber: pcm.callUpNumber,
      fullName: pcm.fullName,
      status: String(fd.get("status") || ""),
      husbandName: String(fd.get("husbandName") || ""),
      husbandAddress: String(fd.get("husbandAddress") || ""),
      residenceState: state,
      residenceLga: lga,
      residenceCommunity: String(fd.get("residenceCommunity") || ""),
      phone: String(fd.get("phone") || ""),
    };
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
      setPcm(null);
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  const lgaOptions =
    state === "Ekiti" ? [...EKITI_LGAS] : [];

  return (
    <main className="mx-auto max-w-xl px-4 py-12 sm:px-6">
      <Link href="/" className="text-sm font-medium text-nysc-green hover:underline">
        ← Home
      </Link>
      <h1 className="mt-4 text-2xl font-bold text-slate-900">Ekiti Married Women</h1>
      <p className="mt-2 text-sm text-slate-600">
        Capture status and husband’s address for posting. Search your registered call-up
        number first.
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
              <label className="text-xs font-semibold uppercase text-slate-500">
                Husband’s full name
              </label>
              <input
                name="husbandName"
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-semibold uppercase text-slate-500">
                Husband’s address *
              </label>
              <textarea
                name="husbandAddress"
                required
                rows={3}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="text-xs font-semibold uppercase text-slate-500">State *</label>
                <select
                  required
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  value={state}
                  onChange={(e) => {
                    setState(e.target.value);
                    setLga("");
                  }}
                >
                  {NIGERIA_STATES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold uppercase text-slate-500">LGA *</label>
                {state === "Ekiti" ? (
                  <select
                    required
                    className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                    value={lga}
                    onChange={(e) => setLga(e.target.value)}
                  >
                    <option value="">Select LGA…</option>
                    {lgaOptions.map((x) => (
                      <option key={x} value={x}>
                        {x}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    required
                    className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                    value={lga}
                    onChange={(e) => setLga(e.target.value)}
                    placeholder="Enter LGA"
                  />
                )}
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold uppercase text-slate-500">
                Community / town
              </label>
              <select
                name="residenceCommunity"
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                defaultValue=""
              >
                <option value="">Select community…</option>
                {communities.map((c) => (
                  <option key={c.id} value={c.name}>
                    {c.name}
                    {c.lga ? ` (${c.lga})` : ""}
                  </option>
                ))}
              </select>
              {communities.length === 0 && (
                <p className="mt-1 text-xs text-slate-500">
                  No communities listed yet. Super Admin can add them under Staff → Communities.
                </p>
              )}
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
        )}
      </div>
    </main>
  );
}
