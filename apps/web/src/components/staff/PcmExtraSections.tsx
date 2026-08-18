"use client";

import Link from "next/link";

export type PcmDetailExtra = {
  id: string;
  callUpNumber?: string;
  fullName?: string;
  photographUrl?: string | null;
  gender?: string | null;
  institution?: string | null;
  course?: string | null;
  status?: string;
  deploymentState?: string | null;
  stateCode?: string | null;
  originState?: string | null;
  stream?: string | null;
  platoonCode?: string | null;
  campAddress?: string | null;
  dateReporting?: string | null;
  batchYear?: string | null;
  ppaName?: string | null;
  campExitGrantedAt?: string | null;
  exitReason?: string | null;
  exitDestinationState?: string | null;
  exitDestinationLga?: string | null;
  expectedReturnAt?: string | null;
  checkedOutAt?: string | null;
  kitIssuedAt?: string | null;
  bed?: { code: string; hostel?: { name: string } | null } | null;
  exitRequests?: Array<{
    id: string;
    ground: string;
    stage: string;
    reasonDetail?: string | null;
    initiatedByName: string;
    initiatedAt: string;
    nextAssigneeName?: string | null;
    clinicNote?: string | null;
    directorNote?: string | null;
    coordinatorNote?: string | null;
    rejectReason?: string | null;
  }>;
  electronicFiles?: Array<{
    id: string;
    type: string;
    subject: string;
    status: string;
    priority?: string | null;
    openedByName?: string | null;
    currentHolderName: string | null;
    createdAt: string;
    minutes?: Array<{
      id: string;
      fromName: string;
      toName?: string | null;
      body: string;
      action: string;
      createdAt: string;
    }>;
  }>;
  bankRegistration?: {
    bankName: string | null;
    accountNumber: string | null;
    accountName: string | null;
  } | null;
  clinicEncounters?: Array<{
    id: string;
    status: string;
    chiefComplaint: string | null;
    diagnosis?: string | null;
    openedAt: string;
  }>;
  familyStatuses?: Array<{
    id: string;
    statusesJson: string;
    husbandName: string | null;
    address: string;
    state: string | null;
    lga: string | null;
    phone: string | null;
  }>;
  skillProfiles?: Array<{
    id: string;
    skill1: string | null;
    skill2: string | null;
    skill3: string | null;
  }>;
  ninRecords?: Array<{ id: string; nin: string | null }>;
  _meta?: {
    canViewBank?: boolean;
    canViewEfile?: boolean;
    canViewClinic?: boolean;
    canViewNin?: boolean;
  };
};

