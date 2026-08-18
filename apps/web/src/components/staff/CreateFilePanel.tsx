"use client";

import { FormEvent, useEffect, useState } from "react";
import { PcmPhoto } from "@/components/staff/PcmPhoto";
import {
  PcmExtraSections,
  type PcmDetailExtra,
} from "@/components/staff/PcmExtraSections";
import { staffFetch } from "@/lib/staff-api";
import {
  EXIT_GROUNDS,
  firstStageAfterInitiation,
} from "@/lib/exit-workflow";

const FILE_TYPES = [
  { value: "GENERAL", label: "General correspondence" },
  { value: "SICK_LEAVE", label: "Sick Leave" },
  { value: "CASUAL_LEAVE", label: "Casual Leave" },
  { value: "MATERNITY_LEAVE", label: "Maternity leave" },
  { value: "CONVOCATION_LEAVE", label: "Convocation leave" },
  { value: "RELOCATION", label: "Relocation" },
  { value: "REPOSTING", label: "Reposting" },
  { value: "CAMP_EXIT", label: "Camp exit" },
  { value: "QUERY", label: "Query" },
  { value: "OTHERS", label: "Others" },
] as const;

type GroundOpt = {
  code: string;
  label: string;
  requiresClinic: boolean;
  isActive?: boolean;
};

type Officer = {
  id: string;
  name: string;
  email: string;
  roles: string[];
  suggested?: boolean;
};

type PcmHit = {
  id: string;
  callUpNumber: string;
  fullName: string;
  photographUrl?: string | null;
  stateCode?: string | null;
  gender?: string | null;
  stream?: string | null;
  originState?: string | null;
  course?: string | null;
  ppaName?: string | null;
  institution?: string | null;
};

