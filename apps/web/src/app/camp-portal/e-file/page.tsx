"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { clearCmToken, cmFetch, ensureCmSessionActive } from "@/lib/cm-api";

type FileRow = {
  id: string;
  type: string;
  subject: string;
  priority: string;
  status: string;
  openedByName: string | null;
  currentHolderName: string | null;
  createdAt: string;
  latestMinute: {
    body: string;
    action: string;
    createdAt: string;
    attachmentUrls?: string[];
  } | null;
};

type Officer = {
  id: string;
  name: string;
  post: string | null;
  rank: string | null;
  roles: string[];
};

const TYPE_OPTS = [
  { value: "CAMP_EXIT", label: "Camp exit" },
  { value: "GENERAL", label: "General" },
  { value: "LEAVE", label: "Leave" },
  { value: "SICK_LEAVE", label: "Sick leave" },
  { value: "CASUAL_LEAVE", label: "Casual leave" },
  { value: "MATERNITY_LEAVE", label: "Maternity leave" },
  { value: "CONVOCATION_LEAVE", label: "Convocation leave" },
  { value: "RELOCATION", label: "Relocation" },
  { value: "REPOSTING", label: "Reposting" },
  { value: "QUERY", label: "Query / response" },
  { value: "OTHERS", label: "Others" },
];

const EXIT_GROUNDS = [
  { value: "MARITAL", label: "Marital grounds" },
  { value: "MEDICAL", label: "Medical grounds" },
  { value: "TERRORISM", label: "Security / terrorism grounds" },
  { value: "OTHER", label: "Other (explain in details)" },
];

function statusStyle(status: string) {
  const s = status.toUpperCase();
  if (s === "APPROVED") return "bg-green-50 text-green-800 border-green-200";
  if (s === "REJECTED" || s === "RETURNED") return "bg-red-50 text-red-800 border-red-200";
  if (s === "CLOSED") return "bg-slate-100 text-slate-600 border-slate-200";
  return "bg-amber-50 text-amber-900 border-amber-200";
}

function filesToDataUrls(files: FileList | null): Promise<string[]> {
  if (!files?.length) return Promise.resolve([]);
  const list = Array.from(files).slice(0, 6);
  return Promise.all(
    list.map(
      (file) =>
        new Promise<string>((resolve, reject) => {
          const r = new FileReader();
          r.onload = () => resolve(String(r.result || ""));
          r.onerror = () => reject(new Error("read failed"));
          r.readAsDataURL(file);
        })
    )
  );
}

