"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { CallUpLookup } from "@/components/CallUpLookup";
import { EKITI_LGAS, NIGERIA_STATES } from "@/lib/nigeria";
import { lettersOnly, phoneDigits } from "@/lib/sanitize";

type Community = { id: string; name: string; lga: string | null; state: string | null };

const STATUS_OPTS = [
  { key: "pregnant", label: "Pregnant" },
  { key: "nursing", label: "Nursing mother" },
  { key: "single_mother", label: "Single mother" },
] as const;

type StatusKey = (typeof STATUS_OPTS)[number]["key"];

export default function SpecialStatusPage() {
  const [pcm, setPcm] = useState<{ callUpNumber: string; fullName: string } | null>(
    null
  );
  const [statuses, setStatuses] = useState<StatusKey[]>([]);
  const [communities, setCommunities] = useState<Community[]>([]);
  const [state, setState] = useState("Ekiti");
  const [lga, setLga] = useState("");
  const [husbandName, setHusbandName] = useState("");
  const [phone, setPhone] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const isSingleMother = statuses.includes("single_mother");
  const isMarriedPath =
    statuses.includes("pregnant") || statuses.includes("nursing");

  function toggleStatus(key: StatusKey) {
    setStatuses((prev) => {
      const has = prev.includes(key);
      if (key === "single_mother") {
        // Exclusive with pregnant/nursing
        return has ? [] : ["single_mother"];
      }
      // Selecting pregnant/nursing clears single_mother
      const withoutSingle = prev.filter((s) => s !== "single_mother");
      if (has) return withoutSingle.filter((s) => s !== key);
      return [...withoutSingle, key];
    });
  }

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
    if (statuses.length === 0) {
      setError("Select at least one status");
      return;
    }
    setLoading(true);
    setError(null);
    setMsg(null);
    const fd = new FormData(e.currentTarget);
    const body = {
      callUpNumber: pcm.callUpNumber,
      fullName: pcm.fullName,
      statuses,
      husbandName: isSingleMother ? undefined : husbandName.trim() || undefined,
      address: String(fd.get("address") || "").trim(),
      residenceState: state,
      residenceLga: lga,
      residenceCommunity: String(fd.get("residenceCommunity") || ""),
      phone: phone || undefined,
    };
    if (!body.address) {
      setError("Address is required");
      setLoading(false);
      return;
    }
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
      setMsg("Submitted successfully.");
      e.currentTarget.reset();
      setStatuses([]);
      setHusbandName("");
      setPhone("");
      setPcm(null);
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
      <h1 className="mt-4 text-2xl font-bold text-slate-900">Special Status</h1>
      <p className="mt-2 text-sm text-slate-600">
        Pregnant, nursing mother, or single mother — for posting and welfare. Search your
        registered call-up first.
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
            <fieldset>
              <legend className="text-xs font-semibold uppercase text-slate-500">
                Status * (select all that apply)
              </legend>
              <p className="mt-1 text-xs text-slate-500">
                Single mother cannot be combined with pregnant or nursing mother.
              </p>
              <div className="mt-3 space-y-2">
                {STATUS_OPTS.map((o) => (
                  <label key={o.key} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={statuses.includes(o.key)}
                      onChange={() => toggleStatus(o.key)}
                    />
                    {o.label}
                  </label>
                ))}
              </div>
            </fieldset>

            {!isSingleMother && isMarriedPath && (
              <div>
                <label className="text-xs font-semibold uppercase text-slate-500">
                  Husband’s full name
                </label>
                <input
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  value={husbandName}
                  onChange={(e) => setHusbandName(lettersOnly(e.target.value))}
                />
              </div>
            )}

            <div>
              <label className="text-xs font-semibold uppercase text-slate-500">
                {isSingleMother ? "Address *" : "Husband’s address *"}
              </label>
              <textarea
                name="address"
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
                    {EKITI_LGAS.map((x) => (
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
                    onChange={(e) => setLga(lettersOnly(e.target.value))}
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
            </div>

            <div>
              <label className="text-xs font-semibold uppercase text-slate-500">Phone</label>
              <input
                type="tel"
                inputMode="tel"
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                value={phone}
                onChange={(e) => setPhone(phoneDigits(e.target.value))}
              />
            </div>

            <button
              type="submit"
              disabled={loading || statuses.length === 0}
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
