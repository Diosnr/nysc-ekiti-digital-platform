"use client";

import { FormEvent, useState } from "react";
import { StaffShell } from "@/components/staff/StaffShell";
import { staffFetch } from "@/lib/staff-api";

type PcmHit = {
  id: string;
  callUpNumber: string;
  fullName: string;
  gender?: string | null;
  institution?: string | null;
  status?: string;
  photographUrl?: string | null;
  deploymentState?: string | null;
};

export default function SecurityCheckinPage() {
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
        setError("No PCM found for that call-up / name. Complete intake first.");
        return;
      }
      setPcm(list[0]);
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  async function markCheckedIn() {
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
      setMsg(`Checked in: ${data.pcm.fullName} (${data.pcm.callUpNumber})`);
      setPcm({ ...pcm, status: data.pcm.status });
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <StaffShell>
      <h1 className="text-2xl font-bold text-slate-900">Security check-in</h1>
      <p className="mt-1 text-sm text-slate-600">
        Look up by call-up number or name, confirm identity and photo, then mark checked in.
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
            {pcm.photographUrl && /^https?:\/\//i.test(pcm.photographUrl) ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={pcm.photographUrl}
                alt={pcm.fullName}
                className="h-36 w-36 rounded-xl border object-cover"
              />
            ) : (
              <div className="flex h-36 w-36 items-center justify-center rounded-xl bg-slate-100 text-sm text-slate-400">
                No photo
              </div>
            )}
          </div>
          <div className="flex-1">
            <h2 className="text-xl font-bold text-slate-900">{pcm.fullName}</h2>
            <p className="mt-1 font-mono text-sm text-slate-600">{pcm.callUpNumber}</p>
            <p className="mt-2 text-sm text-slate-600">{pcm.institution || "—"}</p>
            <p className="mt-1 text-sm text-slate-600">
              Deployment: {pcm.deploymentState || "—"}
            </p>
            <p className="mt-2 inline-flex rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-800">
              {pcm.status}
            </p>
            <div className="mt-6">
              <button
                type="button"
                disabled={loading || pcm.status === "CHECKED_IN"}
                onClick={() => void markCheckedIn()}
                className="rounded-md bg-nysc-green px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
              >
                {pcm.status === "CHECKED_IN" ? "Already checked in" : "Mark checked in"}
              </button>
            </div>
          </div>
        </div>
      )}
    </StaffShell>
  );
}
