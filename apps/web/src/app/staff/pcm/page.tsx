"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
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
  status: string;
  deploymentState?: string | null;
  photographUrl?: string | null;
  campAddress?: string | null;
  dateReporting?: string | null;
  batchYear?: string | null;
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

export default function PcmRegistryPage() {
  const [pcms, setPcms] = useState<Pcm[]>([]);
  const [q, setQ] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<Pcm | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [isSuper, setIsSuper] = useState(false);

  async function load(search?: string) {
    setError(null);
    setLoading(true);
    const qs = search ? `?q=${encodeURIComponent(search)}` : "";
    try {
      const res = await staffFetch(`/api/pcm${qs}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? `Failed to load PCMs (${res.status})`);
        return;
      }
      setPcms(data.pcms ?? []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    staffFetch("/api/auth/me").then(async (res) => {
      if (!res.ok) return;
      const me = await res.json();
      setIsSuper(
        (me.roles ?? []).some(
          (r: string) => r.toLowerCase() === "super admin"
        ) || (me.permissions ?? []).includes("*")
      );
    });
  }, []);

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
    load(q);
  }

  return (
    <StaffShell>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">PCM Registry</h1>
          <p className="mt-1 text-sm text-slate-600">
            Click a name to open details in the side panel.
          </p>
        </div>
        <Link
          href="/staff/pcm/intake"
          className="rounded-md bg-nysc-green px-3 py-2 text-sm font-semibold text-white"
        >
          New intake
        </Link>
      </div>

      {error && (
        <p className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <div className="mt-6 flex gap-2">
        <input
          className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm"
          placeholder="Search name, call-up, state…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && load(q)}
        />
        <button
          type="button"
          onClick={() => load(q)}
          className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium"
        >
          Search
        </button>
      </div>

      <div className="mt-6">
        {loading ? (
          <TableSkeleton rows={8} />
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">Photo</th>
                  <th className="px-4 py-3">Call-up</th>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Deployment</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {pcms.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                      No records. Use PCM Intake to register.
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
      </div>

      {/* Right slide-over */}
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
              <h2 className="text-lg font-bold text-slate-900">PCM details</h2>
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
                  <div className="h-4 w-1/2 animate-pulse rounded bg-slate-200" />
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
                          ["Deployment", detail.deploymentState],
                          ["Camp", detail.campAddress],
                          ["Reporting", detail.dateReporting],
                          ["Batch", detail.batchYear],
                        ] as [string, string | null | undefined][]
                      ).map(([k, v]) => (
                        <div key={k} className="flex justify-between gap-2 border-b border-slate-50 py-1">
                          <dt className="text-slate-500">{k}</dt>
                          <dd className="text-right font-medium text-slate-900">{v || "—"}</dd>
                        </div>
                      ))}
                    </dl>
                  </section>

                  <section>
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                      Special status
                    </h3>
                    {(detail.familyStatuses?.length ?? 0) === 0 && (
                      <p className="mt-2 text-sm text-slate-500">No submissions yet.</p>
                    )}
                    {detail.familyStatuses?.map((f) => {
                      let statuses: string[] = [];
                      try {
                        statuses = JSON.parse(f.statusesJson);
                      } catch {
                        statuses = [];
                      }
                      return (
                        <div
                          key={f.id}
                          className="mt-2 rounded-lg border border-slate-100 bg-slate-50 p-3 text-sm"
                        >
                          <p className="font-medium text-slate-900">
                            {statuses.join(", ") || "—"}
                          </p>
                          {f.husbandName && (
                            <p className="mt-1 text-slate-600">Husband: {f.husbandName}</p>
                          )}
                          <p className="mt-1 text-slate-600">Address: {f.address}</p>
                          <p className="text-slate-500">
                            {[f.state, f.lga, f.community].filter(Boolean).join(" · ")}
                          </p>
                          {f.phone && <p className="text-slate-500">Phone: {f.phone}</p>}
                        </div>
                      );
                    })}
                  </section>

                  <section>
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                      Skills
                    </h3>
                    {(detail.skillProfiles?.length ?? 0) === 0 && (
                      <p className="mt-2 text-sm text-slate-500">No submissions yet.</p>
                    )}
                    {detail.skillProfiles?.map((s) => (
                      <div
                        key={s.id}
                        className="mt-2 rounded-lg border border-slate-100 bg-slate-50 p-3 text-sm"
                      >
                        {[s.skill1, s.skill2, s.skill3].filter(Boolean).join(" · ") || "—"}
                      </div>
                    ))}
                  </section>

                  <section>
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                      Account / NIN
                    </h3>
                    {(detail.ninRecords?.length ?? 0) === 0 && (
                      <p className="mt-2 text-sm text-slate-500">No submissions yet.</p>
                    )}
                    {detail.ninRecords?.map((n) => (
                      <div
                        key={n.id}
                        className="mt-2 rounded-lg border border-slate-100 bg-slate-50 p-3 text-sm"
                      >
                        {n.nin && <p>NIN: {n.nin}</p>}
                        <div className="mt-2 flex gap-2">
                          {n.frontUrl && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={n.frontUrl}
                              alt="NIN front"
                              className="h-20 w-28 rounded border object-cover"
                            />
                          )}
                          {n.backUrl && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={n.backUrl}
                              alt="NIN back"
                              className="h-20 w-28 rounded border object-cover"
                            />
                          )}
                        </div>
                      </div>
                    ))}
                  </section>

                  {isSuper && (
                    <button
                      type="button"
                      onClick={() => void onDelete(detail.id, detail.fullName)}
                      className="w-full rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700"
                    >
                      Delete PCM
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </StaffShell>
  );
}
