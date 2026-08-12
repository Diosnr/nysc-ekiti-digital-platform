"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { StaffShell } from "@/components/staff/StaffShell";
import { staffFetch } from "@/lib/staff-api";

export default function PcmDetailPage() {
  const params = useParams();
  const id = String(params.id ?? "");
  const [pcm, setPcm] = useState<Record<string, unknown> | null>(null);
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
      <Link href="/staff/pcm" className="text-sm text-nysc-green hover:underline">
        ← PCM Registry
      </Link>
      {error && <p className="mt-4 text-red-600">{error}</p>}
      {!pcm && !error && <p className="mt-4 text-slate-600">Loading…</p>}
      {pcm && (
        <div className="mt-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h1 className="text-2xl font-bold text-slate-900">{String(pcm.fullName)}</h1>
          <p className="mt-1 font-mono text-sm text-slate-600">{String(pcm.callUpNumber)}</p>
          <dl className="mt-6 grid gap-3 sm:grid-cols-2 text-sm">
            <div>
              <dt className="text-xs uppercase text-slate-500">Status</dt>
              <dd>{String(pcm.status)}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase text-slate-500">Gender</dt>
              <dd>{String(pcm.gender ?? "—")}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase text-slate-500">Institution</dt>
              <dd>{String(pcm.institution ?? "—")}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase text-slate-500">Course</dt>
              <dd>{String(pcm.course ?? "—")}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase text-slate-500">State code</dt>
              <dd>{String(pcm.stateCode ?? "—")}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase text-slate-500">LGA / Zone</dt>
              <dd>
                {String(pcm.lgaCode ?? "—")} / {String(pcm.zoneCode ?? "—")}
              </dd>
            </div>
          </dl>
          <p className="mt-6 text-xs text-slate-500">
            Camp forms (Married Women, Skills, NIN) and security check-in attach to this record in later phases.
          </p>
        </div>
      )}
    </StaffShell>
  );
}
