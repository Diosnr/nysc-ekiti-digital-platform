"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { StaffShell } from "@/components/staff/StaffShell";
import { PcmPhoto } from "@/components/staff/PcmPhoto";
import { staffFetch } from "@/lib/staff-api";
import { evaluateCheckoutEligibility } from "@/lib/dates";

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
};

export default function SecurityGatePage() {
  const [q, setQ] = useState("");
  const [pcm, setPcm] = useState<PcmHit | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function search(e?: FormEvent) {
    e?.preventDefault();
    setError(null);
    setMsg(null);
    setPcm(null);
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
        setError("No PCM found. Complete intake first, or check the call-up number.");
        return;
      }
      // Prefer exact call-up match if several
      const exact = list.find(
        (p) => p.callUpNumber.toLowerCase() === q.trim().toLowerCase()
      );
      setPcm(exact ?? list[0]);
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  async function gate(action: "checkin" | "checkout") {
    if (!pcm) return;
    setLoading(true);
    setError(null);
    setMsg(null);
    try {
      const res = await staffFetch(`/api/pcm/${pcm.id}/${action}`, {
        method: "POST",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? `${action} failed`);
        return;
      }
      setMsg(
        action === "checkin"
          ? `Checked in: ${data.pcm.fullName}`
          : `Checked out: ${data.pcm.fullName}`
      );
      // Keep existing photo if API payload omits it
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

  return (
    <StaffShell>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Security gate</h1>
          <p className="mt-1 text-sm text-slate-600">
            Search by call-up or name. Check out only after exit grant or 3 weeks from reporting.
          </p>
        </div>
        <Link
          href="/staff/pcm/intake"
          className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-800"
        >
          PCM Intake
        </Link>
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

      <form onSubmit={search} className="mt-6 flex flex-wrap gap-2">
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

      {pcm && (
        <div className="mt-8 flex flex-col gap-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:flex-row">
          <div className="shrink-0">
            <PcmPhoto url={pcm.photographUrl} alt={pcm.fullName} />
            {!pcm.photographUrl && (
              <p className="mt-2 max-w-[10rem] text-center text-[11px] text-slate-400">
                No photo on file — re-do intake with photo if needed
              </p>
            )}
          </div>
          <div className="flex-1">
            <h2 className="text-xl font-bold text-slate-900">{pcm.fullName}</h2>
            <p className="mt-1 font-mono text-sm text-slate-600">{pcm.callUpNumber}</p>
            <p className="mt-2 text-sm text-slate-600">{pcm.institution || "—"}</p>
            <p className="mt-1 text-sm text-slate-600">
              Deployment: {pcm.deploymentState || "—"}
            </p>
            <p className="mt-1 text-sm text-slate-600">
              Reporting: {pcm.dateReporting || "—"}
            </p>
            <p className="mt-3 inline-flex rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-800">
              {pcm.status}
            </p>
            {pcm.campExitGrantedAt && (
              <p className="mt-2 text-xs font-medium text-green-700">Exit granted by admin</p>
            )}

            <div className="mt-6 flex flex-wrap gap-3">
              <button
                type="button"
                disabled={loading || pcm.status === "CHECKED_IN"}
                onClick={() => void gate("checkin")}
                className="rounded-md bg-nysc-green px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-40"
              >
                Check in
              </button>
              {showCheckout && (
                <button
                  type="button"
                  disabled={loading || pcm.status === "CHECKED_OUT"}
                  onClick={() => void gate("checkout")}
                  className="rounded-md border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-800 disabled:opacity-40"
                >
                  Check out
                </button>
              )}
            </div>

            {!showCheckout && eligibility && pcm.status === "CHECKED_IN" && (
              <p className="mt-3 text-xs text-amber-800">{eligibility.message}</p>
            )}
            {!showCheckout &&
              eligibility &&
              pcm.status !== "CHECKED_IN" &&
              pcm.status !== "CHECKED_OUT" && (
                <p className="mt-3 text-xs text-slate-500">{eligibility.message}</p>
              )}
          </div>
        </div>
      )}
    </StaffShell>
  );
}
