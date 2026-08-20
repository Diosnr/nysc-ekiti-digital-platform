"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { StaffShell } from "@/components/staff/StaffShell";
import { PcmPhoto } from "@/components/staff/PcmPhoto";
import { staffFetch } from "@/lib/staff-api";

type KitLine = { name: string; size?: string | null; qty?: number };

type KitHistory = {
  at: string;
  by: string;
  items: KitLine[];
  note?: string;
};

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
  kitItems?: KitLine[];
  kitHistory?: KitHistory[];
  kitComplete?: boolean;
  gender?: string | null;
};

type KitSummary = {
  totalActive: number;
  issued: number;
  notIssued: number;
  withPlatoonNoKit: number;
  coveragePct: number;
};

type PlatoonRow = {
  code: string;
  total: number;
  issued: number;
  missing: number;
};

type MissingRow = {
  id: string;
  fullName: string;
  callUpNumber: string;
  stateCode: string | null;
  platoonCode: string | null;
  photographUrl: string | null;
  status: string;
};

const DEFAULT_ITEMS = [
  "Khaki uniform",
  "White vest",
  "Jungle boots",
  "Cap",
  "White socks",
  "Tennis shoes",
  "Belt",
  "NYSC ID card holder",
];

const SIZE_OPTIONS = ["", "XS", "S", "M", "L", "XL", "XXL", "40", "41", "42", "43", "44", "45"];

