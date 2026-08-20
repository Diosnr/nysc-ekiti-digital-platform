"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
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
  latestMinute: { body: string; action: string; createdAt: string } | null;
};

const TYPE_OPTS = [
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

function statusStyle(status: string) {
  const s = status.toUpperCase();
  if (s === "APPROVED") return "bg-green-50 text-green-800 border-green-200";
  if (s === "REJECTED" || s === "RETURNED") return "bg-red-50 text-red-800 border-red-200";
  if (s === "CLOSED") return "bg-slate-100 text-slate-600 border-slate-200";
  return "bg-amber-50 text-amber-900 border-amber-200";
}

export default function CmEfilePage() {
  const router = useRouter();
  const [files, setFiles] = useState<FileRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [type, setType] = useState("GENERAL");
  const [subject, setSubject] = useState("");
  const [minute, setMinute] = useState("");
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

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setSubmitError(null);
    setSubmitMsg(null);
    if (!subject.trim()) {
      setSubmitError("Subject is required");
      return;
    }
    setSubmitting(true);
    try {
      const res = await cmFetch("/api/camp-portal/e-file", {
        method: "POST",
        body: JSON.stringify({
          type,
          subject: subject.trim(),
          minute: minute.trim() || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setSubmitError(data.error ?? "Could not create file");
        return;
      }
      setSubmitMsg("File opened successfully.");
      setSubject("");
      setMinute("");
      setType("GENERAL");
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
            Open a file on your own record and track status. Files are always linked to you only.
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
              onChange={(e) => setType(e.target.value)}
            >
              {TYPE_OPTS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold uppercase text-slate-500">Subject *</label>
            <input
              required
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Brief subject"
            />
          </div>
          <div>
            <label className="text-xs font-semibold uppercase text-slate-500">Details</label>
            <textarea
              rows={4}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              value={minute}
              onChange={(e) => setMinute(e.target.value)}
              placeholder="Optional note for staff"
            />
          </div>
          {submitError && (
            <p className="text-sm text-red-600">{submitError}</p>
          )}
          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-md bg-nysc-green px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
          >
            {submitting ? "Submitting…" : "Open file"}
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
