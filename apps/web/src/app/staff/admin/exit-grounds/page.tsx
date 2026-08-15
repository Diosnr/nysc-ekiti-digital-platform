"use client";

import { FormEvent, useEffect, useState } from "react";
import { StaffShell } from "@/components/staff/StaffShell";
import { staffFetch } from "@/lib/staff-api";

type Ground = {
  id: string;
  code: string;
  label: string;
  requiresClinic: boolean;
  isActive: boolean;
  sortOrder?: number;
};

export default function ExitGroundsAdminPage() {
  const [items, setItems] = useState<Ground[]>([]);
  const [code, setCode] = useState("");
  const [label, setLabel] = useState("");
  const [requiresClinic, setRequiresClinic] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function load() {
    const res = await staffFetch("/api/exit-grounds");
    if (res.ok) {
      const data = await res.json();
      setItems(data.items ?? []);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMsg(null);
    try {
      const res = await staffFetch("/api/exit-grounds", {
        method: "POST",
        body: JSON.stringify({ code, label, requiresClinic }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Create failed");
        return;
      }
      setMsg("Ground added");
      setCode("");
      setLabel("");
      setRequiresClinic(false);
      void load();
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  async function toggleActive(g: Ground) {
    await staffFetch("/api/exit-grounds", {
      method: "PATCH",
      body: JSON.stringify({ id: g.id, isActive: !g.isActive }),
    });
    void load();
  }

  async function remove(id: string) {
    if (!confirm("Delete this ground? Prefer deactivating if it was used.")) return;
    await staffFetch(`/api/exit-grounds?id=${id}`, { method: "DELETE" });
    void load();
  }

  return (
    <StaffShell>
      <h1 className="text-2xl font-bold text-slate-900">Exit grounds</h1>
      <p className="mt-1 text-sm text-slate-600">
        Options used when opening a camp-exit file on E-Filing. Medical grounds route via clinic.
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

      <form
        onSubmit={onCreate}
        className="mt-6 max-w-lg space-y-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
      >
        <div>
          <label className="text-xs font-semibold uppercase text-slate-500">Code</label>
          <input
            required
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm font-mono uppercase"
            placeholder="e.g. COMPASSIONATE"
            value={code}
            onChange={(e) => setCode(e.target.value)}
          />
        </div>
        <div>
          <label className="text-xs font-semibold uppercase text-slate-500">Label</label>
          <input
            required
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            placeholder="Shown on forms"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
          />
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={requiresClinic}
            onChange={(e) => setRequiresClinic(e.target.checked)}
          />
          Requires clinic stage
        </label>
        <button
          type="submit"
          disabled={loading}
          className="rounded-md bg-nysc-green px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {loading ? "Saving…" : "Add ground"}
        </button>
      </form>

      <ul className="mt-8 max-w-lg divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white">
        {items.map((g) => (
          <li key={g.id} className="flex items-center gap-3 px-4 py-3">
            <div className="min-w-0 flex-1">
              <p className="font-medium text-slate-900">{g.label}</p>
              <p className="font-mono text-xs text-slate-500">
                {g.code}
                {g.requiresClinic ? " · clinic" : ""}
                {!g.isActive ? " · inactive" : ""}
              </p>
            </div>
            <button
              type="button"
              onClick={() => void toggleActive(g)}
              className="text-xs font-medium text-slate-600 hover:underline"
            >
              {g.isActive ? "Deactivate" : "Activate"}
            </button>
            <button
              type="button"
              onClick={() => void remove(g.id)}
              className="text-xs font-medium text-red-600 hover:underline"
            >
              Delete
            </button>
          </li>
        ))}
      </ul>
    </StaffShell>
  );
}
