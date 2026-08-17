"use client";

import Link from "next/link";

type Detail = {
  id: string;
  campExitGrantedAt?: string | null;
  exitReason?: string | null;
  exitDestinationState?: string | null;
  exitDestinationLga?: string | null;
  checkedOutAt?: string | null;
  kitIssuedAt?: string | null;
  bed?: { code: string; hostel?: { name: string } | null } | null;
  exitRequests?: Array<{
    id: string; ground: string; stage: string;
    initiatedByName: string; initiatedAt: string;
  }>;
  electronicFiles?: Array<{
    id: string; type: string; subject: string; status: string;
    currentHolderName: string | null; createdAt: string;
  }>;
  bankRegistration?: {
    bankName: string | null; accountNumber: string | null; accountName: string | null;
  } | null;
  clinicEncounters?: Array<{
    id: string; status: string; chiefComplaint: string | null; openedAt: string;
  }>;
  _meta?: { canViewBank?: boolean; canViewEfile?: boolean; canViewClinic?: boolean };
};

export function PcmExtraSections({ detail }: { detail: Detail }) {
  return (
    <>
      {(detail.campExitGrantedAt || detail.checkedOutAt || detail.kitIssuedAt || detail.bed) && (
        <div className="flex flex-wrap gap-1.5">
          {detail.campExitGrantedAt && !detail.checkedOutAt && (
            <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-[11px] font-semibold text-amber-900">Exit approved</span>
          )}
          {detail.checkedOutAt && (
            <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-[11px] font-semibold text-slate-700">Checked out</span>
          )}
          {detail.kitIssuedAt && (
            <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-800">Kit issued</span>
          )}
          {detail.bed && (
            <span className="rounded-full border border-sky-200 bg-sky-50 px-2.5 py-0.5 text-[11px] font-semibold text-sky-800">
              Bed {detail.bed.code}{detail.bed.hostel?.name ? ` · ${detail.bed.hostel.name}` : ""}
            </span>
          )}
        </div>
      )}

      <section>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">Camp / exit</h3>
        <dl className="mt-2 grid gap-2 text-sm">
          <div className="flex justify-between gap-2 border-b border-slate-50 py-1">
            <dt className="text-slate-500">Kit</dt>
            <dd className="text-right font-medium text-slate-900">
              {detail.kitIssuedAt ? `Issued ${new Date(detail.kitIssuedAt).toLocaleString()}` : "Not issued"}
            </dd>
          </div>
          <div className="flex justify-between gap-2 border-b border-slate-50 py-1">
            <dt className="text-slate-500">Exit</dt>
            <dd className="text-right font-medium text-slate-900">
              {detail.checkedOutAt
                ? `Out ${new Date(detail.checkedOutAt).toLocaleString()}${detail.exitDestinationState ? ` → ${detail.exitDestinationState}` : ""}${detail.exitDestinationLga ? ` / ${detail.exitDestinationLga}` : ""}`
                : detail.campExitGrantedAt
                  ? `Granted ${new Date(detail.campExitGrantedAt).toLocaleString()}`
                  : "—"}
            </dd>
          </div>
          {detail.exitReason && (
            <div className="flex justify-between gap-2 border-b border-slate-50 py-1">
              <dt className="text-slate-500">Reason</dt>
              <dd className="max-w-[60%] text-right font-medium text-slate-900">{detail.exitReason}</dd>
            </div>
          )}
        </dl>
      </section>

      {detail._meta?.canViewEfile && (
        <section>
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">E-files & exit requests</h3>
            <Link href="/staff/e-file" className="text-[11px] font-semibold text-nysc-green hover:underline">Desk →</Link>
          </div>
          {(detail.exitRequests?.length ?? 0) > 0 && (
            <ul className="mt-2 space-y-1.5">
              {detail.exitRequests!.map((r) => (
                <li key={r.id} className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-sm">
                  <span className="font-medium">{r.ground}</span>
                  <span className="ml-2 rounded-full bg-slate-200 px-1.5 py-0.5 text-[10px] font-semibold">{r.stage}</span>
                  <p className="text-[11px] text-slate-500">{r.initiatedByName} · {new Date(r.initiatedAt).toLocaleString()}</p>
                </li>
              ))}
            </ul>
          )}
          {(detail.electronicFiles?.length ?? 0) > 0 && (
            <ul className="mt-2 space-y-1.5">
              {detail.electronicFiles!.map((f) => (
                <li key={f.id} className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-sm">
                  <div className="flex justify-between"><span className="font-medium">{f.type}</span><span className="text-[10px] font-semibold">{f.status}</span></div>
                  <p className="text-xs text-slate-700">{f.subject}</p>
                  <p className="text-[11px] text-slate-500">{new Date(f.createdAt).toLocaleString()}{f.currentHolderName ? ` · ${f.currentHolderName}` : ""}</p>
                </li>
              ))}
            </ul>
          )}
          {(detail.exitRequests?.length ?? 0) === 0 && (detail.electronicFiles?.length ?? 0) === 0 && (
            <p className="mt-2 text-sm text-slate-500">No e-files or exit requests.</p>
          )}
        </section>
      )}

      {detail._meta?.canViewBank && detail.bankRegistration && (
        <section>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">Bank</h3>
          <p className="mt-2 text-sm text-slate-800">
            {[detail.bankRegistration.bankName, detail.bankRegistration.accountName, detail.bankRegistration.accountNumber].filter(Boolean).join(" · ") || "Registered"}
          </p>
        </section>
      )}

      {detail._meta?.canViewClinic && (detail.clinicEncounters?.length ?? 0) > 0 && (
        <section>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">Clinic</h3>
          <ul className="mt-2 space-y-1 text-sm">
            {detail.clinicEncounters!.map((c) => (
              <li key={c.id}>{c.chiefComplaint || "Encounter"} · {c.status} · {new Date(c.openedAt).toLocaleDateString()}</li>
            ))}
          </ul>
        </section>
      )}

      <Link href={`/staff/pcm/${detail.id}`} className="block w-full rounded-md border border-slate-200 bg-slate-50 px-3 py-2.5 text-center text-sm font-semibold text-slate-800 hover:bg-slate-100">
        Open full record →
      </Link>
    </>
  );
}
