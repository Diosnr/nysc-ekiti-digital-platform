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

type Tab = "my_queue" | "pending" | "approved" | "rejected" | "initiate";

export default function GrantExitPage() {
  const [me, setMe] = useState<Me | null>(null);
  const [tab, setTab] = useState<Tab>("my_queue");
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

  useEffect(() => {
    staffFetch("/api/auth/me").then(async (res) => {
      if (!res.ok) return;
      setMe(await res.json());
    });
  }, []);

  const roles = me?.roles ?? [];
  const perms = me?.permissions ?? [];
  const myStage = stageForRoles(roles);
  const canStart = me ? canInitiateExit(roles, perms) : false;

  const loadList = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let url = "/api/exit-requests?bucket=pending";
      if (tab === "approved") url = "/api/exit-requests?bucket=approved";
      if (tab === "rejected") url = "/api/exit-requests?bucket=rejected";
      if (tab === "my_queue" && myStage) {
        url = `/api/exit-requests?stage=${myStage}`;
      }
      if (tab === "my_queue" && !myStage) {
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
  }, [tab, myStage]);

  useEffect(() => {
    if (tab === "initiate") return;
    void loadList();
  }, [tab, loadList]);

  /** Instant open from list row — no blocking wait */
  function openDetail(row: ExitReq) {
    setError(null);
    setNote("");
    setSelected({ ...row, photoUrls: row.photoUrls ?? [] });
    // Lazy-load evidence only if any
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
          reasonDetail: reasonDetail || undefined,
          photoUrls,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Could not start request");
        return;
      }
      setMsg("Exit request submitted");
      setPcmHit(null);
      setQ("");
      setReasonDetail("");
      setPhotoUrls([]);
      setTab("pending");
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
    { id: "my_queue", label: "My queue" },
    { id: "pending", label: "All pending" },
    { id: "approved", label: "Approved" },
    { id: "rejected", label: "Rejected" },
  ];
  if (canStart) tabs.push({ id: "initiate", label: "Initiate" });

  return (
    <StaffShell>
      <h1 className="text-2xl font-bold text-slate-900">Camp exit</h1>
      <p className="mt-1 text-sm text-slate-600">
        Platoon initiates → Clinic (medical only) → Camp Director → State Coordinator.
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
              tab === t.id
                ? "bg-nysc-green text-white"
                : "bg-white text-slate-700 ring-1 ring-slate-200"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "initiate" && canStart && (
        <div className="mt-6 max-w-xl space-y-4 rounded-2xl border border-slate-200 bg-white p-6">
          <h2 className="font-semibold text-slate-900">Initiate exit request</h2>
          <form onSubmit={searchPcm} className="flex gap-2">
            <input
              className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm"
              placeholder="Call-up or name"
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
                <label className="text-xs font-semibold uppercase text-slate-500">Ground *</label>
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
                <label className="text-xs font-semibold uppercase text-slate-500">Detail</label>
                <textarea
                  rows={3}
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  value={reasonDetail}
                  onChange={(e) => setReasonDetail(e.target.value)}
                />
              </div>
              <div>
                <label className="text-xs font-semibold uppercase text-slate-500">Evidence photos</label>
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
                className="rounded-md bg-nysc-green px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                Submit request
              </button>
            </form>
          )}
        </div>
      )}

      {tab !== "initiate" && (
        <div className="mt-6">
          {loading && !list.length ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-16 animate-pulse rounded-xl bg-slate-200" />
              ))}
            </div>
          ) : list.length === 0 ? (
            <p className="text-sm text-slate-500">No requests in this list.</p>
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
                        <span className="font-medium text-nysc-green">{groundLabel(r.ground)}</span>
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
          <aside className="relative z-10 flex h-full w-full max-w-lg animate-in slide-in-from-right flex-col overflow-y-auto bg-white shadow-xl duration-200">
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
                    {groundLabel(selected.ground)}
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
                  <p className="mt-2 rounded-md bg-slate-50 p-2 text-slate-700">{selected.reasonDetail}</p>
                )}
              </section>

              <section>
                <h3 className="text-xs font-semibold uppercase text-slate-500">Evidence</h3>
                {photosLoading && (
                  <p className="mt-1 text-xs text-slate-400">Loading photos…</p>
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
                      {(selected.photoCount ?? 0) > 0 ? "Could not load photos" : "None attached"}
                    </p>
                  )
                )}
              </section>

              <section>
                <h3 className="text-xs font-semibold uppercase text-slate-500">Approval trail</h3>
                <ul className="mt-2 space-y-2 text-slate-700">
                  <li>
                    Initiated by <strong>{selected.initiatedByName}</strong>
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
                      Rejected by <strong>{selected.rejectedByName}</strong>
                      {selected.rejectReason ? ` — ${selected.rejectReason}` : ""}
                    </li>
                  )}
                </ul>
              </section>

              {canActOnStage(selected.stage, roles, perms) && (
                <section className="border-t border-slate-100 pt-4">
                  <label className="text-xs font-semibold uppercase text-slate-500">Note</label>
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
                      Approve
                    </button>
                    <button
                      type="button"
                      disabled={loading}
                      onClick={() => void decide("reject")}
                      className="flex-1 rounded-md border border-red-300 bg-red-50 py-2.5 text-sm font-semibold text-red-700 disabled:opacity-40"
                    >
                      Reject
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
