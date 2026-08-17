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
  attachments?: string[];
  cc?: { id: string; name: string }[];
};

type PcmCard = {
  id: string;
  callUpNumber: string;
  fullName: string;
  photographUrl?: string | null;
  institution?: string | null;
  deploymentState?: string | null;
  dateReporting?: string | null;
  stateCode?: string | null;
  gender?: string | null;
  stream?: string | null;
  originState?: string | null;
  course?: string | null;
  ppaName?: string | null;
  status?: string;
};

type ExitReq = {
  kind: "exit";
  id: string;
  ground: string;
  reasonDetail: string | null;
  stage: ExitStage;
  photoUrls: string[];
  photoCount?: number;
  initiatedByName: string;
  initiatedAt: string;
  nextAssigneeName?: string | null;
  minutes?: Minute[];
  pcm: PcmCard;
};

type EFileRow = {
  kind: "efile";
  id: string;
  type: string;
  subject: string;
  priority?: string;
  status: string;
  openedByName?: string | null;
  currentHolderName?: string | null;
  currentHolderId?: string | null;
  createdAt: string;
  preview?: string | null;
  canAct?: boolean;
  minutes?: Minute[];
  pcm: PcmCard;
};

type Unified = ExitReq | EFileRow;

type Tab = "my_queue" | "pending" | "approved" | "rejected" | "create";

const TYPE_LABELS: Record<string, string> = {
  GENERAL: "General correspondence",
  SICK_LEAVE: "Sick Leave",
  CASUAL_LEAVE: "Casual Leave",
  MATERNITY_LEAVE: "Maternity leave",
  CONVOCATION_LEAVE: "Convocation leave",
  RELOCATION: "Relocation",
  REPOSTING: "Reposting",
  CAMP_EXIT: "Camp exit",
  QUERY: "Query",
  OTHERS: "Others",
  LEAVE: "Leave",
};

function typeLabel(t: string) {
  return TYPE_LABELS[t] || t;
}

function statusLabel(s: string) {
  const map: Record<string, string> = {
    DRAFT: "Draft",
    IN_TRANSIT: "In transit",
    PENDING: "Pending",
    APPROVED: "Approved",
    RETURNED: "Returned",
    REJECTED: "Rejected",
    CLOSED: "Closed",
  };
  return map[s] ?? s;
}

/** True if the value can be used as an <img src>. */
function isPhotoSrc(url?: string | null): boolean {
  if (!url?.trim()) return false;
  const u = url.trim();
  return (
    /^https?:\/\//i.test(u) ||
    u.startsWith("//") ||
    u.startsWith("data:image") ||
    u.startsWith("/")
  );
}

function normalizePhotoSrc(url: string): string {
  const u = url.trim();
  if (u.startsWith("//")) return `https:${u}`;
  return u;
}

