"use client";

import { FormEvent, useEffect, useState } from "react";
import { PcmPhoto } from "@/components/staff/PcmPhoto";
import { staffFetch } from "@/lib/staff-api";
import {
  EXIT_GROUNDS,
  firstStageAfterInitiation,
} from "@/lib/exit-workflow";

const FILE_TYPES = [
  { value: "GENERAL", label: "General correspondence" },
  { value: "LEAVE", label: "Leave / sick leave" },
  { value: "RELOCATION", label: "Relocation" },
  { value: "CAMP_EXIT", label: "Camp exit" },
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
  const [q, setQ] = useState("");
  const [pcmHit, setPcmHit] = useState<{
    id: string;
    callUpNumber: string;
    fullName: string;
    photographUrl?: string | null;
  } | null>(null);
  const [subject, setSubject] = useState("");
  const [ground, setGround] = useState(
    grounds[0]?.code || EXIT_GROUNDS[0].value
  );
  const [reasonDetail, setReasonDetail] = useState("");
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);
  const [officers, setOfficers] = useState<Officer[]>([]);
  const [nextToUserId, setNextToUserId] = useState("");
  const [loading, setLoading] = useState(false);

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
        setNextToUserId(sug?.id || "");
      })
      .catch(() => setOfficers([]));
  }, [fileType, ground, grounds]);

  async function searchPcm(e: FormEvent) {
    e.preventDefault();
    setPcmHit(null);
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
        onError("No PCM found");
        return;
      }
      const hit =
        hits.find(
          (p: { callUpNumber: string }) =>
            p.callUpNumber.toLowerCase() === q.trim().toLowerCase()
        ) ?? hits[0];
      setPcmHit(hit);
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
    setLoading(true);
    try {
      const res =
        fileType === "CAMP_EXIT"
          ? await staffFetch("/api/exit-requests", {
              method: "POST",
              body: JSON.stringify({
                pcmId: pcmHit.id,
                ground,
                reasonDetail: reasonDetail || subject || undefined,
                photoUrls,
                nextToUserId: nextToUserId || undefined,
              }),
            })
          : await staffFetch("/api/e-file/files", {
              method: "POST",
              body: JSON.stringify({
                pcmId: pcmHit.id,
                type: fileType,
                subject: subject || undefined,
                minute: reasonDetail || undefined,
                photoUrls,
                nextToUserId: nextToUserId || undefined,
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
      setReasonDetail("");
      setPhotoUrls([]);
      setFileType("GENERAL");
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
    <div className="mt-6 max-w-xl space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div>
        <h2 className="font-semibold text-slate-900">Create file</h2>
        <p className="mt-1 text-xs text-slate-500">
          Choose file type, corps member, minute, and who should receive it next.
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

      <form onSubmit={searchPcm} className="flex gap-2">
        <input
          className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm"
          placeholder="State code, call-up or name"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <button type="submit" className="rounded-md border border-slate-300 px-3 py-2 text-sm">
          Find
        </button>
      </form>

      {pcmHit && (
        <form onSubmit={submit} className="space-y-3 border-t border-slate-100 pt-4">
          <div className="flex gap-3">
            <PcmPhoto
              url={pcmHit.photographUrl}
              alt={pcmHit.fullName}
              sizeClass="h-14 w-14"
            />
            <div>
              <p className="font-semibold">{pcmHit.fullName}</p>
              <p className="font-mono text-xs text-slate-600">{pcmHit.callUpNumber}</p>
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
                      requiresClinic: g.value === "MEDICAL",
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
              Send next to
            </label>
            <select
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              value={nextToUserId}
              onChange={(e) => setNextToUserId(e.target.value)}
            >
              <option value="">
                {fileType === "CAMP_EXIT"
                  ? "Default chain (role-based)"
                  : "Select officer (optional)"}
              </option>
              {officers.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.suggested ? "★ " : ""}
                  {o.name}
                  {o.roles[0] ? ` · ${o.roles[0]}` : ""}
                </option>
              ))}
            </select>
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
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-md bg-nysc-green px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
          >
            {loading ? "Opening…" : "Forward file"}
          </button>
        </form>
      )}
    </div>
  );
}
