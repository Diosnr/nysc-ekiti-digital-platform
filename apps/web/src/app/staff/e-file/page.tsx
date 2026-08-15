"use client";

import { useCallback, useEffect, useState } from "react";
import { StaffShell } from "@/components/staff/StaffShell";
import { PcmPhoto } from "@/components/staff/PcmPhoto";
import { CreateFilePanel } from "@/components/staff/CreateFilePanel";
import { staffFetch } from "@/lib/staff-api";
import {
  EXIT_GROUNDS,
  groundLabel,
  stageLabel,
  stageForRoles,
  canInitiateExit,
  canAccessExitDesk,
  canActOnStage,
  nextStageAfterApprove,
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

type Minute = {
  id: string;
  fromName: string;
  toName?: string | null;
  body: string;
  action: string;
  createdAt: string;
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
  minutes?: Minute[];
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
  const [grounds, setGrounds] = useState<GroundOpt[]>(
    EXIT_GROUNDS.map((g) => ({
      code: g.value,
      label: g.label,
      requiresClinic: g.value === "MEDICAL",
    }))
  );
  const [actOfficers, setActOfficers] = useState<Officer[]>([]);
  const [actNextTo, setActNextTo] = useState("");

  useEffect(() => {
    staffFetch("/api/auth/me").then(async (res) => {
      if (!res.ok) return;
      const data = (await res.json()) as Me;
      setMe(data);
      setTab("my_queue");
    });
    staffFetch("/api/exit-grounds")
      .then(async (res) => {
        if (!res.ok) return;
        const data = await res.json();
        const items = ((data.items ?? []) as GroundOpt[]).filter(
          (g) => g.isActive !== false
        );
        if (items.length) setGrounds(items);
      })
      .catch(() => {});
  }, []);

  const roles = me?.roles ?? [];
  const perms = me?.permissions ?? [];
  const myStage = stageForRoles(roles);
  const canStart = me ? canInitiateExit(roles, perms) : false;
  const canCreateFile = me ? canAccessExitDesk(roles, perms) : false;
  const isSuper =
    perms.includes("*") ||
    roles.some((r) => r.toLowerCase() === "super admin");
  const activeTab = tab ?? "my_queue";

  const loadList = useCallback(async () => {
    if (!tab || tab === "create") return;
    setLoading(true);
    setError(null);
    try {
      let url = "/api/exit-requests?bucket=pending";
      if (tab === "approved") url = "/api/exit-requests?bucket=approved";
      if (tab === "rejected") url = "/api/exit-requests?bucket=rejected";
      if (tab === "pending") url = "/api/exit-requests?bucket=pending";
      // Role-specific queue (clinic / director / coordinator)
      if (tab === "my_queue" && myStage) {
        url = `/api/exit-requests?stage=${myStage}`;
      }
      // Platoon initiators: open filings they started (still pending only)
      else if (tab === "my_queue" && canStart && !isSuper) {
        url = "/api/exit-requests?mine=1";
      }
      // Super Admin / others without a stage: all still-open files
      else if (tab === "my_queue") {
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
  }, [tab, myStage, canStart, isSuper]);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  function openDetail(row: ExitReq) {
    setError(null);
    setNote("");
    setActNextTo("");
    setSelected({ ...row, photoUrls: row.photoUrls ?? [], minutes: row.minutes ?? [] });
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
        if (full.stage && !["APPROVED", "REJECTED", "CANCELLED"].includes(full.stage)) {
          const nxt = nextStageAfterApprove(full.stage as ExitStage, full.ground);
          if (nxt !== "APPROVED") {
            staffFetch(`/api/e-file/officers?stage=${nxt}`)
              .then(async (r) => {
                if (!r.ok) return;
                const d = await r.json();
                const list = (d.officers ?? []) as Officer[];
                setActOfficers(list);
                setActNextTo(list.find((o) => o.suggested)?.id || "");
              })
              .catch(() => setActOfficers([]));
          }
        }
      })
      .catch(() => {})
      .finally(() => setPhotosLoading(false));
  }

  async function decide(decision: "approve" | "reject") {
    if (!selected) return;
    setLoading(true);
    setError(null);
    setMsg(null);
    try {
      const res = await staffFetch(`/api/exit-requests/${selected.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          decision,
          note: note || undefined,
          nextToUserId:
            decision === "approve" && actNextTo ? actNextTo : undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Action failed");
        return;
      }
      setMsg(decision === "approve" ? "Minute recorded — file advanced" : "File returned");
      setSelected(null);
      await loadList();
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  const tabs: { id: Tab; label: string }[] = [
    {
      id: "my_queue",
      label: myStage
        ? "Pending for me"
        : canStart && !isSuper
          ? "My open filings"
          : "Pending for me",
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
            Digital minutes on corps member files. Choose the file type when creating — general,
            leave, relocation, or camp exit.
          </p>
        </div>
        {canCreateFile && (
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
            ["my_queue", myStage ? "Pending for me" : canStart && !isSuper ? "My open filings" : "Pending for me"],
            ["approved", "Approved"],
            ["rejected", "Returned / rejected"],
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
        {canCreateFile && (
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

      {activeTab === "create" && canCreateFile && (
        <CreateFilePanel
          canInitiateCampExit={canStart}
          grounds={grounds}
          onDone={(m) => {
            setMsg(m);
            setError(null);
            setTab("my_queue");
          }}
          onError={(m) => setError(m)}
        />
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
              <section>
                <h3 className="text-xs font-semibold uppercase text-slate-500">
                  Digital minute sheet
                </h3>
                {photosLoading && !selected.minutes?.length && (
                  <p className="mt-2 text-xs text-slate-400">Loading minutes…</p>
                )}
                <div className="mt-3 space-y-4">
                  {(selected.minutes?.length
                    ? selected.minutes
                    : [
                        {
                          id: "legacy",
                          fromName: selected.initiatedByName,
                          toName: selected.nextAssigneeName,
                          body: selected.reasonDetail || "File opened",
                          action: "FORWARD",
                          createdAt: selected.initiatedAt,
                        } as Minute,
                      ]
                  ).map((m) => (
                    <div
                      key={m.id}
                      className="rounded-xl border border-slate-100 bg-slate-50/80 p-3"
                    >
                      <p className="text-[11px] font-medium text-slate-400">
                        {new Date(m.createdAt).toLocaleString()} · {m.action}
                      </p>
                      <p className="mt-1 text-xs text-slate-600">
                        <strong>FROM:</strong> {m.fromName}
                        {m.toName ? (
                          <>
                            <br />
                            <strong>TO:</strong> {m.toName}
                          </>
                        ) : null}
                      </p>
                      <p className="mt-2 whitespace-pre-wrap text-slate-800">{m.body}</p>
                    </div>
                  ))}
                </div>
              </section>
              {selected.photoUrls?.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {selected.photoUrls.map((u, i) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img key={i} src={u} alt="" className="h-20 w-20 rounded object-cover" />
                  ))}
                </div>
              )}
              {canActOnStage(selected.stage, roles, perms) && (
                <section className="space-y-3 border-t pt-4">
                  <textarea
                    rows={3}
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                    placeholder="Write your minute…"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                  />
                  {selected.stage !== "AWAITING_STATE_COORDINATOR" && (
                    <select
                      className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                      value={actNextTo}
                      onChange={(e) => setActNextTo(e.target.value)}
                    >
                      <option value="">Default next stage</option>
                      {actOfficers.map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.suggested ? "★ " : ""}
                          {o.name}
                          {o.roles[0] ? ` · ${o.roles[0]}` : ""}
                        </option>
                      ))}
                    </select>
                  )}
                  <div className="flex gap-2">
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
