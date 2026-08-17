"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { StaffShell } from "@/components/staff/StaffShell";
import { staffFetch } from "@/lib/staff-api";

type Me = {
  user: { name: string | null; email: string; post: string | null };
  roles: string[];
  permissions: string[];
};

type Overview = {
  generatedAt: string;
  strength: {
    onRoll: number;
    corpsMembers: number;
    prospectiveCorpsMembers: number;
    intakeComplete: number;
    presentInCamp: number;
    departed: number;
    exitInFlight: number;
  };
  departures: {
    approvedTotal: number;
    byGround: { MARITAL: number; MEDICAL: number; TERRORISM: number };
    awaitingDecision: number;
  };
  welfare: {
    medicalExitCases: number;
    clinicReviewsCompleted: number;
    specialStatusFilings: number;
    skillProfiles: number;
    ninUploads: number;
  };
  operations: { activeOfficers: number };
};

type AccSummary = {
  hostels: number;
  beds: number;
  vacant: number;
  occupied: number;
  blocked: number;
};

type AccHostel = {
  id: string;
  name: string;
  genderRestriction: string;
  vacant: number;
  occupied: number;
  bedCount: number;
  isActive: boolean;
};

function isExecutive(roles: string[], permissions: string[]) {
  if (permissions.includes("*")) return true;
  const r = roles.map((x) => x.toLowerCase());
  return r.some(
    (x) =>
      x.includes("super admin") ||
      x.includes("state coordinator") ||
      x.includes("camp director")
  );
}

function isAccommodationOfficer(roles: string[], permissions: string[]) {
  if (permissions.includes("*")) return false;
  if (roles.some((r) => r.toLowerCase() === "super admin")) return false;
  return (
    roles.some((r) => r.toLowerCase().includes("accommodation")) ||
    permissions.includes("accommodation:assign") ||
    permissions.includes("hostel:manage") ||
    permissions.includes("accommodation:read")
  );
}

function StatCard({
  label,
  value,
  hint,
  accent = "green",
}: {
  label: string;
  value: number | string;
  hint?: string;
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
    </div>
  );
}

