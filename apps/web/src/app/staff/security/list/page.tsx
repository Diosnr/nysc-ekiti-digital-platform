"use client";

import { useCallback, useEffect, useState, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { StaffShell } from "@/components/staff/StaffShell";
import { PcmPhoto } from "@/components/staff/PcmPhoto";
import { getAccessToken, staffFetch } from "@/lib/staff-api";

type ListType = "checked-in" | "checked-out" | "pending-exit";

type PcmRow = {
  id: string;
  callUpNumber: string;
  fullName: string;
  gender?: string | null;
  institution?: string | null;
  status?: string;
  deploymentState?: string | null;
  stateCode?: string | null;
  photographUrl?: string | null;
  dateReporting?: string | null;
  campExitGrantedAt?: string | null;
  exitReason?: string | null;
  exitDestinationState?: string | null;
  checkedOutAt?: string | null;
};

const TITLES: Record<ListType, string> = {
  "checked-in": "Currently checked in",
  "checked-out": "Currently checked out",
  "pending-exit": "Exit approved — not yet checked out",
};

function isValidType(t: string | null): t is ListType {
  return t === "checked-in" || t === "checked-out" || t === "pending-exit";
}

function SecurityListInner() {
  const searchParams = useSearchParams();
  const rawType = searchParams.get("type");
  const type: ListType = isValidType(rawType) ? rawType : "checked-in";

  const [pcms, setPcms] = useState<PcmRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const load = useCallback(
    async (cursor?: string | null, append = false) => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({
          type,
          limit: "50",
        });
        if (q.trim()) params.set("q", q.trim());
        if (cursor) params.set("cursor", cursor);
        const res = await staffFetch(`/api/security/list?${params}`);
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setError(data.error ?? "Failed to load list");
          return;
        }
        const list = (data.pcms ?? []) as PcmRow[];
        setPcms((prev) => (append ? [...prev, ...list] : list));
        setNextCursor(data.nextCursor ?? null);
        setHasMore(Boolean(data.hasMore));
      } catch {
        setError("Network error");
      } finally {
        setLoading(false);
      }
    },
    [type, q]
  );

  useEffect(() => {
    void load(null, false);
  }, [type]); // eslint-disable-line react-hooks/exhaustive-deps

  async function onSearch(e: React.FormEvent) {
    e.preventDefault();
    await load(null, false);
  }

  async function downloadAll() {
    setDownloading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ type, format: "csv" });
      if (q.trim()) params.set("q", q.trim());
      const token = getAccessToken();
      const res = await fetch(`/api/security/list?${params}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(d.error ?? "Download failed");
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download =
        type === "checked-in"
          ? "security-checked-in.csv"
          : type === "checked-out"
            ? "security-checked-out.csv"
            : "security-pending-exit.csv";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      setError("Download failed");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <StaffShell>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link
            href="/staff/security"
            className="text-sm font-medium text-nysc-green hover:underline"
          >
            ← Security dashboard
          </Link>
          <h1 className="mt-2 text-2xl font-bold text-slate-900">{TITLES[type]}</h1>
          <p className="mt-1 text-sm text-slate-600">
            Minimal view for the gate — name, call-up, status.
          </p>
        </div>
        <button
          type="button"
          disabled={downloading}
          onClick={() => void downloadAll()}
          className="rounded-md bg-nysc-green px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
        >
          {downloading ? "Downloading…" : "Download all"}
        </button>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {(["checked-in", "checked-out", "pending-exit"] as ListType[]).map((t) => (
          <Link
            key={t}
            href={`/staff/security/list?type=${t}`}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
              type === t
                ? "bg-nysc-green text-white"
                : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
            }`}
          >
            {TITLES[t]}
          </Link>
        ))}
      </div>

      <form onSubmit={onSearch} className="mt-6 flex flex-wrap gap-2">
        <input
          className="min-w-[200px] flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm"
          placeholder="Filter by name or call-up"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <button
          type="submit"
          disabled={loading}
          className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium disabled:opacity-50"
        >
          Search
        </button>
      </form>

      {error && (
        <p className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <div className="mt-6 space-y-3">
        {loading && pcms.length === 0 ? (
          <div className="space-y-2">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-16 animate-pulse rounded-xl bg-slate-200" />
            ))}
          </div>
        ) : pcms.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
            No records in this list.
          </p>
        ) : (
          pcms.map((p) => (
            <div
              key={p.id}
              className="flex gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
            >
              <div className="shrink-0">
                <PcmPhoto
                  url={p.photographUrl}
                  alt={p.fullName}
                  sizeClass="h-16 w-16"
                />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-slate-900">{p.fullName}</p>
                <p className="font-mono text-sm text-slate-600">{p.callUpNumber}</p>
                <p className="mt-1 text-xs text-slate-500">
                  {p.status}
                  {p.stateCode ? ` · ${p.stateCode}` : ""}
                  {p.deploymentState ? ` · ${p.deploymentState}` : ""}
                </p>
                {type === "pending-exit" && p.campExitGrantedAt && (
                  <p className="mt-0.5 text-xs text-amber-800">
                    Exit granted {new Date(p.campExitGrantedAt).toLocaleString()}
                  </p>
                )}
                {type === "checked-out" && p.checkedOutAt && (
                  <p className="mt-0.5 text-xs text-slate-500">
                    Out {new Date(p.checkedOutAt).toLocaleString()}
                    {p.exitDestinationState ? ` → ${p.exitDestinationState}` : ""}
                    {p.exitReason ? ` · ${p.exitReason}` : ""}
                  </p>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {hasMore && (
        <div className="mt-6 text-center">
          <button
            type="button"
            disabled={loading}
            onClick={() => void load(nextCursor, true)}
            className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium disabled:opacity-50"
          >
            {loading ? "Loading…" : "Load more"}
          </button>
        </div>
      )}
    </StaffShell>
  );
}

export default function SecurityListPage() {
  return (
    <Suspense
      fallback={
        <StaffShell>
          <div className="h-8 w-48 animate-pulse rounded bg-slate-200" />
        </StaffShell>
      }
    >
      <SecurityListInner />
    </Suspense>
  );
}
