"use client";

import { FormEvent, useState } from "react";
import { StaffShell } from "@/components/staff/StaffShell";
import { PcmPhoto } from "@/components/staff/PcmPhoto";
import { staffFetch } from "@/lib/staff-api";

type PcmHit = {
  id: string;
  callUpNumber: string;
  fullName: string;
  photographUrl?: string | null;
  status?: string;
  stateCode?: string | null;
  platoonCode?: string | null;
  kitIssuedAt?: string | null;
  kitIssuedByName?: string | null;
};

const KIT_ITEMS = [
  "Khaki uniform",
  "White vest",
  "Jungle boots",
  "Cap / beret",
  "Belt",
  "NYSC ID card holder",
];

export default function PlatoonDeskPage() {
  const [tab, setTab] = useState<"kit" | "attendance">("kit");
  const [q, setQ] = useState("");
  const [pcm, setPcm] = useState<PcmHit | null>(null);
  const [kitItems, setKitItems] = useState<string[]>([...KIT_ITEMS]);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function search(e: FormEvent) {
    e.preventDefault();
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
      const hit =
        list.find(
          (p) =>
            p.callUpNumber.toLowerCase() === q.trim().toLowerCase() ||
            (p.stateCode || "").toLowerCase() === q.trim().toLowerCase()
        ) ?? list[0];
      const det = await staffFetch(`/api/pcm/${hit.id}`);
      const full = det.ok ? await det.json() : { pcm: hit };
      setPcm((full.pcm ?? hit) as PcmHit);
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  async function issueKit() {
    if (!pcm) return;
    setLoading(true);
    setError(null);
    setMsg(null);
    try {
      const res = await staffFetch(`/api/pcm/${pcm.id}/kit`, {
        method: "POST",
        body: JSON.stringify({ items: kitItems }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Kit issue failed");
        return;
      }
      setPcm(data.pcm);
      setMsg(`Kit issued by ${data.pcm.kitIssuedByName}`);
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  async function markAttendance(present: boolean) {
    if (!pcm) return;
    setLoading(true);
    setError(null);
    setMsg(null);
    try {
      const res = await staffFetch(`/api/pcm/${pcm.id}/attendance`, {
        method: "POST",
        body: JSON.stringify({ present }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Attendance failed");
        return;
      }
      setMsg(present ? "Marked present today" : "Marked absent today");
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  function toggleKit(item: string) {
    setKitItems((prev) =>
      prev.includes(item) ? prev.filter((x) => x !== item) : [...prev, item]
    );
  }

  return (
    <StaffShell>
      <h1 className="text-2xl font-bold text-slate-900">Platoon desk</h1>
      <p className="mt-1 text-sm text-slate-600">
        Issue kit and take attendance. Platoon assignment is done by Registration (from state
        code).
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

      <div className="mt-6 flex flex-wrap gap-2">
        {(
          [
            ["kit", "Issue kit"],
            ["attendance", "Attendance"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium ${
              tab === id
                ? "bg-nysc-green text-white"
                : "bg-white text-slate-700 ring-1 ring-slate-200"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <form onSubmit={search} className="mt-6 flex flex-wrap gap-2">
        <input
          className="min-w-[220px] flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm"
          placeholder="State code, call-up, or name"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <button
          type="submit"
          disabled={loading}
          className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium"
        >
          {loading ? "…" : "Find"}
        </button>
      </form>

      {pcm && (
        <div className="mt-6 max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex gap-4">
            <PcmPhoto url={pcm.photographUrl} alt={pcm.fullName} sizeClass="h-16 w-16" />
            <div>
              <p className="text-lg font-bold text-slate-900">{pcm.fullName}</p>
              <p className="font-mono text-sm text-slate-600">{pcm.callUpNumber}</p>
              {pcm.stateCode && (
                <p className="font-mono text-xs text-slate-500">{pcm.stateCode}</p>
              )}
              <p className="mt-1 text-xs text-slate-500">
                {pcm.platoonCode ? `Platoon ${pcm.platoonCode}` : "Platoon not assigned"} ·{" "}
                {pcm.status}
              </p>
              {pcm.kitIssuedAt && (
                <p className="text-xs text-green-700">
                  Kit issued
                  {pcm.kitIssuedByName ? ` · ${pcm.kitIssuedByName}` : ""}
                </p>
              )}
            </div>
          </div>

          {tab === "kit" && (
            <div className="mt-5 space-y-3 border-t border-slate-100 pt-4">
              <p className="text-xs font-semibold uppercase text-slate-500">Items issued</p>
              <ul className="space-y-2">
                {KIT_ITEMS.map((item) => (
                  <li key={item}>
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={kitItems.includes(item)}
                        onChange={() => toggleKit(item)}
                      />
                      {item}
                    </label>
                  </li>
                ))}
              </ul>
              <button
                type="button"
                disabled={loading || !kitItems.length}
                onClick={() => void issueKit()}
                className="rounded-md bg-nysc-green px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                Confirm kit issue
              </button>
            </div>
          )}

          {tab === "attendance" && (
            <div className="mt-5 flex flex-wrap gap-3 border-t border-slate-100 pt-4">
              <button
                type="button"
                disabled={loading}
                onClick={() => void markAttendance(true)}
                className="rounded-md bg-nysc-green px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                Present today
              </button>
              <button
                type="button"
                disabled={loading}
                onClick={() => void markAttendance(false)}
                className="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-800 disabled:opacity-50"
              >
                Absent today
              </button>
            </div>
          )}
        </div>
      )}
    </StaffShell>
  );
}