export default function StaffDashboardPage() {
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [ovLoading, setOvLoading] = useState(false);
  const [accSummary, setAccSummary] = useState<AccSummary | null>(null);
  const [accHostels, setAccHostels] = useState<AccHostel[]>([]);
  const [accLoading, setAccLoading] = useState(false);

  useEffect(() => {
    staffFetch("/api/auth/me").then(async (res) => {
      if (!res.ok) return;
      const data = (await res.json()) as Me;
      setMe(data);
      const roles = data.roles ?? [];
      const perms = data.permissions ?? [];
      const isSecurity =
        roles.includes("Security Officer") && !roles.includes("Super Admin");
      if (isSecurity) {
        router.replace("/staff/security");
        return;
      }
      if (isExecutive(roles, perms)) {
        setOvLoading(true);
        staffFetch("/api/analytics/camp-overview")
          .then(async (r) => {
            if (!r.ok) return;
            setOverview(await r.json());
          })
          .finally(() => setOvLoading(false));
      }
      if (isAccommodationOfficer(roles, perms) || isExecutive(roles, perms)) {
        setAccLoading(true);
        staffFetch("/api/accommodation/hostels")
          .then(async (r) => {
            if (!r.ok) return;
            const d = await r.json();
            setAccSummary(d.summary ?? null);
            setAccHostels(
              ((d.hostels ?? []) as AccHostel[]).filter((h) => h.isActive !== false)
            );
          })
          .finally(() => setAccLoading(false));
      }
    });
  }, [router]);

  if (!me) {
    return (
      <StaffShell>
        <div className="space-y-3">
          <div className="h-8 w-48 animate-pulse rounded bg-slate-200" />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-28 animate-pulse rounded-2xl bg-slate-200" />
            ))}
          </div>
        </div>
      </StaffShell>
    );
  }

  if (
    me.roles.includes("Security Officer") &&
    !me.roles.includes("Super Admin")
  ) {
    return (
      <StaffShell>
        <p className="text-slate-600">Opening security dashboard…</p>
      </StaffShell>
    );
  }

  const perms = me.permissions;
  const isSuper =
    me.roles.some((r) => r.toLowerCase() === "super admin") ||
    perms.includes("*");
  const executive = isExecutive(me.roles, perms);
  const accOfficer = isAccommodationOfficer(me.roles, perms);
  const g = overview?.departures.byGround;
  const occupancyPct =
    accSummary && accSummary.beds > 0
      ? Math.round((accSummary.occupied / accSummary.beds) * 100)
      : 0;

  return (
    <StaffShell>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            {accOfficer && !executive
              ? "Accommodation overview"
              : executive
                ? "Camp command overview"
                : "Welcome"}
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            {me.user.name || me.user.email}
            {me.user.post ? ` · ${me.user.post}` : ""}
            {" · "}
            {me.roles.slice(0, 2).join(", ")}
          </p>
        </div>
        {overview && (
          <p className="text-[11px] text-slate-400">
            Snapshot {new Date(overview.generatedAt).toLocaleString()}
          </p>
        )}
      </div>

      {accOfficer && (
        <section className="mt-8 space-y-5">
          {accLoading && !accSummary ? (
            <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-24 animate-pulse rounded-2xl bg-slate-200" />
              ))}
            </div>
          ) : accSummary ? (
            <>
              <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
                <StatCard
                  label="Hostels"
                  value={accSummary.hostels}
                  hint="Active facilities"
                  accent="slate"
                />
                <StatCard
                  label="Total beds"
                  value={accSummary.beds}
                  hint={`${occupancyPct}% occupied`}
                  accent="sky"
                />
                <StatCard
                  label="Vacant"
                  value={accSummary.vacant}
                  hint="Ready to assign"
                  accent="green"
                />
                <StatCard
                  label="Occupied"
                  value={accSummary.occupied}
                  hint={
                    accSummary.blocked
                      ? `${accSummary.blocked} blocked`
                      : "Currently housed"
                  }
                  accent="amber"
                />
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
                    Hostels at a glance
                  </h2>
                  <Link
                    href="/staff/accommodation"
                    className="text-sm font-semibold text-nysc-green hover:underline"
                  >
                    Open allocation desk →
                  </Link>
                </div>
                {accHostels.length === 0 ? (
                  <p className="mt-4 text-sm text-slate-500">
                    No hostels yet. Open the desk to create one.
                  </p>
                ) : (
                  <ul className="mt-4 space-y-3">
                    {accHostels.map((h) => {
                      const total = h.bedCount || 1;
                      const pct = Math.min(100, Math.round((h.occupied / total) * 100));
                      return (
                        <li key={h.id}>
                          <div className="flex items-center justify-between gap-2 text-sm">
                            <span className="font-medium text-slate-900">{h.name}</span>
                            <span className="text-xs text-slate-500">
                              {h.genderRestriction} · {h.occupied}/{total}
                            </span>
                          </div>
                          <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-slate-100">
                            <div
                              className="h-full rounded-full bg-nysc-green transition-all"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>

              <Link
                href="/staff/accommodation"
                className="flex items-center justify-center gap-2 rounded-2xl bg-nysc-green px-5 py-3.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700"
              >
                Go to bed allocation
              </Link>
            </>
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-6 text-center">
              <p className="text-sm text-slate-600">Could not load accommodation stats.</p>
              <Link
                href="/staff/accommodation"
                className="mt-3 inline-block text-sm font-semibold text-nysc-green"
              >
                Open accommodation →
              </Link>
            </div>
          )}
        </section>
      )}

      {executive && (
        <section className="mt-8 space-y-6">
          {ovLoading && !overview ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-28 animate-pulse rounded-2xl bg-slate-200" />
              ))}
            </div>
          ) : overview ? (
            <>
              <div>
                <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
                  Strength on ground
                </h2>
                <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <StatCard
                    label="On the roll"
                    value={overview.strength.onRoll}
                    hint="Every record on file"
                    accent="slate"
                  />
                  <StatCard
                    label="Corps members (CM)"
                    value={overview.strength.corpsMembers ?? 0}
                    hint="Have state code"
                    accent="green"
                  />
                  <StatCard
                    label="Prospective (PCM)"
                    value={overview.strength.prospectiveCorpsMembers ?? 0}
                    hint="No state code yet"
                    accent="sky"
                  />
                  <StatCard
                    label="Still in camp"
                    value={overview.strength.presentInCamp}
                    hint="Checked in and still in camp"
                    accent="green"
                  />
                </div>
              </div>

              <div className="grid gap-4 lg:grid-cols-5">
                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-3">
                  <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
                    Departures authorised
                  </h2>
                  <p className="mt-2 text-3xl font-bold text-slate-900 tabular-nums">
                    {overview.departures.approvedTotal}
                  </p>
                  <p className="text-xs text-slate-500">
                    Final coordinator approvals ·{" "}
                    <span className="font-medium text-amber-700">
                      {overview.departures.awaitingDecision} still in the pipeline
                    </span>
                  </p>
                  <div className="mt-5 grid gap-3 sm:grid-cols-3">
                    <div className="rounded-xl bg-rose-50 px-4 py-3">
                      <p className="text-[11px] font-semibold uppercase text-rose-700">Marital</p>
                      <p className="mt-1 text-2xl font-bold tabular-nums text-rose-900">
                        {g?.MARITAL ?? 0}
                      </p>
                    </div>
                    <div className="rounded-xl bg-sky-50 px-4 py-3">
                      <p className="text-[11px] font-semibold uppercase text-sky-700">Medical</p>
                      <p className="mt-1 text-2xl font-bold tabular-nums text-sky-900">
                        {g?.MEDICAL ?? 0}
                      </p>
                    </div>
                    <div className="rounded-xl bg-slate-100 px-4 py-3">
                      <p className="text-[11px] font-semibold uppercase text-slate-600">
                        Security / threat
                      </p>
                      <p className="mt-1 text-2xl font-bold tabular-nums text-slate-900">
                        {g?.TERRORISM ?? 0}
                      </p>
                    </div>
                  </div>
                  <Link
                    href="/staff/e-file"
                    className="mt-4 inline-block text-sm font-medium text-nysc-green hover:underline"
                  >
                    Open e-file desk →
                  </Link>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-gradient-to-b from-emerald-50/80 to-white p-5 shadow-sm lg:col-span-2">
                  <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
                    Welfare & clinic pulse
                  </h2>
                  <dl className="mt-4 space-y-3 text-sm">
                    <div className="flex justify-between gap-2">
                      <dt className="text-slate-600">Medical exit pathways</dt>
                      <dd className="font-semibold tabular-nums text-slate-900">
                        {overview.welfare.medicalExitCases}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt className="text-slate-600">Clinic sign-offs logged</dt>
                      <dd className="font-semibold tabular-nums text-slate-900">
                        {overview.welfare.clinicReviewsCompleted}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-2 border-t border-slate-100 pt-3">
                      <dt className="text-slate-600">Special status filings</dt>
                      <dd className="font-semibold tabular-nums text-slate-900">
                        {overview.welfare.specialStatusFilings}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt className="text-slate-600">Skill profiles captured</dt>
                      <dd className="font-semibold tabular-nums text-slate-900">
                        {overview.welfare.skillProfiles}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt className="text-slate-600">NIN packs received</dt>
                      <dd className="font-semibold tabular-nums text-slate-900">
                        {overview.welfare.ninUploads}
                      </dd>
                    </div>
                  </dl>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <StatCard
                  label="Exit files in motion"
                  value={overview.strength.exitInFlight}
                  hint="Status still marked exit-requested"
                  accent="rose"
                />
                <StatCard
                  label="Officers online"
                  value={overview.operations.activeOfficers}
                  hint="Active staff accounts"
                  accent="slate"
                />
                <Link
                  href="/staff/pcm?kind=cm"
                  className="flex flex-col justify-center rounded-2xl border border-dashed border-nysc-green/40 bg-white p-5 text-center shadow-sm transition hover:border-nysc-green hover:bg-emerald-50/40"
                >
                  <p className="text-sm font-semibold text-nysc-green">CM Registry</p>
                  <p className="mt-1 text-xs text-slate-500">Corps members with state code</p>
                </Link>
              </div>
            </>
          ) : null}
        </section>
      )}

      {!accOfficer && (
        <div className="mt-10">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
            Shortcuts
          </h2>
          <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {(isSuper || perms.includes("pcm:read")) && (
              <>
                <Link
                  href="/staff/pcm?kind=pcm"
                  className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm hover:border-nysc-green/40"
                >
                  <p className="font-semibold text-slate-900">PCM Registry</p>
                  <p className="mt-1 text-sm text-slate-600">No state code yet</p>
                </Link>
                <Link
                  href="/staff/pcm?kind=cm"
                  className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm hover:border-nysc-green/40"
                >
                  <p className="font-semibold text-slate-900">CM Registry</p>
                  <p className="mt-1 text-sm text-slate-600">Corps members with state code</p>
                </Link>
              </>
            )}
            {(isSuper || perms.includes("camp:exeat") || executive) && (
              <Link
                href="/staff/e-file"
                className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm hover:border-nysc-green/40"
              >
                <p className="font-semibold text-slate-900">E-File</p>
                <p className="mt-1 text-sm text-slate-600">Queues and approvals</p>
              </Link>
            )}
            {(isSuper || perms.includes("security:checkin")) && (
              <Link
                href="/staff/security"
                className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm hover:border-nysc-green/40"
              >
                <p className="font-semibold text-slate-900">Security</p>
                <p className="mt-1 text-sm text-slate-600">Dashboard, check-in and check-out</p>
              </Link>
            )}
            {(isSuper || perms.includes("registration:complete")) && (
              <Link
                href="/staff/registration"
                className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm hover:border-nysc-green/40"
              >
                <p className="font-semibold text-slate-900">Registration</p>
                <p className="mt-1 text-sm text-slate-600">Exports and PPA / LGI / ZI</p>
              </Link>
            )}
            {(isSuper || perms.includes("user:read")) && (
              <Link
                href="/staff/admin/users"
                className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm hover:border-nysc-green/40"
              >
                <p className="font-semibold text-slate-900">Users</p>
                <p className="mt-1 text-sm text-slate-600">Officers and activation</p>
              </Link>
            )}
            {(isSuper || perms.includes("accommodation:read")) && (
              <Link
                href="/staff/accommodation"
                className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm hover:border-nysc-green/40"
              >
                <p className="font-semibold text-slate-900">Accommodation</p>
                <p className="mt-1 text-sm text-slate-600">Hostels and bed allocation</p>
              </Link>
            )}
          </div>
        </div>
      )}
    </StaffShell>
  );
}
