"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { StaffShell } from "@/components/staff/StaffShell";
import { PcmPhoto } from "@/components/staff/PcmPhoto";
import { TableSkeleton } from "@/components/Skeleton";
import { staffFetch } from "@/lib/staff-api";

type Pcm = {
  id: string;
  callUpNumber: string;
  fullName: string;
  gender: string | null;
  institution: string | null;
  course?: string | null;
  status: string;
  deploymentState?: string | null;
  photographUrl?: string | null;
  campAddress?: string | null;
  dateReporting?: string | null;
  batchYear?: string | null;
  stream?: string | null;
  originState?: string | null;
  stateCode?: string | null;
  platoonCode?: string | null;
  ppaName?: string | null;
  familyStatuses?: Array<{
    id: string;
    statusesJson: string;
    husbandName: string | null;
    address: string;
    state: string | null;
    lga: string | null;
    community: string | null;
    phone: string | null;
    createdAt: string;
  }>;
  skillProfiles?: Array<{
    id: string;
    skill1: string | null;
    skill2: string | null;
    skill3: string | null;
    createdAt: string;
  }>;
  ninRecords?: Array<{
    id: string;
    nin: string | null;
    frontUrl: string | null;
    backUrl: string | null;
    createdAt: string;
  }>;
};

function PcmRegistryInner() {
  const searchParams = useSearchParams();
  const kindParam = (searchParams.get("kind") || "").toLowerCase();
  const kind =
    kindParam === "cm" || kindParam === "all"
      ? kindParam
      : "pcm";

  const [pcms, setPcms] = useState<Pcm[]>([]);
  const [q, setQ] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<Pcm | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [isSuper, setIsSuper] = useState(false);
  const [canIntake, setCanIntake] = useState(false);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const title =
    kind === "cm"
      ? "CM Registry"
      : kind === "all"
        ? "PCM / CM Registry"
        : "PCM Registry";
  const subtitle =
    kind === "cm"
      ? "Corps members with a state code · scroll to load more · click a name for details."
      : kind === "all"
        ? "All records · CM = has state code · PCM = without state code."
        : "Prospective corps members without a state code · scroll to load more.";

  const load = useCallback(
    async (search?: string, cursor?: string | null, append = false) => {
      setError(null);
      if (append) setLoadingMore(true);
      else setLoading(true);
      const params = new URLSearchParams();
      if (search) params.set("q", search);
      if (cursor) params.set("cursor", cursor);
      if (kind === "cm" || kind === "pcm") params.set("kind", kind);
      params.set("limit", "30");
      try {
        const res = await staffFetch(`/api/pcm?${params.toString()}`);
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setError(data.error ?? `Failed to load (${res.status})`);
          return;
        }
        const list = (data.pcms ?? []) as Pcm[];
        setPcms((prev) => (append ? [...prev, ...list] : list));
        setNextCursor(data.nextCursor ?? null);
        setHasMore(Boolean(data.hasMore));
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [kind]
  );

  useEffect(() => {
    void load();
    staffFetch("/api/auth/me").then(async (res) => {
      if (!res.ok) return;
      const me = await res.json();
      const roles: string[] = me.roles ?? [];
      const perms: string[] = me.permissions ?? [];
      const superA =
        roles.some((r) => r.toLowerCase() === "super admin") ||
        perms.includes("*");
      setIsSuper(superA);
      setCanIntake(
        superA ||
          perms.includes("pcm:create") ||
          perms.includes("pcm:verify") ||
          roles.includes("Security Officer") ||
          roles.includes("Registration Officer")
      );
    });
  }, [load]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasMore) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && hasMore && !loadingMore && !loading) {
          void load(q || undefined, nextCursor, true);
        }
      },
      { rootMargin: "200px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [hasMore, loadingMore, loading, nextCursor, q, load]);

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      return;
    }
    setDetailLoading(true);
    staffFetch(`/api/pcm/${selectedId}`)
      .then(async (res) => {
        if (!res.ok) return;
        const data = await res.json();
        setDetail(data.pcm);
      })
      .finally(() => setDetailLoading(false));
  }, [selectedId]);

  async function onDelete(id: string, name: string) {
    if (!confirm(`Delete ${name} permanently?`)) return;
    const res = await staffFetch(`/api/pcm/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Delete failed");
      return;
    }
    setSelectedId(null);
    void load(q || undefined);
  }

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
          <p className="mt-1 text-sm text-slate-600">{subtitle}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/staff/pcm?kind=all"
            className={`rounded-md px-3 py-2 text-sm font-medium ${
              kind === "all"
                ? "bg-nysc-green text-white"
                : "border border-slate-300 bg-white text-slate-700"
            }`}
          >
            All
          </Link>
          <Link
            href="/staff/pcm?kind=pcm"
            className={`rounded-md px-3 py-2 text-sm font-medium ${
              kind === "pcm"
                ? "bg-nysc-green text-white"
                : "border border-slate-300 bg-white text-slate-700"
            }`}
          >
            PCM only
          </Link>
          <Link
            href="/staff/pcm?kind=cm"
            className={`rounded-md px-3 py-2 text-sm font-medium ${
              kind === "cm"
                ? "bg-nysc-green text-white"
                : "border border-slate-300 bg-white text-slate-700"
            }`}
          >
            CM only
          </Link>
          {canIntake && (
            <Link
              href="/staff/pcm/intake"
              className="rounded-md bg-nysc-green px-3 py-2 text-sm font-semibold text-white"
            >
              New intake
            </Link>
          )}
        </div>
      </div>

      {error && (
        <p className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <div className="mt-6 flex gap-2">
        <input
          className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm"
          placeholder="Search name, call-up, state code…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && void load(q || undefined)}
        />
        <button
          type="button"
          onClick={() => void load(q || undefined)}
          className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium"
        >
          Search
        </button>
      </div>

      <div className="mt-6">
        {loading && !pcms.length ? (
          <TableSkeleton rows={8} />
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">Photo</th>
                  <th className="px-4 py-3">Call-up</th>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">State code</th>
                  <th className="px-4 py-3">Deployment</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {pcms.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                      No records.
                      {canIntake ? " Use New intake to register." : ""}
                    </td>
                  </tr>
                )}
                {pcms.map((p) => (
                  <tr
                    key={p.id}
                    className="cursor-pointer border-b border-slate-100 hover:bg-green-50/50"
                    onClick={() => setSelectedId(p.id)}
                  >
                    <td className="px-4 py-2">
                      <PcmPhoto
                        url={p.photographUrl}
                        alt=""
                        sizeClass="h-10 w-10"
                        className="rounded-md"
                      />
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">{p.callUpNumber}</td>
                    <td className="px-4 py-3 font-medium text-nysc-green">{p.fullName}</td>
                    <td className="px-4 py-3 font-mono text-xs">
                      {p.stateCode ? (
                        <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-emerald-800">
                          {p.stateCode}
                        </span>
                      ) : (
                        <span className="text-slate-400">PCM</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {p.deploymentState ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-xs">{p.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div ref={sentinelRef} className="py-4 text-center text-sm text-slate-500">
          {loadingMore && (
            <span className="inline-flex items-center gap-2">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-nysc-green border-t-transparent" />
              Loading more…
            </span>
          )}
          {!loadingMore && hasMore && (
            <button
              type="button"
              className="text-nysc-green font-medium hover:underline"
              onClick={() => void load(q || undefined, nextCursor, true)}
            >
              Load more
            </button>
          )}
          {!loading && !hasMore && pcms.length > 0 && (
            <span>End of list · {pcms.length} shown</span>
          )}
        </div>
      </div>

      {selectedId && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <button
            type="button"
            className="absolute inset-0 bg-black/40"
            onClick={() => setSelectedId(null)}
            aria-label="Close"
          />
          <div className="relative flex h-full w-full max-w-md flex-col bg-white shadow-2xl sm:max-w-lg">
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
              <h2 className="text-lg font-bold text-slate-900">
                {detail?.stateCode ? "CM details" : "PCM details"}
              </h2>
              <button
                type="button"
                onClick={() => setSelectedId(null)}
                className="rounded-md border border-slate-300 px-2 py-1 text-sm"
              >
                Close
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              {detailLoading && (
                <div className="space-y-3">
                  <div className="h-32 w-32 animate-pulse rounded-xl bg-slate-200" />
                  <div className="h-5 w-2/3 animate-pulse rounded bg-slate-200" />
                </div>
              )}
              {!detailLoading && detail && (
                <div className="space-y-6">
                  <div className="flex gap-4">
                    <PcmPhoto url={detail.photographUrl} alt={detail.fullName} />
                    <div>
                      <p className="text-lg font-bold text-slate-900">{detail.fullName}</p>
                      <p className="font-mono text-xs text-slate-600">
                        {detail.callUpNumber}
                      </p>
                      <p className="mt-2 inline-flex rounded-full bg-green-50 px-2 py-0.5 text-xs font-semibold text-green-800">
                        {detail.status}
                      </p>
                      {detail.stateCode ? (
                        <p className="mt-1 text-xs font-medium text-emerald-700">
                          CM · {detail.stateCode}
                        </p>
                      ) : (
                        <p className="mt-1 text-xs text-slate-500">PCM · no state code</p>
                      )}
                    </div>
                  </div>

                  <section>
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                      Intake
                    </h3>
                    <dl className="mt-2 grid gap-2 text-sm">
                      {(
                        [
                          ["Gender", detail.gender],
                          ["Institution", detail.institution],
                          ["Course", detail.course],
                          ["Stream", detail.stream],
                          ["Origin", detail.originState],
                          ["Deployment", detail.deploymentState],
                          ["State code", detail.stateCode],
                          ["PPA", detail.ppaName],
                          ["Platoon", detail.platoonCode ? `Platoon ${detail.platoonCode}` : null],
                          ["Camp", detail.campAddress],
                          ["Reporting", detail.dateReporting],
                          ["Batch", detail.batchYear],
                        ] as [string, string | null | undefined][]
                      ).map(([k, v]) => (
                        <div
                          key={k}
                          className="flex justify-between gap-2 border-b border-slate-50 py-1"
                        >
                          <dt className="text-slate-500">{k}</dt>
                          <dd className="text-right font-medium text-slate-900">
                            {v || "—"}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  </section>

                  {isSuper && (
                    <button
                      type="button"
                      onClick={() => void onDelete(detail.id, detail.fullName)}
                      className="w-full rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700"
                    >
                      Delete record
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default function PcmRegistryPage() {
  return (
    <StaffShell>
      <Suspense
        fallback={
          <div className="space-y-4">
            <div className="h-8 w-48 animate-pulse rounded bg-slate-200" />
            <TableSkeleton rows={6} />
          </div>
        }
      >
        <PcmRegistryInner />
      </Suspense>
    </StaffShell>
  );
}