export default function PlatoonDeskPage() {
  const [tab, setTab] = useState<"kit" | "coverage" | "attendance">("kit");
  const [q, setQ] = useState("");
  const [pcm, setPcm] = useState<PcmHit | null>(null);
  const [selectedNames, setSelectedNames] = useState<string[]>([...DEFAULT_ITEMS]);
  const [sizes, setSizes] = useState<Record<string, string>>({});
  const [issueNote, setIssueNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [canClear, setCanClear] = useState(false);

  const [summary, setSummary] = useState<KitSummary | null>(null);
  const [platoons, setPlatoons] = useState<PlatoonRow[]>([]);
  const [missing, setMissing] = useState<MissingRow[]>([]);
  const [filterPlatoon, setFilterPlatoon] = useState("");
  const [missingQ, setMissingQ] = useState("");

  const loadCoverage = useCallback(async () => {
    const params = new URLSearchParams({ missing: "1" });
    if (filterPlatoon) params.set("platoon", filterPlatoon);
    if (missingQ.trim()) params.set("q", missingQ.trim());
    try {
      const res = await staffFetch(`/api/kit/summary?${params}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return;
      setSummary(data.summary ?? null);
      setPlatoons(data.platoons ?? []);
      setMissing(data.missing ?? []);
    } catch {
      /* ignore */
    }
  }, [filterPlatoon, missingQ]);

  useEffect(() => {
    staffFetch("/api/auth/me").then(async (res) => {
      if (!res.ok) return;
      const me = await res.json();
      const roles: string[] = me.roles ?? [];
      const perms: string[] = me.permissions ?? [];
      setCanClear(
        perms.includes("*") ||
          perms.includes("kit:issue") ||
          roles.some((r) => r.toLowerCase() === "super admin")
      );
    });
  }, []);

  useEffect(() => {
    if (tab === "coverage") void loadCoverage();
  }, [tab, loadCoverage]);

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
        setError("No record found");
        return;
      }
      const hit =
        list.find(
          (p) =>
            p.callUpNumber.toLowerCase() === q.trim().toLowerCase() ||
            (p.stateCode || "").toLowerCase() === q.trim().toLowerCase()
        ) ?? list[0];

      const kitRes = await staffFetch(`/api/pcm/${hit.id}/kit`);
      if (kitRes.ok) {
        const kitData = await kitRes.json();
        const full = kitData.pcm as PcmHit;
        setPcm(full);
        if (full.kitItems?.length) {
          setSelectedNames(full.kitItems.map((i) => i.name));
          const sz: Record<string, string> = {};
          full.kitItems.forEach((i) => {
            if (i.size) sz[i.name] = i.size;
          });
          setSizes(sz);
        } else {
          setSelectedNames([...DEFAULT_ITEMS]);
          setSizes({});
        }
      } else {
        const det = await staffFetch(`/api/pcm/${hit.id}`);
        const full = det.ok ? await det.json() : { pcm: hit };
        setPcm((full.pcm ?? hit) as PcmHit);
        setSelectedNames([...DEFAULT_ITEMS]);
        setSizes({});
      }
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  async function loadPcmById(id: string) {
    setTab("kit");
    setLoading(true);
    setError(null);
    try {
      const kitRes = await staffFetch(`/api/pcm/${id}/kit`);
      if (!kitRes.ok) {
        const data = await kitRes.json().catch(() => ({}));
        setError(data.error ?? "Could not load member");
        return;
      }
      const kitData = await kitRes.json();
      const full = kitData.pcm as PcmHit;
      setPcm(full);
      setQ(full.callUpNumber || full.stateCode || "");
      if (full.kitItems?.length) {
        setSelectedNames(full.kitItems.map((i) => i.name));
        const sz: Record<string, string> = {};
        full.kitItems.forEach((i) => {
          if (i.size) sz[i.name] = i.size;
        });
        setSizes(sz);
      } else {
        setSelectedNames([...DEFAULT_ITEMS]);
        setSizes({});
      }
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
      const items: KitLine[] = selectedNames.map((name) => ({
        name,
        size: sizes[name] || null,
        qty: 1,
      }));
      const res = await staffFetch(`/api/pcm/${pcm.id}/kit`, {
        method: "POST",
        body: JSON.stringify({
          items,
          note: issueNote || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Kit issue failed");
        return;
      }
      setPcm(data.pcm);
      setMsg(
        pcm.kitIssuedAt
          ? `Kit updated · ${data.pcm.kitIssuedByName}`
          : `Kit issued · ${data.pcm.kitIssuedByName}`
      );
      setIssueNote("");
      if (tab === "coverage") void loadCoverage();
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  async function clearKit() {
    if (!pcm || !confirm("Clear kit record for this member?")) return;
    setLoading(true);
    setError(null);
    setMsg(null);
    try {
      const res = await staffFetch(`/api/pcm/${pcm.id}/kit`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Clear failed");
        return;
      }
      setPcm({ ...pcm, kitIssuedAt: null, kitIssuedByName: null, kitItems: [], kitHistory: [], kitComplete: false });
      setMsg("Kit record cleared");
      setSelectedNames([...DEFAULT_ITEMS]);
      setSizes({});
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

  function toggleItem(name: string) {
    setSelectedNames((prev) =>
      prev.includes(name) ? prev.filter((x) => x !== name) : [...prev, name]
    );
  }

  return (
    <StaffShell>
      <h1 className="text-2xl font-bold text-slate-900">Platoon desk</h1>
      <p className="mt-1 text-sm text-slate-600">
        Issue kit (with sizes), track coverage, and take attendance. Platoon is assigned at
        Registration from state code.
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
            ["coverage", "Kit coverage"],
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

      {/* Coverage tab */}
      {tab === "coverage" && (
        <div className="mt-6 space-y-5">
          {summary && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {(
                [
                  ["On roll", summary.totalActive, "slate"],
                  ["Kit issued", summary.issued, "green"],
                  ["Not issued", summary.notIssued, "amber"],
                  ["Coverage", `${summary.coveragePct}%`, "sky"],
                ] as const
              ).map(([label, value, tone]) => (
                <div
                  key={label}
                  className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
                >
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                    {label}
                  </p>
                  <p
                    className={`mt-1 text-2xl font-bold tabular-nums ${
                      tone === "green"
                        ? "text-emerald-800"
                        : tone === "amber"
                          ? "text-amber-900"
                          : tone === "sky"
                            ? "text-sky-900"
                            : "text-slate-900"
                    }`}
                  >
                    {value}
                  </p>
                </div>
              ))}
            </div>
          )}

          {platoons.length > 0 && (
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
                By platoon
              </h2>
              <ul className="mt-3 space-y-2">
                {platoons.map((p) => {
                  const pct = p.total ? Math.round((p.issued / p.total) * 100) : 0;
                  return (
                    <li key={p.code}>
                      <button
                        type="button"
                        onClick={() =>
                          setFilterPlatoon((v) => (v === p.code ? "" : p.code))
                        }
                        className="w-full text-left"
                      >
                        <div className="flex justify-between text-sm">
                          <span
                            className={`font-medium ${
                              filterPlatoon === p.code
                                ? "text-nysc-green"
                                : "text-slate-900"
                            }`}
                          >
                            Platoon {p.code}
                          </span>
                          <span className="text-xs text-slate-500">
                            {p.issued}/{p.total} · {p.missing} missing
                          </span>
                        </div>
                        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100">
                          <div
                            className="h-full rounded-full bg-nysc-green"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
                Awaiting kit
                {filterPlatoon ? ` · Platoon ${filterPlatoon}` : ""}
              </h2>
              <div className="flex gap-2">
                <input
                  className="rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                  placeholder="Search missing…"
                  value={missingQ}
                  onChange={(e) => setMissingQ(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && void loadCoverage()}
                />
                <button
                  type="button"
                  onClick={() => void loadCoverage()}
                  className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium"
                >
                  Refresh
                </button>
              </div>
            </div>
            {missing.length === 0 ? (
              <p className="mt-4 text-sm text-slate-500">No members waiting for kit.</p>
            ) : (
              <ul className="mt-3 divide-y divide-slate-100">
                {missing.map((m) => (
                  <li key={m.id}>
                    <button
                      type="button"
                      onClick={() => void loadPcmById(m.id)}
                      className="flex w-full items-center gap-3 py-3 text-left hover:bg-slate-50"
                    >
                      <PcmPhoto url={m.photographUrl} alt="" sizeClass="h-10 w-10" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-slate-900">
                          {m.fullName}
                        </p>
                        <p className="font-mono text-[11px] text-slate-500">
                          {m.callUpNumber}
                          {m.stateCode ? ` · ${m.stateCode}` : ""}
                          {m.platoonCode ? ` · Pl ${m.platoonCode}` : " · No platoon"}
                        </p>
                      </div>
                      <span className="text-xs font-medium text-nysc-green">Issue →</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {/* Kit / Attendance search */}
      {(tab === "kit" || tab === "attendance") && (
        <>
          <form onSubmit={search} className="mt-6 flex flex-wrap gap-2">
            <input
              className="min-w-[220px] flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm"
              placeholder="State code, call-up, or name"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            <button
              type="button"
              disabled={loading}
              onClick={(e) => void search(e as unknown as FormEvent)}
              className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium"
            >
              {loading ? "…" : "Find"}
            </button>
          </form>

          {pcm && (
            <div className="mt-6 max-w-xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex gap-4">
                <PcmPhoto
                  url={pcm.photographUrl}
                  alt={pcm.fullName}
                  sizeClass="h-16 w-16"
                />
                <div>
                  <p className="text-lg font-bold text-slate-900">{pcm.fullName}</p>
                  <p className="font-mono text-sm text-slate-600">{pcm.callUpNumber}</p>
                  {pcm.stateCode && (
                    <p className="font-mono text-xs text-slate-500">{pcm.stateCode}</p>
                  )}
                  <p className="mt-1 text-xs text-slate-500">
                    {pcm.platoonCode
                      ? `Platoon ${pcm.platoonCode}`
                      : "Platoon not assigned"}{" "}
                    · {pcm.status}
                    {pcm.gender ? ` · ${pcm.gender}` : ""}
                  </p>
                  {pcm.kitIssuedAt && (
                    <p className="mt-1 text-xs font-medium text-green-700">
                      Kit issued {new Date(pcm.kitIssuedAt).toLocaleString()}
                      {pcm.kitIssuedByName ? ` · ${pcm.kitIssuedByName}` : ""}
                    </p>
                  )}
                  {!pcm.platoonCode && tab === "kit" && (
                    <p className="mt-1 text-xs text-amber-700">
                      Platoon required before kit issue (Registration assigns from state
                      code).
                    </p>
                  )}
                </div>
              </div>

              {tab === "kit" && (
                <div className="mt-5 space-y-4 border-t border-slate-100 pt-4">
                  <p className="text-xs font-semibold uppercase text-slate-500">
                    Items & sizes
                  </p>
                  <ul className="space-y-2">
                    {DEFAULT_ITEMS.map((item) => {
                      const checked = selectedNames.includes(item);
                      return (
                        <li
                          key={item}
                          className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-100 px-2 py-2"
                        >
                          <label className="flex min-w-[10rem] flex-1 items-center gap-2 text-sm">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleItem(item)}
                            />
                            {item}
                          </label>
                          <select
                            disabled={!checked}
                            className="rounded-md border border-slate-300 px-2 py-1 text-xs disabled:opacity-40"
                            value={sizes[item] || ""}
                            onChange={(e) =>
                              setSizes((prev) => ({ ...prev, [item]: e.target.value }))
                            }
                          >
                            <option value="">Size —</option>
                            {SIZE_OPTIONS.filter(Boolean).map((s) => (
                              <option key={s} value={s}>
                                {s}
                              </option>
                            ))}
                          </select>
                        </li>
                      );
                    })}
                  </ul>

                  <div>
                    <label className="text-xs font-semibold uppercase text-slate-500">
                      Note (optional)
                    </label>
                    <input
                      className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                      placeholder="e.g. boots size special order"
                      value={issueNote}
                      onChange={(e) => setIssueNote(e.target.value)}
                    />
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={loading || !selectedNames.length}
                      onClick={() => void issueKit()}
                      className="rounded-md bg-nysc-green px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
                    >
                      {pcm.kitIssuedAt ? "Update / re-issue kit" : "Confirm kit issue"}
                    </button>
                    {canClear && pcm.kitIssuedAt && (
                      <button
                        type="button"
                        disabled={loading}
                        onClick={() => void clearKit()}
                        className="rounded-md border border-red-200 px-3 py-2.5 text-sm font-medium text-red-700"
                      >
                        Clear kit
                      </button>
                    )}
                  </div>

                  {pcm.kitHistory && pcm.kitHistory.length > 0 && (
                    <div className="border-t border-slate-100 pt-3">
                      <p className="text-xs font-semibold uppercase text-slate-400">
                        Issue history
                      </p>
                      <ul className="mt-2 space-y-2">
                        {[...pcm.kitHistory].reverse().map((h, i) => (
                          <li
                            key={i}
                            className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600"
                          >
                            <p className="font-medium text-slate-800">
                              {new Date(h.at).toLocaleString()} · {h.by}
                            </p>
                            {h.note && <p className="mt-0.5">{h.note}</p>}
                            <p className="mt-1 text-slate-500">
                              {h.items
                                .map(
                                  (it) =>
                                    it.name +
                                    (it.size ? ` (${it.size})` : "")
                                )
                                .join(", ")}
                            </p>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
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
        </>
      )}
    </StaffShell>
  );
}