export default function CmEfilePage() {
  const router = useRouter();
  const [files, setFiles] = useState<FileRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [type, setType] = useState("GENERAL");
  const [ground, setGround] = useState("");
  const [subject, setSubject] = useState("");
  const [minute, setMinute] = useState("");
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);
  const [officers, setOfficers] = useState<Officer[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [officerQ, setOfficerQ] = useState("");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitMsg, setSubmitMsg] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(() => {
    if (!ensureCmSessionActive()) {
      clearCmToken();
      router.replace("/camp-portal/login");
      return;
    }
    setLoading(true);
    cmFetch("/api/camp-portal/e-file")
      .then(async (res) => {
        if (res.status === 401) {
          clearCmToken();
          router.replace("/camp-portal/login");
          return;
        }
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setError(data.error ?? "Could not load files");
          return;
        }
        setError(null);
        setFiles(data.files ?? []);
      })
      .catch(() => setError("Network error"))
      .finally(() => setLoading(false));
  }, [router]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!showForm) return;
    if (!ensureCmSessionActive()) return;
    cmFetch("/api/camp-portal/e-file/officers")
      .then(async (res) => {
        if (!res.ok) return;
        const data = await res.json();
        setOfficers((data.officers ?? []) as Officer[]);
      })
      .catch(() => setOfficers([]));
  }, [showForm]);

  function toggleOfficer(id: string) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  async function onPhotoFiles(fileList: FileList | null) {
    try {
      const urls = await filesToDataUrls(fileList);
      if (urls.length) {
        setPhotoUrls((prev) => [...prev, ...urls].slice(0, 6));
      }
    } catch {
      setSubmitError("Could not read image");
    }
  }

  const filteredOfficers = officerQ.trim()
    ? officers.filter((o) => {
        const q = officerQ.trim().toLowerCase();
        return (
          o.name.toLowerCase().includes(q) ||
          (o.post && o.post.toLowerCase().includes(q)) ||
          (o.rank && o.rank.toLowerCase().includes(q)) ||
          o.roles.some((r) => r.toLowerCase().includes(q))
        );
      })
    : officers;

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setSubmitError(null);
    setSubmitMsg(null);
    if (type === "OTHERS" && !subject.trim()) {
      setSubmitError("Please describe the file type for Others");
      return;
    }
    if (type === "CAMP_EXIT" && !ground && !minute.trim()) {
      setSubmitError("Select an exit ground or explain the reason in Details");
      return;
    }
    if (!selectedIds.length) {
      setSubmitError("Select at least one officer to send this file to");
      return;
    }
    setSubmitting(true);
    try {
      const res = await cmFetch("/api/camp-portal/e-file", {
        method: "POST",
        body: JSON.stringify({
          type,
          ground: type === "CAMP_EXIT" ? ground || undefined : undefined,
          subject:
            type === "OTHERS" || type === "CAMP_EXIT"
              ? subject.trim() || undefined
              : undefined,
          minute: minute.trim() || undefined,
          nextToUserIds: selectedIds,
          nextToUserId: selectedIds[0],
          photoDataUrls: photoUrls,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setSubmitError(data.error ?? "Could not create file");
        return;
      }
      setSubmitMsg(
        data.message ||
          (data.file?.currentHolderName
            ? `File sent to ${data.file.currentHolderName}.`
            : "File opened successfully.")
      );
      setSubject("");
      setMinute("");
      setGround("");
      setType("GENERAL");
      setPhotoUrls([]);
      setSelectedIds([]);
      setOfficerQ("");
      setShowForm(false);
      load();
    } catch {
      setSubmitError("Network error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="mx-auto max-w-xl px-4 py-12 sm:px-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">E-file</h1>
          <p className="mt-2 text-sm text-slate-600">
            Open a file on your record, choose who receives it, and track status.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setShowForm((v) => !v);
            setSubmitError(null);
            setSubmitMsg(null);
          }}
          className="shrink-0 rounded-md bg-nysc-green px-3 py-2 text-sm font-semibold text-white"
        >
          {showForm ? "Cancel" : "New file"}
        </button>
      </div>

      {showForm && (
        <form
          onSubmit={onCreate}
          className="mt-6 space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
        >
          <div>
            <label className="text-xs font-semibold uppercase text-slate-500">Type</label>
            <select
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              value={type}
              onChange={(e) => {
                setType(e.target.value);
                if (e.target.value !== "OTHERS" && e.target.value !== "CAMP_EXIT") {
                  setSubject("");
                }
                if (e.target.value !== "CAMP_EXIT") setGround("");
              }}
            >
              {TYPE_OPTS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          {type === "CAMP_EXIT" && (
            <div>
              <label className="text-xs font-semibold uppercase text-slate-500">
                Exit ground
              </label>
              <select
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                value={ground}
                onChange={(e) => setGround(e.target.value)}
              >
                <option value="">Select ground…</option>
                {EXIT_GROUNDS.map((g) => (
                  <option key={g.value} value={g.value}>
                    {g.label}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-[11px] text-slate-500">
                Send to your platoon officer (or the officer handling exits). This starts the
                official camp exit workflow.
              </p>
            </div>
          )}

          {(type === "OTHERS" || type === "CAMP_EXIT") && (
            <div>
              <label className="text-xs font-semibold uppercase text-slate-500">
                {type === "CAMP_EXIT" ? "Subject (optional)" : "Describe type *"}
              </label>
              <input
                required={type === "OTHERS"}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder={
                  type === "CAMP_EXIT"
                    ? "e.g. Temporary release for medical appointment"
                    : "What is this file about?"
                }
              />
            </div>
          )}

          <div>
            <label className="text-xs font-semibold uppercase text-slate-500">Details</label>
            <textarea
              rows={3}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              value={minute}
              onChange={(e) => setMinute(e.target.value)}
              placeholder={
                type === "CAMP_EXIT"
                  ? "Explain your request (required if no ground selected)"
                  : "Optional note for the officer"
              }
            />
          </div>

          <div>
            <label className="text-xs font-semibold uppercase text-slate-500">
              Pictures
            </label>
            <input
              type="file"
              accept="image/*"
              multiple
              className="mt-1 block w-full text-sm"
              onChange={(e) => void onPhotoFiles(e.target.files)}
            />
            {photoUrls.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {photoUrls.map((u, i) => (
                  <div key={i} className="relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={u}
                      alt={`Attachment ${i + 1}`}
                      className="h-16 w-16 rounded border border-slate-200 object-cover"
                    />
                    <button
                      type="button"
                      className="absolute -right-1 -top-1 rounded-full bg-slate-800 px-1 text-[10px] text-white"
                      onClick={() =>
                        setPhotoUrls((prev) => prev.filter((_, j) => j !== i))
                      }
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
            <p className="mt-1 text-[11px] text-slate-500">Up to 6 images</p>
          </div>

          <div>
            <label className="text-xs font-semibold uppercase text-slate-500">
              Send to *
            </label>
            <input
              type="search"
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              placeholder="Search by name, post or role"
              value={officerQ}
              onChange={(e) => setOfficerQ(e.target.value)}
            />
            <div className="mt-2 max-h-52 space-y-1 overflow-y-auto rounded-md border border-slate-200 p-2">
              {filteredOfficers.length === 0 && (
                <p className="px-2 py-1 text-xs text-slate-500">
                  {officers.length === 0 ? "Loading officers…" : "No matches"}
                </p>
              )}
              {filteredOfficers.map((o) => {
                const checked = selectedIds.includes(o.id);
                const meta = [o.post, o.roles[0]].filter(Boolean).join(" · ");
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
                      {o.name}
                      {meta ? (
                        <span className="text-slate-500"> · {meta}</span>
                      ) : null}
                    </span>
                  </label>
                );
              })}
            </div>
            {selectedIds.length > 0 && (
              <p className="mt-1 text-xs text-slate-500">
                {selectedIds.length} selected · first is primary holder; others are CC
              </p>
            )}
          </div>

          {submitError && <p className="text-sm text-red-600">{submitError}</p>}
          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-md bg-nysc-green px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
          >
            {submitting
              ? "Sending…"
              : type === "CAMP_EXIT"
                ? "Submit camp exit request"
                : "Send file"}
          </button>
        </form>
      )}

      {submitMsg && (
        <p className="mt-4 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">
          {submitMsg}
        </p>
      )}
      {error && (
        <p className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      {loading ? (
        <p className="mt-8 text-sm text-slate-500">Loading…</p>
      ) : files.length === 0 ? (
        <p className="mt-8 rounded-xl border border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-600">
          No e-files yet. Use <strong>New file</strong> to open one.
        </p>
      ) : (
        <ul className="mt-8 space-y-3">
          {files.map((f) => (
            <li
              key={f.id}
              className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-900">{f.subject}</p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {f.type.replace(/_/g, " ")}
                    {f.openedByName ? ` · by ${f.openedByName}` : ""}
                  </p>
                </div>
                <span
                  className={`shrink-0 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${statusStyle(
                    f.status
                  )}`}
                >
                  {f.status.replace(/_/g, " ")}
                </span>
              </div>
              {f.currentHolderName && (
                <p className="mt-2 text-xs text-slate-500">With: {f.currentHolderName}</p>
              )}
              {f.latestMinute?.body && (
                <p className="mt-2 line-clamp-2 text-xs text-slate-600">{f.latestMinute.body}</p>
              )}
              {f.latestMinute?.attachmentUrls &&
                f.latestMinute.attachmentUrls.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {f.latestMinute.attachmentUrls.map((url, i) => (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        key={i}
                        src={url}
                        alt=""
                        className="h-12 w-12 rounded border border-slate-200 object-cover"
                      />
                    ))}
                  </div>
                )}
              <p className="mt-2 text-[11px] text-slate-400">
                {new Date(f.createdAt).toLocaleString()}
              </p>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