function downloadProfile(detail: PcmDetailExtra) {
  const lines: string[] = [];
  lines.push(`NYSC Ekiti — member profile`);
  lines.push(`Generated: ${new Date().toLocaleString()}`);
  lines.push("");
  lines.push(`Name: ${detail.fullName ?? ""}`);
  lines.push(`Call-up: ${detail.callUpNumber ?? ""}`);
  lines.push(`Status: ${detail.status ?? ""}`);
  lines.push(`State code: ${detail.stateCode ?? "—"}`);
  lines.push(`Gender: ${detail.gender ?? "—"}`);
  lines.push(`Institution: ${detail.institution ?? "—"}`);
  lines.push(`Course: ${detail.course ?? "—"}`);
  lines.push(`Stream: ${detail.stream ?? "—"}`);
  lines.push(`Origin: ${detail.originState ?? "—"}`);
  lines.push(`Deployment: ${detail.deploymentState ?? "—"}`);
  lines.push(`PPA: ${detail.ppaName ?? "—"}`);
  lines.push(`Platoon: ${detail.platoonCode ?? "—"}`);
  lines.push(`Camp: ${detail.campAddress ?? "—"}`);
  lines.push(`Reporting: ${detail.dateReporting ?? "—"}`);
  lines.push(`Batch: ${detail.batchYear ?? "—"}`);
  lines.push("");
  lines.push("--- Camp / exit ---");
  lines.push(
    `Kit: ${detail.kitIssuedAt ? new Date(detail.kitIssuedAt).toLocaleString() : "Not issued"}`
  );
  if (detail.bed) {
    lines.push(
      `Bed: ${detail.bed.code}${detail.bed.hostel?.name ? ` · ${detail.bed.hostel.name}` : ""}`
    );
  }
  if (detail.campExitGrantedAt) {
    lines.push(`Exit granted: ${new Date(detail.campExitGrantedAt).toLocaleString()}`);
  }
  if (detail.checkedOutAt) {
    lines.push(
      `Checked out: ${new Date(detail.checkedOutAt).toLocaleString()}` +
        (detail.exitDestinationState ? ` → ${detail.exitDestinationState}` : "") +
        (detail.exitDestinationLga ? ` / ${detail.exitDestinationLga}` : "")
    );
  }
  if (detail.exitReason) lines.push(`Exit reason: ${detail.exitReason}`);
  if (detail.expectedReturnAt) {
    lines.push(`Expected return: ${new Date(detail.expectedReturnAt).toLocaleDateString()}`);
  }
  if (detail.exitRequests?.length) {
    lines.push("");
    lines.push("--- Exit requests ---");
    for (const r of detail.exitRequests) {
      lines.push(
        `• ${r.ground} · ${r.stage} · ${r.initiatedByName} · ${new Date(r.initiatedAt).toLocaleString()}`
      );
      if (r.reasonDetail) lines.push(`  ${r.reasonDetail}`);
      if (r.rejectReason) lines.push(`  Rejected: ${r.rejectReason}`);
    }
  }
  if (detail.electronicFiles?.length) {
    lines.push("");
    lines.push("--- E-files ---");
    for (const f of detail.electronicFiles) {
      lines.push(
        `• [${f.type}] ${f.subject} · ${f.status} · ${new Date(f.createdAt).toLocaleString()}`
      );
      if (f.openedByName) lines.push(`  Opened by: ${f.openedByName}`);
      if (f.currentHolderName) lines.push(`  Holder: ${f.currentHolderName}`);
      for (const m of f.minutes ?? []) {
        lines.push(
          `  - ${new Date(m.createdAt).toLocaleString()} ${m.action}: ${m.fromName}${m.toName ? ` → ${m.toName}` : ""}`
        );
        if (m.body) lines.push(`    ${m.body}`);
      }
    }
  }
  if (detail.bankRegistration) {
    lines.push("");
    lines.push("--- Bank ---");
    lines.push(
      [
        detail.bankRegistration.bankName,
        detail.bankRegistration.accountName,
        detail.bankRegistration.accountNumber,
      ]
        .filter(Boolean)
        .join(" · ") || "Registered"
    );
  }
  if (detail.clinicEncounters?.length) {
    lines.push("");
    lines.push("--- Clinic ---");
    for (const c of detail.clinicEncounters) {
      lines.push(
        `• ${c.chiefComplaint || "Encounter"} · ${c.status} · ${new Date(c.openedAt).toLocaleDateString()}`
      );
    }
  }
  if (detail.familyStatuses?.length) {
    lines.push("");
    lines.push("--- Family ---");
    for (const f of detail.familyStatuses) {
      lines.push(`• ${f.statusesJson} · ${f.address}`);
    }
  }
  if (detail.skillProfiles?.length) {
    lines.push("");
    lines.push("--- Skills ---");
    for (const s of detail.skillProfiles) {
      lines.push(
        `• ${[s.skill1, s.skill2, s.skill3].filter(Boolean).join(", ") || "—"}`
      );
    }
  }
  const blob = new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `nysc-profile-${(detail.callUpNumber || detail.id).replace(/[^\w.-]+/g, "_")}.txt`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function PcmExtraSections({
  detail,
  showFullRecordLink = true,
}: {
  detail: PcmDetailExtra;
  showFullRecordLink?: boolean;
}) {
  return (
    <>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => downloadProfile(detail)}
          className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-50"
        >
          Download profile
        </button>
      </div>

      {(detail.campExitGrantedAt ||
        detail.checkedOutAt ||
        detail.kitIssuedAt ||
        detail.bed) && (
        <div className="flex flex-wrap gap-1.5">
          {detail.campExitGrantedAt && !detail.checkedOutAt && (
            <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-[11px] font-semibold text-amber-900">
              Exit approved
            </span>
          )}
          {detail.checkedOutAt && (
            <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-[11px] font-semibold text-slate-700">
              Checked out
            </span>
          )}
          {detail.kitIssuedAt && (
            <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-800">
              Kit issued
            </span>
          )}
          {detail.bed && (
            <span className="rounded-full border border-sky-200 bg-sky-50 px-2.5 py-0.5 text-[11px] font-semibold text-sky-800">
              Bed {detail.bed.code}
              {detail.bed.hostel?.name ? ` · ${detail.bed.hostel.name}` : ""}
            </span>
          )}
        </div>
      )}

      <section>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
          Camp / exit
        </h3>
        <dl className="mt-2 grid gap-2 text-sm">
          <div className="flex justify-between gap-2 border-b border-slate-50 py-1">
            <dt className="text-slate-500">Kit</dt>
            <dd className="text-right font-medium text-slate-900">
              {detail.kitIssuedAt
                ? `Issued ${new Date(detail.kitIssuedAt).toLocaleString()}`
                : "Not issued"}
            </dd>
          </div>
          <div className="flex justify-between gap-2 border-b border-slate-50 py-1">
            <dt className="text-slate-500">Exit</dt>
            <dd className="text-right font-medium text-slate-900">
              {detail.checkedOutAt
                ? `Out ${new Date(detail.checkedOutAt).toLocaleString()}${
                    detail.exitDestinationState
                      ? ` → ${detail.exitDestinationState}`
                      : ""
                  }${
                    detail.exitDestinationLga
                      ? ` / ${detail.exitDestinationLga}`
                      : ""
                  }`
                : detail.campExitGrantedAt
                  ? `Granted ${new Date(detail.campExitGrantedAt).toLocaleString()}`
                  : "—"}
            </dd>
          </div>
          {detail.exitReason && (
            <div className="flex justify-between gap-2 border-b border-slate-50 py-1">
              <dt className="text-slate-500">Reason</dt>
              <dd className="max-w-[60%] text-right font-medium text-slate-900">
                {detail.exitReason}
              </dd>
            </div>
          )}
          {detail.expectedReturnAt && (
            <div className="flex justify-between gap-2 border-b border-slate-50 py-1">
              <dt className="text-slate-500">Return</dt>
              <dd className="text-right font-medium text-slate-900">
                {new Date(detail.expectedReturnAt).toLocaleDateString()}
              </dd>
            </div>
          )}
        </dl>
      </section>

      {detail._meta?.canViewEfile && (
        <section>
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              E-files & exit history
            </h3>
            <Link
              href="/staff/e-file"
              className="text-[11px] font-semibold text-nysc-green hover:underline"
            >
              Desk →
            </Link>
          </div>
          <div className="mt-2 max-h-72 space-y-2 overflow-y-auto pr-1">
            {(detail.exitRequests?.length ?? 0) > 0 &&
              detail.exitRequests!.map((r) => (
                <div
                  key={r.id}
                  className="rounded-lg border border-amber-100 bg-amber-50/60 px-3 py-2 text-sm"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">Exit · {r.ground}</span>
                    <span className="rounded-full bg-amber-200/80 px-1.5 py-0.5 text-[10px] font-semibold">
                      {r.stage}
                    </span>
                  </div>
                  {r.reasonDetail && (
                    <p className="mt-0.5 text-xs text-slate-700">{r.reasonDetail}</p>
                  )}
                  <p className="text-[11px] text-slate-500">
                    {r.initiatedByName} ·{" "}
                    {new Date(r.initiatedAt).toLocaleString()}
                    {r.nextAssigneeName ? ` · → ${r.nextAssigneeName}` : ""}
                  </p>
                  {r.rejectReason && (
                    <p className="mt-0.5 text-xs text-red-700">
                      Rejected: {r.rejectReason}
                    </p>
                  )}
                </div>
              ))}
            {(detail.electronicFiles?.length ?? 0) > 0 &&
              detail.electronicFiles!.map((f) => (
                <div
                  key={f.id}
                  className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-sm"
                >
                  <div className="flex justify-between gap-2">
                    <span className="font-medium">{f.type}</span>
                    <span className="text-[10px] font-semibold uppercase text-slate-600">
                      {f.status}
                    </span>
                  </div>
                  <p className="text-xs text-slate-800">{f.subject}</p>
                  <p className="text-[11px] text-slate-500">
                    {new Date(f.createdAt).toLocaleString()}
                    {f.openedByName ? ` · by ${f.openedByName}` : ""}
                    {f.currentHolderName ? ` · holder ${f.currentHolderName}` : ""}
                  </p>
                  {(f.minutes?.length ?? 0) > 0 && (
                    <ul className="mt-2 max-h-32 space-y-1.5 overflow-y-auto border-t border-slate-100 pt-2">
                      {f.minutes!.map((m) => (
                        <li key={m.id} className="text-[11px] text-slate-600">
                          <span className="font-semibold text-slate-700">
                            {m.action}
                          </span>{" "}
                          · {m.fromName}
                          {m.toName ? ` → ${m.toName}` : ""} ·{" "}
                          {new Date(m.createdAt).toLocaleString()}
                          {m.body ? (
                            <p className="mt-0.5 whitespace-pre-wrap text-slate-500">
                              {m.body}
                            </p>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            {(detail.exitRequests?.length ?? 0) === 0 &&
              (detail.electronicFiles?.length ?? 0) === 0 && (
                <p className="text-sm text-slate-500">
                  No e-files or exit requests.
                </p>
              )}
          </div>
        </section>
      )}

      {detail._meta?.canViewBank && detail.bankRegistration && (
        <section>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Bank
          </h3>
          <p className="mt-2 text-sm text-slate-800">
            {[
              detail.bankRegistration.bankName,
              detail.bankRegistration.accountName,
              detail.bankRegistration.accountNumber,
            ]
              .filter(Boolean)
              .join(" · ") || "Registered"}
          </p>
        </section>
      )}

      {detail._meta?.canViewClinic &&
        (detail.clinicEncounters?.length ?? 0) > 0 && (
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Clinic
            </h3>
            <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto text-sm">
              {detail.clinicEncounters!.map((c) => (
                <li key={c.id}>
                  {c.chiefComplaint || "Encounter"} · {c.status} ·{" "}
                  {new Date(c.openedAt).toLocaleDateString()}
                  {c.diagnosis ? ` · ${c.diagnosis}` : ""}
                </li>
              ))}
            </ul>
          </section>
        )}

      {(detail.familyStatuses?.length ?? 0) > 0 && (
        <section>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Family
          </h3>
          <ul className="mt-2 space-y-1 text-sm">
            {detail.familyStatuses!.map((f) => (
              <li key={f.id} className="text-slate-700">
                {f.statusesJson}
                {f.husbandName ? ` · ${f.husbandName}` : ""} · {f.address}
                {f.lga ? ` · ${f.lga}` : ""}
              </li>
            ))}
          </ul>
        </section>
      )}

      {(detail.skillProfiles?.length ?? 0) > 0 && (
        <section>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Skills
          </h3>
          <ul className="mt-2 space-y-1 text-sm">
            {detail.skillProfiles!.map((s) => (
              <li key={s.id}>
                {[s.skill1, s.skill2, s.skill3].filter(Boolean).join(" · ") ||
                  "—"}
              </li>
            ))}
          </ul>
        </section>
      )}

      {detail._meta?.canViewNin && (detail.ninRecords?.length ?? 0) > 0 && (
        <section>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            NIN
          </h3>
          <ul className="mt-2 space-y-1 font-mono text-sm">
            {detail.ninRecords!.map((n) => (
              <li key={n.id}>{n.nin || "—"}</li>
            ))}
          </ul>
        </section>
      )}

      {showFullRecordLink && (
        <Link
          href={`/staff/pcm/${detail.id}`}
          className="block w-full rounded-md border border-slate-200 bg-slate-50 px-3 py-2.5 text-center text-sm font-semibold text-slate-800 hover:bg-slate-100"
        >
          Open full record →
        </Link>
      )}
    </>
  );
}