export function CreateFilePanel({
  canInitiateCampExit,
  grounds,
  onDone,
  onError,
}: {
  canInitiateCampExit: boolean;
  grounds: GroundOpt[];
  onDone: (msg: string) => void;
  onError: (msg: string) => void;
}) {
  const [fileType, setFileType] = useState("GENERAL");
  const [otherLabel, setOtherLabel] = useState("");
  const [q, setQ] = useState("");
  const [pcmHit, setPcmHit] = useState<PcmHit | null>(null);
  const [pcmDetail, setPcmDetail] = useState<PcmDetailExtra | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  const [subject, setSubject] = useState("");
  const [ground, setGround] = useState(
    grounds[0]?.code || EXIT_GROUNDS[0].value
  );
  const [reasonDetail, setReasonDetail] = useState("");
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);
  const [attachPcmProfile, setAttachPcmProfile] = useState(false);
  const [officers, setOfficers] = useState<Officer[]>([]);
  const [selectedOfficerIds, setSelectedOfficerIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  async function loadPcmDetail(id: string) {
    setDetailLoading(true);
    setPcmDetail(null);
    try {
      const res = await staffFetch(`/api/pcm/${id}`);
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.pcm) {
        setPcmDetail(data.pcm as PcmDetailExtra);
      }
    } catch {
      /* non-blocking */
    } finally {
      setDetailLoading(false);
    }
  }

  useEffect(() => {
    if (grounds.length && !grounds.find((g) => g.code === ground)) {
      setGround(grounds[0].code);
    }
  }, [grounds, ground]);

  useEffect(() => {
    let url = "/api/e-file/officers";
    if (fileType === "CAMP_EXIT") {
      const g = grounds.find((x) => x.code === ground);
      const stage = firstStageAfterInitiation(ground, g?.requiresClinic);
      url = `/api/e-file/officers?stage=${stage}`;
    }
    staffFetch(url)
      .then(async (res) => {
        if (!res.ok) return;
        const data = await res.json();
        const list = (data.officers ?? []) as Officer[];
        setOfficers(list);
        const sug = list.find((o) => o.suggested);
        setSelectedOfficerIds(sug ? [sug.id] : []);
      })
      .catch(() => setOfficers([]));
  }, [fileType, ground, grounds]);

  function toggleOfficer(id: string) {
    setSelectedOfficerIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  async function searchPcm(e: FormEvent) {
    e.preventDefault();
    setPcmHit(null);
    setPcmDetail(null);
    setShowDetail(false);
    if (!q.trim()) return;
    setLoading(true);
    try {
      const res = await staffFetch(
        `/api/pcm?q=${encodeURIComponent(q.trim())}&callUp=${encodeURIComponent(q.trim())}`
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        onError(data.error ?? "Search failed");
        return;
      }
      const hits = data.pcms ?? [];
      if (!hits.length) {
        onError("No corps member found");
        return;
      }
      const hit =
        hits.find(
          (p: { callUpNumber: string }) =>
            p.callUpNumber.toLowerCase() === q.trim().toLowerCase()
        ) ?? hits[0];
      setPcmHit(hit);
      void loadPcmDetail(hit.id);
    } catch {
      onError("Network error");
    } finally {
      setLoading(false);
    }
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!pcmHit) return;
    if (fileType === "CAMP_EXIT" && !canInitiateCampExit) {
      onError("Only platoon officers may open a camp-exit file");
      return;
    }
    if (fileType === "OTHERS" && !otherLabel.trim()) {
      onError("Please describe the file type for Others");
      return;
    }
    setLoading(true);
    try {
      const nextToUserId = selectedOfficerIds[0] || undefined;
      const nextToUserIds = selectedOfficerIds.length
        ? selectedOfficerIds
        : undefined;

      const resolvedSubject =
        fileType === "OTHERS"
          ? otherLabel.trim() || subject
          : subject || undefined;

      const res =
        fileType === "CAMP_EXIT"
          ? await staffFetch("/api/exit-requests", {
              method: "POST",
              body: JSON.stringify({
                pcmId: pcmHit.id,
                ground,
                reasonDetail: reasonDetail || resolvedSubject || undefined,
                photoUrls,
                nextToUserId,
                nextToUserIds,
              }),
            })
          : await staffFetch("/api/e-file/files", {
              method: "POST",
              body: JSON.stringify({
                pcmId: pcmHit.id,
                type: fileType,
                subject: resolvedSubject,
                minute: reasonDetail || undefined,
                photoUrls,
                nextToUserId,
                nextToUserIds,
                otherLabel: fileType === "OTHERS" ? otherLabel.trim() : undefined,
                includePcmProfile: attachPcmProfile,
              }),
            });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        onError(data.error ?? "Could not open file");
        return;
      }
      onDone("File opened");
      setPcmHit(null);
      setQ("");
      setSubject("");
      setOtherLabel("");
      setReasonDetail("");
      setPhotoUrls([]);
      setFileType("GENERAL");
      setSelectedOfficerIds([]);
    } catch {
      onError("Network error");
    } finally {
      setLoading(false);
    }
  }

  function onPhotoFiles(files: FileList | null) {
    if (!files?.length) return;
    Array.from(files)
      .slice(0, 4)
      .forEach((file) => {
        const reader = new FileReader();
        reader.onload = () => {
          const url = String(reader.result || "");
          if (url) setPhotoUrls((prev) => [...prev, url].slice(0, 6));
        };
        reader.readAsDataURL(file);
      });
  }

  const types = FILE_TYPES.filter(
    (t) => t.value !== "CAMP_EXIT" || canInitiateCampExit
  );

  return (
    <div className="mt-6 max-w-2xl space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div>
        <h2 className="font-semibold text-slate-900">Create file</h2>
        <p className="mt-1 text-xs text-slate-500">
          Choose file type, find the corps member by state code, call-up or name, then route to one or more officers.
        </p>
      </div>

      <div>
        <label className="text-xs font-semibold uppercase text-slate-500">
          File type *
        </label>
        <select
          className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          value={fileType}
          onChange={(e) => setFileType(e.target.value)}
        >
          {types.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </div>

      {fileType === "OTHERS" && (
        <div>
          <label className="text-xs font-semibold uppercase text-slate-500">
            Specify type *
          </label>
          <input
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            placeholder="Describe the file type"
            value={otherLabel}
            onChange={(e) => setOtherLabel(e.target.value)}
          />
        </div>
      )}

      <form onSubmit={searchPcm} className="flex flex-wrap gap-2">
        <input
          className="min-w-[12rem] flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm"
          placeholder="State code, call-up or name"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <button
          type="submit"
          disabled={loading}
          className="rounded-md bg-nysc-green px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          FIND FILE
        </button>
      </form>

      {pcmHit && (
        <form onSubmit={submit} className="space-y-4 border-t border-slate-100 pt-4">
          <div className="flex flex-wrap gap-4 rounded-xl border border-slate-100 bg-slate-50/80 p-4">
            <PcmPhoto
              url={pcmHit.photographUrl}
              alt={pcmHit.fullName}
              sizeClass="h-20 w-20"
            />
            <div className="min-w-0 flex-1 text-sm">
              <p className="text-lg font-semibold text-slate-900">{pcmHit.fullName}</p>
              <dl className="mt-2 grid gap-1 sm:grid-cols-2">
                <div>
                  <dt className="text-[11px] uppercase text-slate-400">Call-up</dt>
                  <dd className="font-mono text-xs">{pcmHit.callUpNumber}</dd>
                </div>
                <div>
                  <dt className="text-[11px] uppercase text-slate-400">State code</dt>
                  <dd className="font-medium">{pcmHit.stateCode || "— (PCM)"}</dd>
                </div>
                <div>
                  <dt className="text-[11px] uppercase text-slate-400">Sex</dt>
                  <dd>{pcmHit.gender || "—"}</dd>
                </div>
                <div>
                  <dt className="text-[11px] uppercase text-slate-400">Stream</dt>
                  <dd>{pcmHit.stream || "—"}</dd>
                </div>
                <div>
                  <dt className="text-[11px] uppercase text-slate-400">Origin</dt>
                  <dd>{pcmHit.originState || "—"}</dd>
                </div>
                <div>
                  <dt className="text-[11px] uppercase text-slate-400">Course</dt>
                  <dd>{pcmHit.course || "—"}</dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="text-[11px] uppercase text-slate-400">PPA</dt>
                  <dd>{pcmHit.ppaName || "—"}</dd>
                </div>
              </dl>
              <button
                type="button"
                onClick={() => {
                  setShowDetail(true);
                  if (!pcmDetail && pcmHit) void loadPcmDetail(pcmHit.id);
                }}
                className="mt-3 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-50"
              >
                {detailLoading
                  ? "Loading profile…"
                  : "View full profile (e-files, exit, bank…)"}
              </button>
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold uppercase text-slate-500">Subject</label>
            <input
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            />
          </div>

          {fileType === "CAMP_EXIT" && (
            <div>
              <label className="text-xs font-semibold uppercase text-slate-500">
                Exit ground *
              </label>
              <select
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                value={ground}
                onChange={(e) => setGround(e.target.value)}
              >
                {(grounds.length
                  ? grounds
                  : EXIT_GROUNDS.map((g) => ({
                      code: g.value,
                      label: g.label,
                      requiresClinic: g.value === "MEDICAL" || g.value === "HEALTH",
                    }))
                ).map((g) => (
                  <option key={g.code} value={g.code}>
                    {g.label}
                    {g.requiresClinic ? " (via clinic)" : ""}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="text-xs font-semibold uppercase text-slate-500">
              Send to officers (select one or more)
            </label>
            <div className="mt-2 max-h-48 space-y-1 overflow-y-auto rounded-md border border-slate-200 p-2">
              {officers.length === 0 && (
                <p className="px-2 py-1 text-xs text-slate-500">No officers loaded</p>
              )}
              {officers.map((o) => {
                const checked = selectedOfficerIds.includes(o.id);
                return (
                  <label
                    key={o.id}
                    className={`flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-slate-50 ${
                      checked ? "bg-emerald-50" : ""
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleOfficer(o.id)}
                      className="h-4 w-4 rounded border-slate-300 text-nysc-green"
                    />
                    <span className="min-w-0 flex-1 truncate">
                      {o.suggested ? "★ " : ""}
                      {o.name}
                      {o.roles[0] ? (
                        <span className="text-slate-500"> · {o.roles[0]}</span>
                      ) : null}
                    </span>
                  </label>
                );
              })}
            </div>
            {selectedOfficerIds.length > 0 && (
              <p className="mt-1 text-xs text-slate-500">
                {selectedOfficerIds.length} officer
                {selectedOfficerIds.length === 1 ? "" : "s"} selected · first is primary
                holder; others are CC
              </p>
            )}
          </div>

          <div>
            <label className="text-xs font-semibold uppercase text-slate-500">Minute</label>
            <textarea
              rows={4}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              value={reasonDetail}
              onChange={(e) => setReasonDetail(e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs font-semibold uppercase text-slate-500">Attachments</label>
            <input
              type="file"
              accept="image/*"
              multiple
              className="mt-1 block w-full text-sm"
              onChange={(e) => onPhotoFiles(e.target.files)}
            />
            {photoUrls.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {photoUrls.map((u, i) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={i}
                    src={u}
                    alt={`Selected ${i + 1}`}
                    className="h-16 w-16 rounded border border-slate-200 object-cover"
                  />
                ))}
              </div>
            )}
          </div>
          <label className="flex items-start gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-800">
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 rounded border-slate-300 text-nysc-green"
              checked={attachPcmProfile}
              onChange={(e) => setAttachPcmProfile(e.target.checked)}
            />
            <span>
              <span className="font-semibold">Attach their full record</span>
              <span className="mt-0.5 block text-xs text-slate-500">
                Recipient can open the member&apos;s comprehensive profile with download.
              </span>
            </span>
          </label>
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-md bg-nysc-green px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
          >
            {loading ? "Opening…" : "Forward file"}
          </button>
        </form>
      )}

      {showDetail && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/40">
          <button
            type="button"
            aria-label="Close profile"
            className="absolute inset-0 cursor-default"
            onClick={() => setShowDetail(false)}
          />
          <aside className="relative flex h-full w-full max-w-md flex-col overflow-y-auto bg-white shadow-2xl sm:max-w-lg">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white px-4 py-3">
              <h2 className="text-sm font-semibold text-slate-900">
                Member profile
              </h2>
              <button
                type="button"
                onClick={() => setShowDetail(false)}
                className="rounded-md border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Close
              </button>
            </div>
            <div className="space-y-4 p-4">
              {detailLoading && (
                <p className="text-sm text-slate-500">Loading full profile…</p>
              )}
              {!detailLoading && pcmDetail && (
                <>
                  <div className="flex items-start gap-3">
                    <PcmPhoto
                      url={
                        pcmDetail.photographUrl as string | null | undefined
                      }
                      alt={pcmDetail.fullName || ""}
                      sizeClass="h-16 w-16"
                    />
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-900">
                        {pcmDetail.fullName}
                      </p>
                      <p className="font-mono text-xs text-slate-600">
                        {pcmDetail.callUpNumber}
                      </p>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {pcmDetail.status}
                      </p>
                    </div>
                  </div>
                  <PcmExtraSections detail={pcmDetail} />
                </>
              )}
              {!detailLoading && !pcmDetail && (
                <p className="text-sm text-amber-800">
                  Could not load full profile. Try again from Registry.
                </p>
              )}
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