export default function EFilingPage() {
  const [me, setMe] = useState<Me | null>(null);
  const [tab, setTab] = useState<Tab | null>(null);
  const [list, setList] = useState<Unified[]>([]);
  const [selected, setSelected] = useState<Unified | null>(null);
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
  const [actNextIds, setActNextIds] = useState<string[]>([]);

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
      // --- Camp exit rows ---
      let exitUrl = "/api/exit-requests?bucket=pending";
      if (tab === "approved") exitUrl = "/api/exit-requests?bucket=approved";
      if (tab === "rejected") exitUrl = "/api/exit-requests?bucket=rejected";
      if (tab === "pending") exitUrl = "/api/exit-requests?bucket=pending";
      if (tab === "my_queue" && myStage) {
        exitUrl = `/api/exit-requests?stage=${myStage}`;
      } else if (tab === "my_queue" && canStart && !isSuper) {
        exitUrl = "/api/exit-requests?mine=1";
      } else if (tab === "my_queue") {
        exitUrl = "/api/exit-requests?bucket=pending";
      }

      // --- Electronic files (non-exit) ---
      let efileUrl = "/api/e-file/files?bucket=pending";
      if (tab === "approved") efileUrl = "/api/e-file/files?bucket=approved";
      if (tab === "rejected") efileUrl = "/api/e-file/files?bucket=rejected";
      if (tab === "pending") efileUrl = "/api/e-file/files?bucket=pending";
      if (tab === "my_queue") {
        // Inbox: files currently with me; Super Admin sees all pending
        efileUrl = isSuper
          ? "/api/e-file/files?bucket=pending"
          : "/api/e-file/files?bucket=pending&holder=1";
      }

      const [exitRes, efileRes] = await Promise.all([
        staffFetch(exitUrl),
        staffFetch(efileUrl),
      ]);

      const exitData = await exitRes.json().catch(() => ({}));
      const efileData = await efileRes.json().catch(() => ({}));

      if (!exitRes.ok && !efileRes.ok) {
        setError(exitData.error || efileData.error || "Failed to load");
        return;
      }

      const exits: ExitReq[] = ((exitData.requests ?? []) as Omit<ExitReq, "kind">[]).map(
        (r) => ({ ...r, kind: "exit" as const, photoUrls: r.photoUrls ?? [] })
      );

      const efiles: EFileRow[] = ((efileData.files ?? []) as Array<{
        id: string;
        type: string;
        subject: string;
        priority?: string;
        status: string;
        openedByName?: string | null;
        currentHolderName?: string | null;
        currentHolderId?: string | null;
        createdAt: string;
        preview?: string | null;
        pcm: PcmCard;
      }>)
        .filter((f) => f.type !== "CAMP_EXIT")
        .map((f) => ({ ...f, kind: "efile" as const }));

      const merged: Unified[] = [...exits, ...efiles].sort((a, b) => {
        const ta =
          a.kind === "exit"
            ? new Date(a.initiatedAt).getTime()
            : new Date(a.createdAt).getTime();
        const tb =
          b.kind === "exit"
            ? new Date(b.initiatedAt).getTime()
            : new Date(b.createdAt).getTime();
        return tb - ta;
      });

      setList(merged);
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }, [tab, myStage, canStart, isSuper]);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  function openDetail(row: Unified) {
    setError(null);
    setNote("");
    setActNextTo("");
    setActNextIds([]);
    setSelected(row);
    setPhotosLoading(true);

    if (row.kind === "exit") {
      staffFetch(`/api/exit-requests/${row.id}?photos=1`)
        .then(async (res) => {
          if (!res.ok) return;
          const data = await res.json();
          const full = data.request as ExitReq;
          setSelected((prev) =>
            prev && prev.kind === "exit" && prev.id === row.id
              ? {
                  ...prev,
                  ...full,
                  kind: "exit",
                  pcm: { ...prev.pcm, ...full.pcm },
                }
              : prev
          );
          if (
            full.stage &&
            !["APPROVED", "REJECTED", "CANCELLED"].includes(full.stage)
          ) {
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
    } else {
      staffFetch(`/api/e-file/files/${row.id}`)
        .then(async (res) => {
          if (!res.ok) return;
          const data = await res.json();
          const full = data.file as EFileRow;
          setSelected((prev) =>
            prev && prev.kind === "efile" && prev.id === row.id
              ? { ...prev, ...full, kind: "efile" }
              : prev
          );
          if (
            full.canAct &&
            ["DRAFT", "IN_TRANSIT", "PENDING"].includes(full.status)
          ) {
            staffFetch("/api/e-file/officers")
              .then(async (r) => {
                if (!r.ok) return;
                const d = await r.json();
                setActOfficers((d.officers ?? []) as Officer[]);
              })
              .catch(() => setActOfficers([]));
          }
        })
        .catch(() => {})
        .finally(() => setPhotosLoading(false));
    }
  }

  async function decideExit(decision: "approve" | "reject") {
    if (!selected || selected.kind !== "exit") return;
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
      setMsg(
        decision === "approve"
          ? "Minute recorded — file advanced"
          : "File returned"
      );
      setSelected(null);
      await loadList();
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  async function decideEfile(
    decision: "forward" | "return" | "approve" | "reject"
  ) {
    if (!selected || selected.kind !== "efile") return;
    if (decision === "forward" && !actNextIds.length && !actNextTo) {
      setError("Select at least one officer to forward to");
      return;
    }
    setLoading(true);
    setError(null);
    setMsg(null);
    try {
      const ids =
        actNextIds.length > 0
          ? actNextIds
          : actNextTo
            ? [actNextTo]
            : [];
      const res = await staffFetch(`/api/e-file/files/${selected.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          decision,
          note: note || undefined,
          nextToUserIds: ids.length ? ids : undefined,
          nextToUserId: ids[0] || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Action failed");
        return;
      }
      const labels: Record<string, string> = {
        forward: "File forwarded",
        return: "File returned",
        approve: "File approved and closed",
        reject: "File rejected",
      };
      setMsg(labels[decision] || "Done");
      setSelected(null);
      await loadList();
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  function toggleNextOfficer(id: string) {
    setActNextIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
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
            Digital minutes — leave, relocation, query, general correspondence and camp
            exit. Files stay with the current holder until forwarded or closed.
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
            [
              "my_queue",
              myStage
                ? "Pending for me"
                : canStart && !isSuper
                  ? "My open filings"
                  : "Pending for me",
            ],
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
                <li key={`${r.kind}-${r.id}`}>
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
                      <p className="font-mono text-xs text-slate-500">
                        {r.pcm.callUpNumber}
                        {r.pcm.stateCode ? ` · ${r.pcm.stateCode}` : ""}
                      </p>
                      <p className="mt-0.5 text-xs text-slate-600">
                        {r.kind === "exit" ? (
                          <>
                            <span className="font-medium text-nysc-green">
                              Camp exit · {groundLabel(r.ground, grounds)}
                            </span>
                            {" · "}
                            {stageLabel(r.stage)}
                            {" · "}
                            {r.initiatedByName}
                          </>
                        ) : (
                          <>
                            <span className="font-medium text-sky-800">
                              {typeLabel(r.type)}
                            </span>
                            {r.subject ? ` · ${r.subject}` : ""}
                            {" · "}
                            {statusLabel(r.status)}
                            {r.currentHolderName
                              ? ` · with ${r.currentHolderName}`
                              : ""}
                          </>
                        )}
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
                <div className="min-w-0">
                  <h2 className="text-lg font-bold">{selected.pcm.fullName}</h2>
                  <p className="font-mono text-sm text-slate-600">
                    {selected.pcm.callUpNumber}
                  </p>
                  {selected.pcm.stateCode && (
                    <p className="font-mono text-xs text-slate-500">
                      {selected.pcm.stateCode}
                    </p>
                  )}
                  <p className="mt-2 text-xs font-semibold text-amber-900">
                    {selected.kind === "exit"
                      ? `${groundLabel(selected.ground, grounds)} · ${stageLabel(selected.stage)}`
                      : `${typeLabel(selected.type)} · ${statusLabel(selected.status)}`}
                  </p>
                  {selected.kind === "efile" && selected.subject && (
                    <p className="mt-1 text-sm text-slate-700">{selected.subject}</p>
                  )}
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
                    : selected.kind === "exit"
                      ? [
                          {
                            id: "legacy",
                            fromName: selected.initiatedByName,
                            toName: selected.nextAssigneeName,
                            body: selected.reasonDetail || "File opened",
                            action: "FORWARD",
                            createdAt: selected.initiatedAt,
                          } as Minute,
                        ]
                      : []
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
                      {m.attachments && m.attachments.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {m.attachments.filter(isPhotoSrc).map((u, i) => (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              key={i}
                              src={normalizePhotoSrc(u)}
                              alt={`Attachment ${i + 1}`}
                              className="h-20 w-20 rounded border border-slate-200 object-cover"
                              referrerPolicy="no-referrer"
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </section>

              {selected.kind === "exit" && selected.photoUrls?.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {selected.photoUrls.filter(isPhotoSrc).map((u, i) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      key={i}
                      src={normalizePhotoSrc(u)}
                      alt=""
                      className="h-20 w-20 rounded border border-slate-200 object-cover"
                      referrerPolicy="no-referrer"
                    />
                  ))}
                </div>
              )}

              {/* Exit actions */}
              {selected.kind === "exit" &&
                canActOnStage(selected.stage, roles, perms) && (
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
                        onClick={() => void decideExit("approve")}
                        className="flex-1 rounded-md bg-nysc-green py-2.5 text-sm font-semibold text-white"
                      >
                        Recommend / Approve
                      </button>
                      <button
                        type="button"
                        disabled={loading}
                        onClick={() => void decideExit("reject")}
                        className="flex-1 rounded-md border border-red-300 bg-red-50 py-2.5 text-sm font-semibold text-red-700"
                      >
                        Return
                      </button>
                    </div>
                  </section>
                )}

              {/* Non-exit e-file actions */}
              {selected.kind === "efile" &&
                selected.canAct &&
                ["DRAFT", "IN_TRANSIT", "PENDING"].includes(selected.status) && (
                  <section className="space-y-3 border-t pt-4">
                    <textarea
                      rows={3}
                      className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                      placeholder="Write your minute…"
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                    />
                    <div>
                      <label className="text-xs font-semibold uppercase text-slate-500">
                        Forward to (one or more)
                      </label>
                      <div className="mt-1 max-h-40 space-y-1 overflow-y-auto rounded-md border border-slate-200 p-2">
                        {actOfficers.map((o) => {
                          const checked = actNextIds.includes(o.id);
                          return (
                            <label
                              key={o.id}
                              className={`flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-slate-50 ${
                                checked ? "bg-emerald-50" : ""
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => toggleNextOfficer(o.id)}
                                className="h-4 w-4 rounded border-slate-300 text-nysc-green"
                              />
                              <span className="truncate">
                                {o.name}
                                {o.roles[0] ? (
                                  <span className="text-slate-500"> · {o.roles[0]}</span>
                                ) : null}
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        disabled={loading}
                        onClick={() => void decideEfile("forward")}
                        className="rounded-md bg-nysc-green py-2.5 text-sm font-semibold text-white disabled:opacity-50"
                      >
                        Forward
                      </button>
                      <button
                        type="button"
                        disabled={loading}
                        onClick={() => void decideEfile("approve")}
                        className="rounded-md border border-emerald-300 bg-emerald-50 py-2.5 text-sm font-semibold text-emerald-800"
                      >
                        Approve / Close
                      </button>
                      <button
                        type="button"
                        disabled={loading}
                        onClick={() => void decideEfile("return")}
                        className="rounded-md border border-amber-300 bg-amber-50 py-2.5 text-sm font-semibold text-amber-900"
                      >
                        Return
                      </button>
                      <button
                        type="button"
                        disabled={loading}
                        onClick={() => void decideEfile("reject")}
                        className="rounded-md border border-red-300 bg-red-50 py-2.5 text-sm font-semibold text-red-700"
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
