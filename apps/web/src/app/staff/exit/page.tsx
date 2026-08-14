"use client";

import { FormEvent, useState } from "react";
import { StaffShell } from "@/components/staff/StaffShell";
import { PcmPhoto } from "@/components/staff/PcmPhoto";
import { staffFetch } from "@/lib/staff-api";

type PcmHit = {
  id: string;
  callUpNumber: string;
  fullName: string;
  status?: string;
  photographUrl?: string | null;
  deploymentState?: string | null;
  dateReporting?: string | null;
  campExitGrantedAt?: string | null;
  institution?: string | null;
};

export default function GrantExitPage() {
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
        `/api/pcm?q=${encodeURIComponent(q.trim())}&callUp=${encodeURIComponent(q.trim())}`
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Search failed");
        return;
      }
      const list = (data.pcms ?? []) as PcmHit[];
      if (!list.length) {
        setError("No PCM found");
        return;
      }
      const exact = list.find(
        (p) => p.callUpNumber.toLowerCase() === q.trim().toLowerCase()
      );
      const hit = exact ?? list[0];
      const det = await staffFetch(`/api/pcm/${hit.id}`);
      const full = await det.json();
      setPcm((full.pcm ?? hit) as PcmHit);
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  async function grant() {
    if (!pcm) return;
    if (
      !confirm(
        `Grant camp exit for ${pcm.fullName}?\n\nSecurity will then be allowed to check them out (before the 3-week rule).`
      )
    ) {
      return;
    }
    setLoading(true);
    setError(null);
    setMsg(null);
    try {
      const res = await staffFetch(`/api/pcm/${pcm.id}/grant-exit`, {
        method: "POST",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Could not grant exit");
        return;
      }
      setMsg(data.message ?? "Camp exit granted");
      setPcm({
        ...pcm,
        ...data.pcm,
        photographUrl: data.pcm?.photographUrl || pcm.photographUrl,
      });
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  async function revoke() {
    if (!pcm) return;
    if (!confirm(`Revoke exit grant for ${pcm.fullName}?`)) return;
    setLoading(true);
    setError(null);
    setMsg(null);
    try {
      const res = await staffFetch(`/api/pcm/${pcm.id}/grant-exit`, {
        method: "DELETE",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Could not revoke");
        return;
      }
      setMsg("Exit grant revoked");
      setPcm({
        ...pcm,
        ...data.pcm,
        campExitGrantedAt: null,
        photographUrl: data.pcm?.photographUrl || pcm.photographUrl,
      });
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  const alreadyGranted = Boolean(pcm?.campExitGrantedAt);
  const alreadyOut =
    pcm?.status === "CHECKED_OUT" || pcm?.status === "CAMP_EXITED";

  return (
    <StaffShell>
      <h1 className="text-2xl font-bold text-slate-900">Grant camp exit</h1>
      <p className="mt-1 text-sm text-slate-600">
        State Coordinator / Camp Director approval so Security can check a corps member
        out before the automatic 3-week rule.
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

            {alreadyGranted && (
              <p className="mt-3 text-sm font-medium text-green-700">
                Exit granted
                {pcm.campExitGrantedAt
                  ? ` · ${new Date(pcm.campExitGrantedAt).toLocaleString()}`
                  : ""}
              </p>
            )}
            {alreadyOut && (
              <p className="mt-2 text-sm text-slate-600">Already checked out / exited camp.</p>
            )}

            <div className="mt-6 flex flex-wrap gap-3">
              {!alreadyGranted && !alreadyOut && (
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => void grant()}
                  className="rounded-md bg-nysc-green px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-40"
                >
                  Approve exit grant
                </button>
              )}
              {alreadyGranted && !alreadyOut && (
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => void revoke()}
                  className="rounded-md border border-red-300 bg-red-50 px-5 py-2.5 text-sm font-semibold text-red-700 disabled:opacity-40"
                >
                  Revoke grant
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </StaffShell>
  );
}
