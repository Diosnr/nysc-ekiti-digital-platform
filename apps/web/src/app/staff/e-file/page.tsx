"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { StaffShell } from "@/components/staff/StaffShell";
import { PcmPhoto } from "@/components/staff/PcmPhoto";
import { staffFetch } from "@/lib/staff-api";
import {
  EXIT_GROUNDS,
  groundLabel,
  stageLabel,
  stageForRoles,
  canInitiateExit,
  canActOnStage,
  firstStageAfterInitiation,
  type ExitStage,
} from "@/lib/exit-workflow";

type Me = {
  user: { name: string | null; email: string };
  roles: string[];
  permissions: string[];
};

type GroundOpt = {
  code: string;
  label: string;
  requiresClinic: boolean;
  isActive?: boolean;
};

type Officer = {
  id: string;
  name: string;
  email: string;
  roles: string[];
  suggested?: boolean;
};

type ExitReq = {
  id: string;
  ground: string;
  reasonDetail: string | null;
  stage: ExitStage;
  photoUrls: string[];
  photoCount?: number;
  initiatedByName: string;
  initiatedAt: string;
  nextAssigneeName?: string | null;
  clinicByName?: string | null;
  clinicNote?: string | null;
  directorByName?: string | null;
  directorNote?: string | null;
  coordinatorByName?: string | null;
  coordinatorNote?: string | null;
  rejectedByName?: string | null;
  rejectReason?: string | null;
  pcm: {
    id: string;
    callUpNumber: string;
    fullName: string;
    photographUrl?: string | null;
    institution?: string | null;
    deploymentState?: string | null;
    dateReporting?: string | null;
  };
};

type Tab = "my_queue" | "pending" | "approved" | "rejected" | "create";

