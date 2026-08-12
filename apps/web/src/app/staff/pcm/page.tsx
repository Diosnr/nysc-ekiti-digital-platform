"use client";

import { FormEvent, useEffect, useState } from "react";
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
  stateCode: string | null;
};

export default function PcmRegistryPage() {
  const [pcms, setPcms] = useState<Pcm[]>([]);
  const [q, setQ] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    callUpNumber: "",
    fullName: "",
    gender: "",
    institution: "",
    course: "",
    stateCode: "",
  });

  async function load(search?: string) {
    const qs = search ? `?q=${encodeURIComponent(search)}` : "";
    const res = await staffFetch(`/api/pcm${qs}`);
    if (res.status === 403) {
      setError("You need pcm:read or pcm:search permission.");
      return;
    }
    if (res.ok) {
      const data = await res.json();
      setPcms(data.pcms);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function onIntake(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setMsg(null);
    const res = await staffFetch("/api/pcm/intake", {
      method: "POST",
      body: JSON.stringify({
        mode: "manual",
        data: {
          callUpNumber: form.callUpNumber.trim(),
          fullName: form.fullName.trim(),
          gender: form.gender || undefined,
          institution: form.institution || undefined,
          course: form.course || undefined,
          stateCode: form.stateCode || undefined,
        },
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Intake failed");
      return;
    }
    setMsg(`Created ${data.pcm.fullName} (${data.pcm.callUpNumber})`);
    setOpen(false);
    setForm({
      callUpNumber: "",
      fullName: "",
      gender: "",
      institution: "",
      course: "",
      stateCode: "",
    });
    load();
  }

  return (
    <StaffShell>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">PCM Registry</h1>
          <p className="mt-1 text-sm text-slate-600">
            Intake and search. QR remote verification stays behind adapter until authorized.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="rounded-md bg-nysc-green px-3 py-2 text-sm font-semibold text-white"
        >
          {open ? "Close" : "Manual intake"}
        </button>
      </div>

      {error && (
        <p className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}
      {msg && (
        <p className="mt-4 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">
          {msg}
        </p>
      )}

      {open && (
        <form
          onSubmit={onIntake}
          className="mt-6 grid gap-3 rounded-xl border border-slate-200 bg-white p-6 shadow-sm sm:grid-cols-2"
        >
          <input
            required
            placeholder="Call-up number"
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
            value={form.callUpNumber}
            onChange={(e) => setForm({ ...form, callUpNumber: e.target.value })}
          />
          <input
            required
            placeholder="Full name"
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
            value={form.fullName}
            onChange={(e) => setForm({ ...form, fullName: e.target.value })}
          />
          <input
            placeholder="Gender"
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
            value={form.gender}
            onChange={(e) => setForm({ ...form, gender: e.target.value })}
          />
          <input
            placeholder="State code"
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
            value={form.stateCode}
            onChange={(e) => setForm({ ...form, stateCode: e.target.value })}
          />
          <input
            placeholder="Institution"
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
            value={form.institution}
            onChange={(e) => setForm({ ...form, institution: e.target.value })}
          />
          <input
            placeholder="Course"
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
            value={form.course}
            onChange={(e) => setForm({ ...form, course: e.target.value })}
          />
          <div className="sm:col-span-2">
            <button
              type="submit"
              className="rounded-md bg-nysc-green px-4 py-2 text-sm font-semibold text-white"
            >
              Create PCM record
            </button>
          </div>
        </form>
      )}

      <div className="mt-6 flex gap-2">
        <input
          className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm"
          placeholder="Search name, call-up, state code…"
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
              <th className="px-4 py-3">Call-up</th>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Institution</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {pcms.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-slate-500">
                  No PCM records yet. Use Manual intake or QR when authorized.
                </td>
              </tr>
            )}
            {pcms.map((p) => (
              <tr key={p.id} className="border-b border-slate-100">
                <td className="px-4 py-3 font-mono text-xs">{p.callUpNumber}</td>
                <td className="px-4 py-3 font-medium">
                  <Link href={`/staff/pcm/${p.id}`} className="text-nysc-green hover:underline">
                    {p.fullName}
                  </Link>
                </td>
                <td className="px-4 py-3 text-slate-600">{p.institution ?? "—"}</td>
                <td className="px-4 py-3 text-xs">{p.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </StaffShell>
  );
}
