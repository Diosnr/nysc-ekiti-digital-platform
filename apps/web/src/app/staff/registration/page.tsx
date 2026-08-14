"use client";

import { FormEvent, useState } from "react";
import { StaffShell } from "@/components/staff/StaffShell";
import { staffFetch, getAccessToken } from "@/lib/staff-api";
import { phoneDigits, lettersOnly } from "@/lib/sanitize";

type PcmHit = {
  id: string;
  callUpNumber: string;
  fullName: string;
  stateCode?: string | null;
  ppaName?: string | null;
  ppaAddress?: string | null;
  lgiName?: string | null;
  lgiPhone?: string | null;
  ziName?: string | null;
  ziPhone?: string | null;
};

export default function RegistrationCommitteePage() {
  const [q, setQ] = useState("");
  const [pcm, setPcm] = useState<PcmHit | null>(null);
  const [form, setForm] = useState({
    stateCode: "",
    ppaName: "",
    ppaAddress: "",
    lgiName: "",
    lgiPhone: "",
    ziName: "",
    ziPhone: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function download(type: "skills" | "special-status") {
    setError(null);
    const token = getAccessToken();
    const res = await fetch(`/api/registration/export?type=${type}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Export failed");
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download =
      type === "skills"
        ? "skilled-corps-members.csv"
        : "special-status-corps-members.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  async function search(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setMsg(null);
    setPcm(null);
    if (!q.trim()) return;
    setLoading(true);
    try {
      const res = await staffFetch(
        `/api/pcm?q=${encodeURIComponent(q.trim())}&callUp=${encodeURIComponent(q.trim())}`
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Search failed");
        return;
      }
      const list = (data.pcms ?? []) as PcmHit[];
      if (!list.length) {
        setError("No PCM found");
        return;
      }
      const hit =
        list.find((p) => p.callUpNumber.toLowerCase() === q.trim().toLowerCase()) ??
        list[0];
      // Load full record
      const det = await staffFetch(`/api/pcm/${hit.id}`);
      const full = await det.json();
      const p = (full.pcm ?? hit) as PcmHit;
      setPcm(p);
      setForm({
        stateCode: p.stateCode || "",
        ppaName: p.ppaName || "",
        ppaAddress: p.ppaAddress || "",
        lgiName: p.lgiName || "",
        lgiPhone: p.lgiPhone || "",
        ziName: p.ziName || "",
        ziPhone: p.ziPhone || "",
      });
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!pcm) return;
    setLoading(true);
    setError(null);
    setMsg(null);
    try {
      const res = await staffFetch(`/api/pcm/${pcm.id}/registration`, {
        method: "PATCH",
        body: JSON.stringify(form),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Save failed");
        return;
      }
      setMsg("Registration details saved");
      setPcm(data.pcm);
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <StaffShell>
      <h1 className="text-2xl font-bold text-slate-900">Registration Committee</h1>
      <p className="mt-1 text-sm text-slate-600">
        Export skilled / special-status lists. Capture PPA, LGI and ZI details not taken at
        security intake.
      </p>

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

      <div className="mt-6 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => void download("skills")}
          className="rounded-md bg-nysc-green px-4 py-2 text-sm font-semibold text-white"
        >
          Download skilled (CSV)
        </button>
        <button
          type="button"
          onClick={() => void download("special-status")}
          className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800"
        >
          Download special status (CSV)
        </button>
      </div>

      <form onSubmit={search} className="mt-8 flex flex-wrap gap-2">
        <input
          className="min-w-[220px] flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm"
          placeholder="Search call-up or name"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <button
          type="submit"
          disabled={loading}
          className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium"
        >
          {loading ? "…" : "Find PCM"}
        </button>
      </form>

      {pcm && (
        <form
          onSubmit={save}
          className="mt-6 grid gap-3 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:grid-cols-2"
        >
          <div className="sm:col-span-2">
            <p className="text-lg font-bold text-slate-900">{pcm.fullName}</p>
            <p className="font-mono text-sm text-slate-600">{pcm.callUpNumber}</p>
          </div>
          <div>
            <label className="text-xs font-semibold uppercase text-slate-500">State code</label>
            <input
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              value={form.stateCode}
              onChange={(e) => setForm({ ...form, stateCode: e.target.value })}
            />
          </div>
          <div>
            <label className="text-xs font-semibold uppercase text-slate-500">PPA name</label>
            <input
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              value={form.ppaName}
              onChange={(e) => setForm({ ...form, ppaName: e.target.value })}
            />
          </div>
          <div className="sm:col-span-2">
            <label className="text-xs font-semibold uppercase text-slate-500">PPA address</label>
            <textarea
              rows={2}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              value={form.ppaAddress}
              onChange={(e) => setForm({ ...form, ppaAddress: e.target.value })}
            />
          </div>
          <div>
            <label className="text-xs font-semibold uppercase text-slate-500">LGI name</label>
            <input
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              value={form.lgiName}
              onChange={(e) =>
                setForm({ ...form, lgiName: lettersOnly(e.target.value) })
              }
            />
          </div>
          <div>
            <label className="text-xs font-semibold uppercase text-slate-500">LGI phone</label>
            <input
              inputMode="tel"
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              value={form.lgiPhone}
              onChange={(e) =>
                setForm({ ...form, lgiPhone: phoneDigits(e.target.value) })
              }
            />
          </div>
          <div>
            <label className="text-xs font-semibold uppercase text-slate-500">ZI name</label>
            <input
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              value={form.ziName}
              onChange={(e) =>
                setForm({ ...form, ziName: lettersOnly(e.target.value) })
              }
            />
          </div>
          <div>
            <label className="text-xs font-semibold uppercase text-slate-500">ZI phone</label>
            <input
              inputMode="tel"
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              value={form.ziPhone}
              onChange={(e) =>
                setForm({ ...form, ziPhone: phoneDigits(e.target.value) })
              }
            />
          </div>
          <div className="sm:col-span-2">
            <button
              type="submit"
              disabled={loading}
              className="rounded-md bg-nysc-green px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              {loading ? "Saving…" : "Save registration details"}
            </button>
          </div>
        </form>
      )}
    </StaffShell>
  );
}
