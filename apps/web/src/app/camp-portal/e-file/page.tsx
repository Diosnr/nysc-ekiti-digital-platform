"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getCmToken, clearCmToken, cmFetch } from "@/lib/cm-api";

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

  useEffect(() => {
    const token = getCmToken();
    if (!token) {
      router.replace("/camp-portal/login");
      return;
    }
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
        setFiles(data.files ?? []);
      })
      .catch(() => setError("Network error"))
      .finally(() => setLoading(false));
  }, [router]);

  return (
    <main className="mx-auto max-w-xl px-4 py-12 sm:px-6">
      <Link
        href="/camp-portal"
        className="text-sm font-medium text-nysc-green hover:underline"
      >
        ← My Portal
      </Link>
      <h1 className="mt-4 text-2xl font-bold text-slate-900">E-file</h1>
      <p className="mt-2 text-sm text-slate-600">
        Electronic files linked to your record. Staff open and process these; you can track status
        here.
      </p>

      {error && (
        <p className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      {loading ? (
        <p className="mt-8 text-sm text-slate-500">Loading…</p>
      ) : files.length === 0 ? (
        <p className="mt-8 rounded-xl border border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-600">
          No e-files yet.
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
                <p className="mt-2 text-xs text-slate-500">
                  With: {f.currentHolderName}
                </p>
              )}
              {f.latestMinute?.body && (
                <p className="mt-2 line-clamp-2 text-xs text-slate-600">
                  {f.latestMinute.body}
                </p>
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
