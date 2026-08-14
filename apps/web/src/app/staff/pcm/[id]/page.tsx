"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { StaffShell } from "@/components/staff/StaffShell";
import { PcmPhoto } from "@/components/staff/PcmPhoto";
import { staffFetch } from "@/lib/staff-api";

type Pcm = {
  id: string;
  callUpNumber: string;
  fullName: string;
  gender?: string | null;
  institution?: string | null;
  photographUrl?: string | null;
  deploymentState?: string | null;
  stateCode?: string | null;
  campAddress?: string | null;
  dateReporting?: string | null;
  batchYear?: string | null;
  status?: string;
  campExitGrantedAt?: string | null;
};

export default function PcmDetailPage() {
  const params = useParams();
  const id = String(params.id ?? "");
  const [pcm, setPcm] = useState<Pcm | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    staffFetch(`/api/pcm/${id}`).then(async (res) => {
      if (!res.ok) {
        setError("PCM not found or not in your scope");
        return;
      }
      const data = await res.json();
      setPcm(data.pcm);
    });
  }, [id]);

  return (
    <StaffShell>
      <Link href="/staff/pcm" className="text-sm font-medium text-nysc-green hover:underline">
        ← PCM Registry
      </Link>
      {error && <p className="mt-4 text-red-600">{error}</p>}
      {!pcm && !error && <p className="mt-4 text-slate-600">Loading…</p>}
      {pcm && (
        <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-6 p-6 sm:flex-row">
            <div className="mx-auto shrink-0 sm:mx-0">
              <PcmPhoto url={pcm.photographUrl} alt={pcm.fullName} />
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="text-2xl font-bold text-slate-900">{pcm.fullName}</h1>
              <p className="mt-1 font-mono text-sm text-slate-600">{pcm.callUpNumber}</p>
              <p className="mt-2 inline-flex rounded-full bg-green-50 px-2.5 py-0.5 text-xs font-semibold text-green-800">
                {pcm.status}
              </p>
            </div>
          </div>

          <dl className="grid gap-4 border-t border-slate-100 px-6 py-5 sm:grid-cols-2">
            {(
              [
                ["Gender", pcm.gender],
                ["Institution", pcm.institution],
                ["State of deployment", pcm.deploymentState || pcm.stateCode],
                ["Camp address", pcm.campAddress],
                ["Date reporting", pcm.dateReporting],
                ["Batch / Year", pcm.batchYear],
              ] as [string, string | null | undefined][]
            ).map(([label, value]) => (
              <div key={label}>
                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {label}
                </dt>
                <dd className="mt-0.5 text-sm text-slate-900">{value || "—"}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}
    </StaffShell>
  );
}
