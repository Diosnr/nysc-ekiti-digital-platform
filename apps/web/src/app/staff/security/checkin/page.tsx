"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { StaffShell } from "@/components/staff/StaffShell";
import { PcmPhoto } from "@/components/staff/PcmPhoto";
import { staffFetch } from "@/lib/staff-api";
import { evaluateCheckoutEligibility } from "@/lib/dates";
import { NIGERIA_STATES } from "@/lib/nigeria";

type PcmHit = {
  id: string;
  callUpNumber: string;
  fullName: string;
  gender?: string | null;
  institution?: string | null;
  status?: string;
  photographUrl?: string | null;
  deploymentState?: string | null;
  dateReporting?: string | null;
  campExitGrantedAt?: string | null;
  exitReason?: string | null;
  exitDestinationState?: string | null;
  exitDestinationLga?: string | null;
  expectedReturnAt?: string | null;
  checkedOutAt?: string | null;
};

const IN_CAMP = new Set([
  "CHECKED_IN",
  "CAMP_ACTIVE",
  "ACCOMMODATED",
  "PLATOON_ASSIGNED",
  "KIT_ISSUED",
  "BANK_REGISTERED",
  "CAMP_EXIT_REQUESTED",
  "REGISTERED",
]);

export default function SecurityGatePage() {
  const [q, setQ] = useState("");
  const [pcm, setPcm] = useState<PcmHit | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [exitReason, setExitReason] = useState("");
  const [exitState, setExitState] = useState("");
  const [exitLga, setExitLga] = useState("");
  const [returnDate, setReturnDate] = useState("");
  const [lgas, setLgas] = useState<string[]>([]);
  const [lgasLoading, setLgasLoading] = useState(false);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!exitState) {
      setLgas([]);
      return;
    }
    let cancelled = false;
    setLgasLoading(true);
    fetch(`/api/geo/lgas?state=${encodeURIComponent(exitState)}`)
      .then(async (res) => {
        if (!res.ok) {
          if (!cancelled) setLgas([]);
          return;
        }
        const data = await res.json();
        if (!cancelled) setLgas((data.lgas ?? []) as string[]);
      })
      .catch(() => {
        if (!cancelled) setLgas([]);
      })
      .finally(() => {
        if (!cancelled) setLgasLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [exitState]);

  async function search(e?: FormEvent) {
    e?.preventDefault();
    setError(null);
    setMsg(null);
    setPcm(null);
    setNotFound(false);
    if (!q.trim()) return;
    setLoading(true);
    try {
      const res = await staffFetch(
        `/api/pcm?callUp=${encodeURIComponent(q.trim())}&q=${encodeURIComponent(q.trim())}`
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Search failed");
        return;
      }
      const list = (data.pcms ?? []) as PcmHit[];
      if (!list.length) {
        setNotFound(true);
        setError(null);
        return;
      }
      const exact = list.find(
        (p) => p.callUpNumber.toLowerCase() === q.trim().toLowerCase()
      );
      const hit = exact ?? list[0];
      setPcm(hit);
      // Pre-fill from approved exit request when present
      setExitReason(hit.exitReason ?? "");
      setExitState(hit.exitDestinationState ?? "");
      setExitLga(hit.exitDestinationLga ?? "");
      setReturnDate(
        hit.expectedReturnAt
          ? new Date(hit.expectedReturnAt).toISOString().slice(0, 10)
          : ""
      );
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  async function doCheckin() {
    if (!pcm) return;
    setLoading(true);
    setError(null);
    setMsg(null);
    try {
      const res = await staffFetch(`/api/pcm/${pcm.id}/checkin`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Check-in failed");
        return;
      }
      setMsg(`Checked in: ${data.pcm.fullName}`);
      setPcm({
        ...pcm,
        ...data.pcm,
        photographUrl: data.pcm.photographUrl || pcm.photographUrl,
        campExitGrantedAt: data.pcm.campExitGrantedAt ?? pcm.campExitGrantedAt,
      });
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  async function doCheckout() {
    if (!pcm) return;
    if (!exitReason.trim()) {
      setError("Enter reason for exit");
      return;
    }
    if (!exitState.trim()) {
      setError("Select destination state");
      return;
    }
    if (!exitLga.trim()) {
      setError("Select destination LGA");
      return;
    }
    setLoading(true);
    setError(null);
    setMsg(null);
    try {
      const res = await staffFetch(`/api/pcm/${pcm.id}/checkout`, {
        method: "POST",
        body: JSON.stringify({
          exitReason: exitReason.trim(),
          exitDestinationState: exitState.trim(),
          exitDestinationLga: exitLga.trim(),
          expectedReturnAt: returnDate.trim() || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Check-out failed");
        return;
      }
      setMsg(
        `Checked out: ${data.pcm.fullName} → ${data.pcm.exitDestinationState}` +
          (data.pcm.exitDestinationLga ? ` / ${data.pcm.exitDestinationLga}` : "") +
          ` (${data.pcm.exitReason})`
      );
      setPcm({
        ...pcm,
        ...data.pcm,
        photographUrl: data.pcm.photographUrl || pcm.photographUrl,
      });
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  const eligibility = pcm ? evaluateCheckoutEligibility(pcm) : null;
  const showCheckout = Boolean(eligibility?.canCheckout);
  const alreadyOut =
    pcm?.status === "CHECKED_OUT" || pcm?.status === "CAMP_EXITED";
  const alreadyIn = pcm ? IN_CAMP.has(pcm.status ?? "") : false;
  const exitGranted = Boolean(pcm?.campExitGrantedAt);
  // Never offer Check in when already in camp, already out, or exit has been granted
  const showCheckin = Boolean(pcm && !alreadyOut && !alreadyIn && !exitGranted);

  return (
    <StaffShell>
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Security gate</h1>
        <p className="mt-1 text-sm text-slate-600">
          Check members already on the roll, or open new intake for first-time arrivals.
        </p>
      </div>

      <Link
        href="/staff/pcm/intake"
        className="mt-6 flex items-start gap-4 rounded-2xl border border-nysc-green/30 bg-gradient-to-br from-green-50 to-white p-5 shadow-sm transition hover:border-nysc-green hover:shadow-md"
      >
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-nysc-green text-lg font-bold text-white">
          +
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-bold text-slate-900">New intake</h2>
          <p className="mt-1 text-sm text-slate-600">
            First time at the gate? Scan the call-up QR or enter details, capture photo, and
            create the PCM record — they are checked in automatically.
          </p>
          <span className="mt-3 inline-flex items-center text-sm font-semibold text-nysc-green">
            Open intake →
          </span>
        </div>
      </Link>

      <div className="mt-8">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
          Check-in / check-out
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          Search by call-up or name. Check out requires reason, destination state and LGA.
          Exit-approved members can be checked out immediately.
        </p>
      </div>

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

      <form onSubmit={search} className="mt-4 flex flex-wrap gap-2">
        <input
          className="min-w-[240px] flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm"
          placeholder="Call-up number or name"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          autoFocus
        />
        <button
          type="submit"
          disabled={loading}
          className="rounded-md bg-nysc-green px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {loading ? "Searching…" : "Search"}
        </button>
      </form>

      {notFound && (
        <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-5">
          <p className="text-sm font-semibold text-amber-950">
            No record on the roll for “{q.trim()}”
          </p>
          <p className="mt-1 text-sm text-amber-900">
            This person may need <strong>new intake</strong> before check-in.
          </p>
          <Link
            href={`/staff/pcm/intake`}
            className="mt-4 inline-flex rounded-md bg-nysc-green px-4 py-2.5 text-sm font-semibold text-white"
          >
            Go to new intake
          </Link>
        </div>
      )}

      {pcm && (
        <div className="mt-8 flex flex-col gap-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:flex-row">
          <div className="shrink-0">
            <PcmPhoto url={pcm.photographUrl} alt={pcm.fullName} />
          </div>
          <div className="flex-1">
            <h2 className="text-xl font-bold text-slate-900">{pcm.fullName}</h2>
            <p className="mt-1 font-mono text-sm text-slate-600">{pcm.callUpNumber}</p>
            <p className="mt-2 text-sm text-slate-600">{pcm.institution || "—"}</p>
            <p className="mt-1 text-sm text-slate-600">
              Deployment: {pcm.deploymentState || "—"}
            </p>
            <p className="mt-1 text-sm">
              Status:{" "}
              <span className="font-semibold text-slate-800">{pcm.status || "—"}</span>
            </p>
            {pcm.campExitGrantedAt && !alreadyOut && (
              <p className="mt-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-900">
                Exit approved — granted{" "}
                {new Date(pcm.campExitGrantedAt).toLocaleString()}. Ready for check-out.
              </p>
            )}
            {pcm.checkedOutAt && (
              <p className="mt-1 text-xs text-slate-500">
                Checked out {new Date(pcm.checkedOutAt).toLocaleString()}
                {pcm.exitDestinationState ? ` → ${pcm.exitDestinationState}` : ""}
                {pcm.exitDestinationLga ? ` / ${pcm.exitDestinationLga}` : ""}
                {pcm.exitReason ? ` · ${pcm.exitReason}` : ""}
                {pcm.expectedReturnAt
                  ? ` · return ${new Date(pcm.expectedReturnAt).toLocaleDateString()}`
                  : ""}
              </p>
            )}

            {showCheckin && (
              <div className="mt-5 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => void doCheckin()}
                  className="rounded-md bg-nysc-green px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-40"
                >
                  Check in
                </button>
              </div>
            )}

            {alreadyIn && !showCheckout && !alreadyOut && (
              <p className="mt-3 text-xs text-slate-600">
                Already checked in
                {eligibility?.message ? ` — ${eligibility.message}` : "."}
              </p>
            )}

            {showCheckout && !alreadyOut && (
              <div className="mt-6 space-y-3 border-t border-slate-100 pt-5">
                <p className="text-sm font-semibold text-slate-800">Check out…</p>
                {eligibility?.reason === "exit_granted" && (
                  <p className="text-xs text-amber-800">{eligibility.message}</p>
                )}
                <div>
                  <label className="text-[11px] font-semibold uppercase text-slate-400">
                    Reason
                  </label>
                  <input
                    className="mt-0.5 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                    value={exitReason}
                    onChange={(e) => setExitReason(e.target.value)}
                    placeholder="Reason for exit"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold uppercase text-slate-400">
                    State
                  </label>
                  <select
                    className="mt-0.5 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                    value={exitState}
                    onChange={(e) => {
                      setExitState(e.target.value);
                      setExitLga("");
                    }}
                  >
                    <option value="">Select state</option>
                    {NIGERIA_STATES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-semibold uppercase text-slate-400">
                    LGA
                  </label>
                  <select
                    className="mt-0.5 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                    value={exitLga}
                    onChange={(e) => setExitLga(e.target.value)}
                    disabled={!exitState || lgasLoading}
                  >
                    <option value="">
                      {!exitState
                        ? "Select state first"
                        : lgasLoading
                          ? "Loading LGAs…"
                          : "Select LGA"}
                    </option>
                    {lgas.map((l) => (
                      <option key={l} value={l}>
                        {l}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-semibold uppercase text-slate-400">
                    Date of return
                  </label>
                  <input
                    type="date"
                    className="mt-0.5 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                    value={returnDate}
                    onChange={(e) => setReturnDate(e.target.value)}
                  />
                  <p className="mt-1 text-[11px] text-slate-400">
                    Optional calendar date. Date of check-out is recorded automatically
                    and shown on the member&apos;s profile / checked-out list.
                  </p>
                </div>
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => void doCheckout()}
                  className="rounded-md border border-slate-800 bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-40"
                >
                  Confirm check out
                </button>
              </div>
            )}

            {!showCheckout && eligibility && alreadyIn && (
              <p className="mt-3 text-xs text-amber-800">{eligibility.message}</p>
            )}
          </div>
        </div>
      )}
    </StaffShell>
  );
}
