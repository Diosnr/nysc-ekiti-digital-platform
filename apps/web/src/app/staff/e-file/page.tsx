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
  type ExitStage,
} from "@/lib/exit-workflow";

type Me = {
  user: { name: string | null; email: string };
  roles: string[];
  permissions: string[];
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
  clinicByName?: string | null;
  clinicAt?: string | null;
  clinicNote?: string | null;
  directorByName?: string | null;
  directorAt?: string | null;
  directorNote?: string | null;
  coordinatorByName?: string | null;
  coordinatorAt?: string | null;
  coordinatorNote?: string | null;
  rejectedByName?: string | null;
  rejectedAt?: string | null;
  rejectReason?: string | null;
  pcm: {
    id: string;
    callUpNumber: string;
    fullName: string;
    photographUrl?: string | null;
    status?: string;
    institution?: string | null;
    deploymentState?: string | null;
    dateReporting?: string | null;
    exitGround?: string | null;
    exitReason?: string | null;
    gender?: string | null;
    batchYear?: string | null;
    campAddress?: string | null;
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
  }, []);

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
      if (tab === "my_queue" && myStage) {
        url = `/api/exit-requests?stage=${myStage}`;
      }
      if (tab === "my_queue" && !myStage && canStart) {
        url = "/api/exit-requests?mine=1";
      }
      if (tab === "my_queue" && !myStage && !canStart) {
        url = "/api/exit-requests?bucket=pending";
      }
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
      setMsg(decision === "approve" ? "Approved — moved to next stage" : "Rejected");
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
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Could not open file");
        return;
      }
      setMsg("File opened and forwarded on the exit chain");
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
            className="inline-flex items-center gap-2 rounded-full bg-nysc-green px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700"
          >
            <span className="text-lg leading-none">+</span>
            Create file
          </button>
        )}
      </div>

      {/* Queue snapshot — Lola-style summary */}
      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        <button
          type="button"
          onClick={() => setTab("my_queue")}
          className={`rounded-2xl border bg-white p-4 text-left shadow-sm transition ${
            activeTab === "my_queue"
              ? "border-nysc-green ring-1 ring-nysc-green/30"
              : "border-slate-200 hover:border-slate-300"
          }`}
        >
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Pending for me
          </p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-slate-900">
            {activeTab === "my_queue" ? list.length : "—"}
          </p>
          <p className="mt-0.5 text-xs text-slate-500">Files awaiting your action</p>
        </button>
        <button
          type="button"
          onClick={() => setTab("approved")}
          className={`rounded-2xl border bg-white p-4 text-left shadow-sm transition ${
            activeTab === "approved"
              ? "border-nysc-green ring-1 ring-nysc-green/30"
              : "border-slate-200 hover:border-slate-300"
          }`}
        >
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Approved</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-emerald-800">
            {activeTab === "approved" ? list.length : "—"}
          </p>
          <p className="mt-0.5 text-xs text-slate-500">Terminal approvals on this list</p>
        </button>
        <button
          type="button"
          onClick={() => setTab("rejected")}
          className={`rounded-2xl border bg-white p-4 text-left shadow-sm transition ${
            activeTab === "rejected"
              ? "border-nysc-green ring-1 ring-nysc-green/30"
              : "border-slate-200 hover:border-slate-300"
          }`}
        >
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Returned / rejected
          </p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-rose-800">
            {activeTab === "rejected" ? list.length : "—"}
          </p>
          <p className="mt-0.5 text-xs text-slate-500">Needs rework or closed as rejected</p>
        </button>
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
              Type: <strong>Camp exit</strong> (other file types come next). Find the corps
              member, set ground and minute, then open the file on the chain.
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
                  placeholder="e.g. Camp exit on medical grounds"
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
                  {EXIT_GROUNDS.map((g) => (
                    <option key={g.value} value={g.value}>
                      {g.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold uppercase text-slate-500">Minute</label>
                <textarea
                  rows={4}
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  placeholder="Write the opening minute…"
                  value={reasonDetail}
                  onChange={(e) => setReasonDetail(e.target.value)}
                />
              </div>
              <div>
                <label className="text-xs font-semibold uppercase text-slate-500">
                  Attachments (photos)
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
                          Camp exit · {groundLabel(r.ground)}
                        </span>
                        {" · "}
                        {stageLabel(r.stage)}
                        {" · "}
                        {r.initiatedByName}
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
                className="text-sm text-slate-500 hover:text-slate-800"
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
                  <h2 className="text-lg font-bold text-slate-900">{selected.pcm.fullName}</h2>
                  <p className="font-mono text-sm text-slate-600">{selected.pcm.callUpNumber}</p>
                  <p className="mt-2 inline-flex rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-900">
                    Camp exit · {groundLabel(selected.ground)}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">{stageLabel(selected.stage)}</p>
                </div>
              </div>
            </div>

            <div className="space-y-4 p-5 text-sm">
              <section>
                <h3 className="text-xs font-semibold uppercase text-slate-500">Profile</h3>
                <p className="mt-1">{selected.pcm.institution || "—"}</p>
                <p>Deployment: {selected.pcm.deploymentState || "—"}</p>
                <p>Reporting: {selected.pcm.dateReporting || "—"}</p>
                {selected.reasonDetail && (
                  <p className="mt-2 rounded-md bg-slate-50 p-2 text-slate-700 whitespace-pre-wrap">
                    {selected.reasonDetail}
                  </p>
                )}
              </section>

              <section>
                <h3 className="text-xs font-semibold uppercase text-slate-500">Attachments</h3>
                {photosLoading && (
                  <p className="mt-1 text-xs text-slate-400">Loading…</p>
                )}
                {selected.photoUrls?.length > 0 ? (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {selected.photoUrls.map((u, i) => (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img key={i} src={u} alt="" className="h-20 w-20 rounded object-cover" />
                    ))}
                  </div>
                ) : (
                  !photosLoading && (
                    <p className="mt-1 text-xs text-slate-400">
                      {(selected.photoCount ?? 0) > 0 ? "Could not load" : "None"}
                    </p>
                  )
                )}
              </section>

              <section>
                <h3 className="text-xs font-semibold uppercase text-slate-500">Minute trail</h3>
                <ul className="mt-2 space-y-2 text-slate-700">
                  <li>
                    Opened by <strong>{selected.initiatedByName}</strong>
                    {" · "}
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
                      Camp Director: <strong>{selected.directorByName}</strong>
                      {selected.directorNote ? ` — ${selected.directorNote}` : ""}
                    </li>
                  )}
                  {selected.coordinatorByName && (
                    <li>
                      State Coordinator: <strong>{selected.coordinatorByName}</strong>
                      {selected.coordinatorNote ? ` — ${selected.coordinatorNote}` : ""}
                    </li>
                  )}
                  {selected.rejectedByName && (
                    <li className="text-red-700">
                      Returned by <strong>{selected.rejectedByName}</strong>
                      {selected.rejectReason ? ` — ${selected.rejectReason}` : ""}
                    </li>
                  )}
                </ul>
              </section>

              {canActOnStage(selected.stage, roles, perms) && (
                <section className="border-t border-slate-100 pt-4">
                  <label className="text-xs font-semibold uppercase text-slate-500">
                    Add minute
                  </label>
                  <textarea
                    rows={2}
                    className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                  />
                  <div className="mt-3 flex gap-2">
                    <button
                      type="button"
                      disabled={loading}
                      onClick={() => void decide("approve")}
                      className="flex-1 rounded-md bg-nysc-green py-2.5 text-sm font-semibold text-white disabled:opacity-40"
                    >
                      Recommend / Approve
                    </button>
                    <button
                      type="button"
                      disabled={loading}
                      onClick={() => void decide("reject")}
                      className="flex-1 rounded-md border border-red-300 bg-red-50 py-2.5 text-sm font-semibold text-red-700 disabled:opacity-40"
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