export default function EFilingPage() {
  const [me, setMe] = useState<Me | null>(null);
  const [tab, setTab] = useState<Tab | null>(null);
  const [list, setList] = useState<ExitReq[]>([]);
  const [selected, setSelected] = useState<ExitReq | null>(null);
  const [photosLoading, setPhotosLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [note, setNote] = useState("");
  const [q, setQ] = useState("");
  const [pcmHit, setPcmHit] = useState<{
    id: string;
    callUpNumber: string;
    fullName: string;
    photographUrl?: string | null;
  } | null>(null);
  const [ground, setGround] = useState("MARITAL");
  const [reasonDetail, setReasonDetail] = useState("");
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);
  const [subject, setSubject] = useState("");
  const [grounds, setGrounds] = useState<GroundOpt[]>(
    EXIT_GROUNDS.map((g) => ({
      code: g.value,
      label: g.label,
      requiresClinic: g.value === "MEDICAL",
    }))
  );
  const [officers, setOfficers] = useState<Officer[]>([]);
  const [nextToUserId, setNextToUserId] = useState("");

  useEffect(() => {
    staffFetch("/api/auth/me").then(async (res) => {
      if (!res.ok) return;
      const data = (await res.json()) as Me;
      setMe(data);
      const roles = data.roles ?? [];
      const perms = data.permissions ?? [];
      const canStart = canInitiateExit(roles, perms);
      const stage = stageForRoles(roles);
      setTab(canStart && !stage ? "create" : "my_queue");
    });
    staffFetch("/api/exit-grounds")
      .then(async (res) => {
        if (!res.ok) return;
        const data = await res.json();
        const items = ((data.items ?? []) as GroundOpt[]).filter(
          (g) => g.isActive !== false
        );
        if (items.length) {
          setGrounds(items);
          setGround(items[0].code);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (tab !== "create") return;
    const g = grounds.find((x) => x.code === ground);
    const stage = firstStageAfterInitiation(ground, g?.requiresClinic);
    staffFetch(`/api/e-file/officers?stage=${stage}`)
      .then(async (res) => {
        if (!res.ok) return;
        const data = await res.json();
        const list = (data.officers ?? []) as Officer[];
        setOfficers(list);
        const sug = list.find((o) => o.suggested);
        setNextToUserId(sug?.id || "");
      })
      .catch(() => setOfficers([]));
  }, [tab, ground, grounds]);

  const roles = me?.roles ?? [];
  const perms = me?.permissions ?? [];
  const myStage = stageForRoles(roles);
  const canStart = me ? canInitiateExit(roles, perms) : false;
  const activeTab = tab ?? "my_queue";

  const loadList = useCallback(async () => {
    if (!tab || tab === "create") return;
    setLoading(true);
    setError(null);
    try {
      let url = "/api/exit-requests?bucket=pending";
      if (tab === "approved") url = "/api/exit-requests?bucket=approved";
      if (tab === "rejected") url = "/api/exit-requests?bucket=rejected";
      if (tab === "my_queue" && myStage) url = `/api/exit-requests?stage=${myStage}`;
      if (tab === "my_queue" && !myStage && canStart) url = "/api/exit-requests?mine=1";
      if (tab === "my_queue" && !myStage && !canStart)
        url = "/api/exit-requests?bucket=pending";
      const res = await staffFetch(url);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Failed to load");
        return;
      }
      setList(data.requests ?? []);
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }, [tab, myStage, canStart]);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  function openDetail(row: ExitReq) {
    setError(null);
    setNote("");
    setSelected({ ...row, photoUrls: row.photoUrls ?? [] });
    if ((row.photoCount ?? 0) > 0 || (row.photoUrls?.length ?? 0) > 0) {
      setPhotosLoading(true);
      staffFetch(`/api/exit-requests/${row.id}?photos=1`)
        .then(async (res) => {
          if (!res.ok) return;
          const data = await res.json();
          const full = data.request as ExitReq;
          setSelected((prev) =>
            prev && prev.id === row.id
              ? { ...prev, ...full, pcm: { ...prev.pcm, ...full.pcm } }
              : prev
          );
        })
        .catch(() => {})
        .finally(() => setPhotosLoading(false));
    }
  }

  async function decide(decision: "approve" | "reject") {
    if (!selected) return;
    setLoading(true);
    setError(null);
    setMsg(null);
    try {
      const res = await staffFetch(`/api/exit-requests/${selected.id}`, {
        method: "PATCH",
        body: JSON.stringify({ decision, note: note || undefined }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Action failed");
        return;
      }
      setMsg(decision === "approve" ? "Approved — moved to next stage" : "Returned");
      setSelected(null);
      await loadList();
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  async function searchPcm(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setPcmHit(null);
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
      const hits = data.pcms ?? [];
      if (!hits.length) {
        setError("No PCM found");
        return;
      }
      const hit =
        hits.find(
          (p: { callUpNumber: string }) =>
            p.callUpNumber.toLowerCase() === q.trim().toLowerCase()
        ) ?? hits[0];
      setPcmHit(hit);
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  async function initiate(e: FormEvent) {
    e.preventDefault();
    if (!pcmHit) return;
    setLoading(true);
    setError(null);
    setMsg(null);
    try {
      const res = await staffFetch("/api/exit-requests", {
        method: "POST",
        body: JSON.stringify({
          pcmId: pcmHit.id,
          ground,
          reasonDetail: reasonDetail || subject || undefined,
          photoUrls,
          nextToUserId: nextToUserId || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Could not open file");
        return;
      }
      setMsg("File opened and forwarded");
      setPcmHit(null);
      setQ("");
      setReasonDetail("");
      setSubject("");
      setPhotoUrls([]);
      setTab("my_queue");
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  function onPhotoFiles(files: FileList | null) {
    if (!files?.length) return;
    Array.from(files)
      .slice(0, 4)
      .forEach((file) => {
        const reader = new FileReader();
        reader.onload = () => {
          const url = String(reader.result || "");
          if (url) setPhotoUrls((prev) => [...prev, url].slice(0, 6));
        };
        reader.readAsDataURL(file);
      });
  }

  const tabs: { id: Tab; label: string }[] = [
    {
      id: "my_queue",
      label: myStage ? "Pending for me" : canStart ? "My filings" : "Pending for me",
    },
    { id: "pending", label: "All pending" },
    { id: "approved", label: "Approved" },
    { id: "rejected", label: "Returned / rejected" },
  ];

  return (
    <StaffShell>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">E-Filing</h1>
          <p className="mt-1 max-w-xl text-sm text-slate-600">
            Digital minutes on corps member files — pick a file, write a minute, forward or
            approve. Camp exit uses the same desk with its approval chain.
          </p>
        </div>
        {canStart && (
          <button
            type="button"
            onClick={() => {
              setTab("create");
              setSelected(null);
              setError(null);
              setMsg(null);
            }}
            className="inline-flex items-center gap-2 rounded-full bg-nysc-green px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700"
          >
            <span className="text-lg leading-none">+</span>
            Create file
          </button>
        )}
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        {(
          [
            ["my_queue", "Pending for me", "slate"],
            ["approved", "Approved", "emerald"],
            ["rejected", "Returned / rejected", "rose"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`rounded-2xl border bg-white p-4 text-left shadow-sm ${
              activeTab === id
                ? "border-nysc-green ring-1 ring-nysc-green/30"
                : "border-slate-200"
            }`}
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              {label}
            </p>
            <p className="mt-1 text-2xl font-bold tabular-nums text-slate-900">
              {activeTab === id ? list.length : "—"}
            </p>
          </button>
        ))}
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

      <div className="mt-6 flex flex-wrap gap-2 border-b border-slate-200 pb-2">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => {
              setTab(t.id);
              setSelected(null);
            }}
            className={`rounded-md px-3 py-1.5 text-sm font-medium ${
              activeTab === t.id
                ? "bg-nysc-green text-white"
                : "bg-white text-slate-700 ring-1 ring-slate-200"
            }`}
          >
            {t.label}
          </button>
        ))}
        {canStart && (
          <button
            type="button"
            onClick={() => {
              setTab("create");
              setSelected(null);
            }}
            className={`rounded-md px-3 py-1.5 text-sm font-medium ${
              activeTab === "create"
                ? "bg-nysc-green text-white"
                : "bg-white text-slate-700 ring-1 ring-slate-200"
            }`}
          >
            Create file
          </button>
        )}
      </div>

      {activeTab === "create" && canStart && (
        <div className="mt-6 max-w-xl space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div>
            <h2 className="font-semibold text-slate-900">Create file</h2>
            <p className="mt-1 text-xs text-slate-500">
              Type: <strong>Camp exit</strong>. Grounds come from admin catalogue. Choose who
              receives it next or keep the default chain.
            </p>
          </div>
          <form onSubmit={searchPcm} className="flex gap-2">
            <input
              className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm"
              placeholder="State code, call-up or name"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            <button type="submit" className="rounded-md border border-slate-300 px-3 py-2 text-sm">
              Find
            </button>
          </form>
          {pcmHit && (
            <form onSubmit={initiate} className="space-y-3 border-t border-slate-100 pt-4">
              <div className="flex gap-3">
                <PcmPhoto
                  url={pcmHit.photographUrl}
                  alt={pcmHit.fullName}
                  sizeClass="h-14 w-14"
                />
                <div>
                  <p className="font-semibold">{pcmHit.fullName}</p>
                  <p className="font-mono text-xs text-slate-600">{pcmHit.callUpNumber}</p>
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold uppercase text-slate-500">Subject</label>
                <input
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                />
              </div>
              <div>
                <label className="text-xs font-semibold uppercase text-slate-500">
                  Exit ground *
                </label>
                <select
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  value={ground}
                  onChange={(e) => setGround(e.target.value)}
                >
                  {grounds.map((g) => (
                    <option key={g.code} value={g.code}>
                      {g.label}
                      {g.requiresClinic ? " (via clinic)" : ""}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold uppercase text-slate-500">
                  Send next to
                </label>
                <select
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  value={nextToUserId}
                  onChange={(e) => setNextToUserId(e.target.value)}
                >
                  <option value="">Default chain (role-based)</option>
                  {officers.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.suggested ? "★ " : ""}
                      {o.name}
                      {o.roles[0] ? ` · ${o.roles[0]}` : ""}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-[11px] text-slate-400">
                  ★ = suggested for the next stage. Blank = standard role chain.
                </p>
              </div>
              <div>
                <label className="text-xs font-semibold uppercase text-slate-500">Minute</label>
                <textarea
                  rows={4}
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  value={reasonDetail}
                  onChange={(e) => setReasonDetail(e.target.value)}
                />
              </div>
              <div>
                <label className="text-xs font-semibold uppercase text-slate-500">
                  Attachments
                </label>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="mt-1 block w-full text-sm"
                  onChange={(e) => onPhotoFiles(e.target.files)}
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-md bg-nysc-green px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
              >
                {loading ? "Opening…" : "Forward file"}
              </button>
            </form>
          )}
        </div>
      )}

      {activeTab !== "create" && (
        <div className="mt-6">
          {loading && !list.length ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-16 animate-pulse rounded-xl bg-slate-200" />
              ))}
            </div>
          ) : list.length === 0 ? (
            <p className="text-sm text-slate-500">No files in this list.</p>
          ) : (
            <ul className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white">
              {list.map((r) => (
                <li key={r.id}>
                  <button
                    type="button"
                    onClick={() => openDetail(r)}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-slate-50"
                  >
                    <PcmPhoto
                      url={r.pcm.photographUrl}
                      alt={r.pcm.fullName}
                      sizeClass="h-12 w-12"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-slate-900">{r.pcm.fullName}</p>
                      <p className="font-mono text-xs text-slate-500">{r.pcm.callUpNumber}</p>
                      <p className="mt-0.5 text-xs text-slate-600">
                        <span className="font-medium text-nysc-green">
                          Camp exit · {groundLabel(r.ground, grounds)}
                        </span>
                        {" · "}
                        {stageLabel(r.stage)}
                        {" · "}
                        {r.initiatedByName}
                        {r.nextAssigneeName ? ` → ${r.nextAssigneeName}` : ""}
                      </p>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {selected && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <button
            type="button"
            className="absolute inset-0 bg-black/40"
            aria-label="Close"
            onClick={() => setSelected(null)}
          />
          <aside className="relative z-10 flex h-full w-full max-w-lg flex-col overflow-y-auto bg-white shadow-xl">
            <div className="border-b border-slate-200 p-5">
              <button
                type="button"
                className="text-sm text-slate-500"
                onClick={() => setSelected(null)}
              >
                ← Close
              </button>
              <div className="mt-3 flex gap-4">
                <PcmPhoto
                  url={selected.pcm.photographUrl}
                  alt={selected.pcm.fullName}
                  sizeClass="h-24 w-24"
                />
                <div>
                  <h2 className="text-lg font-bold">{selected.pcm.fullName}</h2>
                  <p className="font-mono text-sm text-slate-600">{selected.pcm.callUpNumber}</p>
                  <p className="mt-2 text-xs font-semibold text-amber-900">
                    {groundLabel(selected.ground, grounds)} · {stageLabel(selected.stage)}
                  </p>
                </div>
              </div>
            </div>
            <div className="space-y-4 p-5 text-sm">
              {selected.reasonDetail && (
                <p className="rounded-md bg-slate-50 p-2 whitespace-pre-wrap">{selected.reasonDetail}</p>
              )}
              {selected.nextAssigneeName && (
                <p className="text-xs text-slate-500">Routed to: {selected.nextAssigneeName}</p>
              )}
              <section>
                <h3 className="text-xs font-semibold uppercase text-slate-500">Minute trail</h3>
                <ul className="mt-2 space-y-2">
                  <li>
                    Opened by <strong>{selected.initiatedByName}</strong> ·{" "}
                    {new Date(selected.initiatedAt).toLocaleString()}
                  </li>
                  {selected.clinicByName && (
                    <li>
                      Clinic: <strong>{selected.clinicByName}</strong>
                      {selected.clinicNote ? ` — ${selected.clinicNote}` : ""}
                    </li>
                  )}
                  {selected.directorByName && (
                    <li>
                      Director: <strong>{selected.directorByName}</strong>
                      {selected.directorNote ? ` — ${selected.directorNote}` : ""}
                    </li>
                  )}
                  {selected.coordinatorByName && (
                    <li>
                      Coordinator: <strong>{selected.coordinatorByName}</strong>
                      {selected.coordinatorNote ? ` — ${selected.coordinatorNote}` : ""}
                    </li>
                  )}
                  {selected.rejectedByName && (
                    <li className="text-red-700">
                      Returned by <strong>{selected.rejectedByName}</strong>
                    </li>
                  )}
                </ul>
              </section>
              {photosLoading && <p className="text-xs text-slate-400">Loading photos…</p>}
              {selected.photoUrls?.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {selected.photoUrls.map((u, i) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img key={i} src={u} alt="" className="h-20 w-20 rounded object-cover" />
                  ))}
                </div>
              )}
              {canActOnStage(selected.stage, roles, perms) && (
                <section className="border-t pt-4">
                  <textarea
                    rows={2}
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                    placeholder="Add minute…"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                  />
                  <div className="mt-3 flex gap-2">
                    <button
                      type="button"
                      disabled={loading}
                      onClick={() => void decide("approve")}
                      className="flex-1 rounded-md bg-nysc-green py-2.5 text-sm font-semibold text-white"
                    >
                      Recommend / Approve
                    </button>
                    <button
                      type="button"
                      disabled={loading}
                      onClick={() => void decide("reject")}
                      className="flex-1 rounded-md border border-red-300 bg-red-50 py-2.5 text-sm font-semibold text-red-700"
                    >
                      Return
                    </button>
                  </div>
                </section>
              )}
            </div>
          </aside>
        </div>
      )}
    </StaffShell>
  );
}
