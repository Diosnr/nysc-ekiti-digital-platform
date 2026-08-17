"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { StaffShell } from "@/components/staff/StaffShell";
import { staffFetch } from "@/lib/staff-api";

type Overview = {
  generatedAt: string;
  checkedIn: number;
  checkedOut: number;
  pendingExit: number;
};

function StatCard({
  label,
  value,
  hint,
  href,
  accent = "green",
}: {
  label: string;
  value: number | string;
  hint?: string;
  href: string;
  accent?: "green" | "amber" | "slate" | "rose" | "sky";
}) {
  const ring =
    accent === "green"
      ? "from-emerald-500/15 to-white border-emerald-100"
      : accent === "amber"
        ? "from-amber-500/15 to-white border-amber-100"
        : accent === "rose"
          ? "from-rose-500/15 to-white border-rose-100"
          : accent === "sky"
            ? "from-sky-500/15 to-white border-sky-100"
            : "from-slate-500/10 to-white border-slate-200";
  const num =
    accent === "green"
      ? "text-emerald-800"
      : accent === "amber"
        ? "text-amber-900"
        : accent === "rose"
          ? "text-rose-800"
          : accent === "sky"
            ? "text-sky-900"
            : "text-slate-900";

  return (
    <div
      className={`relative overflow-hidden rounded-2xl border bg-gradient-to-br ${ring} p-5 shadow-sm`}
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className={`mt-2 text-3xl font-bold tabular-nums ${num}`}>{value}</p>
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
      <Link
        href={href}
        className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-nysc-green hover:underline"
      >
        View list
        <span aria-hidden>→</span>
      </Link>
    </div>
  );
}

export default function SecurityDashboardPage() {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    staffFetch("/api/security/overview")
      .then(async (res) => {
        if (!res.ok) {
          const d = await res.json().catch(() => ({}));
          setError(d.error ?? "Could not load security overview");
          return;
        }
        setOverview(await res.json());
      })
      .catch(() => setError("Network error"))
      .finally(() => setLoading(false));
  }, []);

  return (
    <StaffShell>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Security dashboard</h1>
          <p className="mt-1 text-sm text-slate-600">
            Camp strength at the gate — who is in, who is out, and who is cleared to leave.
          </p>
        </div>
        {overview && (
          <p className="text-[11px] text-slate-400">
            Snapshot {new Date(overview.generatedAt).toLocaleString()}
          </p>
        )}
      </div>

      <Link
        href="/staff/security/checkin"
        className="mt-6 flex items-start gap-4 rounded-2xl border border-nysc-green/30 bg-gradient-to-br from-green-50 to-white p-5 shadow-sm transition hover:border-nysc-green hover:shadow-md"
      >
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-nysc-green text-lg font-bold text-white">
          ⌁
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-bold text-slate-900">Security gate</h2>
          <p className="mt-1 text-sm text-slate-600">
            Search, check in, check out, or open new intake for first-time arrivals.
          </p>
          <span className="mt-3 inline-flex items-center text-sm font-semibold text-nysc-green">
            Open gate →
          </span>
        </div>
      </Link>

      {error && (
        <p className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <section className="mt-8">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
          At a glance
        </h2>
        {loading && !overview ? (
          <div className="mt-3 grid gap-4 sm:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-32 animate-pulse rounded-2xl bg-slate-200" />
            ))}
          </div>
        ) : overview ? (
          <div className="mt-3 grid gap-4 sm:grid-cols-3">
            <StatCard
              label="Currently checked in"
              value={overview.checkedIn}
              hint="Still present in camp"
              href="/staff/security/list?type=checked-in"
              accent="green"
            />
            <StatCard
              label="Currently checked out"
              value={overview.checkedOut}
              hint="Left through the gate"
              href="/staff/security/list?type=checked-out"
              accent="slate"
            />
            <StatCard
              label="Exit approved, not out"
              value={overview.pendingExit}
              hint="Granted exit — awaiting check-out"
              href="/staff/security/list?type=pending-exit"
              accent="amber"
            />
          </div>
        ) : null}
      </section>
    </StaffShell>
  );
}
