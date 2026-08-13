"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { StaffShell } from "@/components/staff/StaffShell";
import { staffFetch } from "@/lib/staff-api";

type Pcm = {
  id: string;
  callUpNumber: string;
  fullName: string;
  gender: string | null;
  institution: string | null;
  status: string;
  deploymentState?: string | null;
  photographUrl?: string | null;
};

export default function PcmRegistryPage() {
  const [pcms, setPcms] = useState<Pcm[]>([]);
  const [q, setQ] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function load(search?: string) {
    setError(null);
    const qs = search ? `?q=${encodeURIComponent(search)}` : "";
    const res = await staffFetch(`/api/pcm${qs}`);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error ?? `Failed to load PCMs (${res.status})`);
      return;
    }
    setPcms(data.pcms ?? []);
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <StaffShell>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">PCM Registry</h1>
          <p className="mt-1 text-sm text-slate-600">Search verified corps members.</p>
        </div>
        <Link
          href="/staff/pcm/intake"
          className="rounded-md bg-nysc-green px-3 py-2 text-sm font-semibold text-white"
        >
          New intake
        </Link>
      </div>

      {error && (
        <p className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <div className="mt-6 flex gap-2">
        <input
          className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm"
          placeholder="Search name, call-up, state…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && load(q)}
        />
        <button
          type="button"
          onClick={() => load(q)}
          className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium"
        >
          Search
        </button>
      </div>

      <div className="mt-6 overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">Photo</th>
              <th className="px-4 py-3">Call-up</th>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Deployment</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {pcms.length === 0 && !error && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                  No records. Use PCM Intake to register.
                </td>
              </tr>
            )}
            {pcms.map((p) => (
              <tr key={p.id} className="border-b border-slate-100">
                <td className="px-4 py-2">
                  {p.photographUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={p.photographUrl}
                      alt=""
                      className="h-10 w-10 rounded-md object-cover"
                    />
                  ) : (
                    <div className="h-10 w-10 rounded-md bg-slate-100" />
                  )}
                </td>
                <td className="px-4 py-3 font-mono text-xs">{p.callUpNumber}</td>
                <td className="px-4 py-3 font-medium">
                  <Link
                    href={`/staff/pcm/${p.id}`}
                    className="text-nysc-green hover:underline"
                  >
                    {p.fullName}
                  </Link>
                </td>
                <td className="px-4 py-3 text-slate-600">
                  {p.deploymentState ?? "—"}
                </td>
                <td className="px-4 py-3 text-xs">{p.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </StaffShell>
  );
}
