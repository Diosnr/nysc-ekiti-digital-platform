"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { StaffShell } from "@/components/staff/StaffShell";
import { PcmPhoto } from "@/components/staff/PcmPhoto";
import {
  PcmExtraSections,
  type PcmDetailExtra,
} from "@/components/staff/PcmExtraSections";
import { staffFetch } from "@/lib/staff-api";

export default function PcmDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = String(params.id ?? "");
  const [pcm, setPcm] = useState<PcmDetailExtra | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSuper, setIsSuper] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    staffFetch("/api/auth/me").then(async (res) => {
      if (!res.ok) return;
      const me = await res.json();
      setIsSuper(
        (me.roles ?? []).includes("Super Admin") ||
          (me.permissions ?? []).includes("*") ||
          (me.permissions ?? []).includes("pcm:delete")
      );
    });
  }, []);

  useEffect(() => {
    if (!id) return;
    staffFetch(`/api/pcm/${id}`).then(async (res) => {
      if (!res.ok) {
        setError("PCM not found or not in your scope");
        return;
      }
      const data = await res.json();
      setPcm(data.pcm as PcmDetailExtra);
    });
  }, [id]);

  async function onDelete() {
    if (!pcm) return;
    if (
      !confirm(
        `Delete PCM permanently?\n\n${pcm.fullName}\n${pcm.callUpNumber}\n\nThis cannot be undone.`
      )
    ) {
      return;
    }
    setDeleting(true);
    setError(null);
    try {
      const res = await staffFetch(`/api/pcm/${pcm.id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Delete failed");
        return;
      }
      router.replace("/staff/pcm");
    } catch {
      setError("Network error");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <StaffShell>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/staff/pcm"
          className="text-sm font-medium text-nysc-green hover:underline"
        >
          ← PCM Registry
        </Link>
        {isSuper && pcm && (
          <button
            type="button"
            disabled={deleting}
            onClick={() => void onDelete()}
            className="rounded-md border border-red-300 bg-red-50 px-3 py-1.5 text-sm font-semibold text-red-700 hover:bg-red-100 disabled:opacity-50"
          >
            {deleting ? "Deleting…" : "Delete PCM"}
          </button>
        )}
      </div>
      {error && <p className="mt-4 text-red-600">{error}</p>}
      {!pcm && !error && <p className="mt-4 text-slate-600">Loading…</p>}
      {pcm && (
        <div className="mt-6 space-y-6">
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-col gap-6 p-6 sm:flex-row">
              <div className="mx-auto shrink-0 sm:mx-0">
                <PcmPhoto
                  url={pcm.photographUrl}
                  alt={pcm.fullName || ""}
                  sizeClass="h-32 w-32"
                />
              </div>
              <div className="min-w-0 flex-1">
                <h1 className="text-2xl font-bold text-slate-900">
                  {pcm.fullName}
                </h1>
                <p className="mt-1 font-mono text-sm text-slate-600">
                  {pcm.callUpNumber}
                </p>
                {pcm.stateCode && (
                  <p className="font-mono text-xs text-slate-500">
                    {pcm.stateCode}
                  </p>
                )}
                <p className="mt-2 inline-flex rounded-full bg-green-50 px-2.5 py-0.5 text-xs font-semibold text-green-800">
                  {pcm.status}
                </p>
              </div>
            </div>

            <dl className="grid gap-4 border-t border-slate-100 px-6 py-5 sm:grid-cols-2 lg:grid-cols-3">
              {(
                [
                  ["Gender", pcm.gender],
                  ["Institution", pcm.institution],
                  ["Course", pcm.course],
                  ["Stream", pcm.stream],
                  ["Origin state", pcm.originState],
                  ["Deployment", pcm.deploymentState || pcm.stateCode],
                  ["PPA", pcm.ppaName],
                  ["Platoon", pcm.platoonCode],
                  ["Camp address", pcm.campAddress],
                  ["Date reporting", pcm.dateReporting],
                  ["Batch / Year", pcm.batchYear],
                ] as [string, string | null | undefined][]
              ).map(([label, value]) => (
                <div key={label}>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    {label}
                  </dt>
                  <dd className="mt-0.5 text-sm text-slate-900">
                    {value || "—"}
                  </dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="space-y-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <PcmExtraSections detail={pcm} showFullRecordLink={false} />
          </div>
        </div>
      )}
    </StaffShell>
  );
}
