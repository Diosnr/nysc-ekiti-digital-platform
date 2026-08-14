"use client";

import { FormEvent, useEffect, useState } from "react";
import { StaffShell } from "@/components/staff/StaffShell";
import { staffFetch } from "@/lib/staff-api";
import { EKITI_LGAS, NIGERIA_STATES } from "@/lib/nigeria";

type Row = {
  id: string;
  name: string;
  lga: string | null;
  state: string | null;
  isActive: boolean;
  sortOrder: number;
};

export default function CommunitiesAdminPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    state: "Ekiti",
    lga: "",
    sortOrder: "0",
  });

  async function load() {
    setError(null);
    const res = await staffFetch("/api/communities?all=1");
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error ?? "Need community:manage permission");
      return;
    }
    setRows(data.communities ?? []);
  }

  useEffect(() => {
    load();
  }, []);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setMsg(null);
    const res = await staffFetch("/api/communities", {
      method: "POST",
      body: JSON.stringify({
        name: form.name,
        state: form.state,
        lga: form.lga || null,
        sortOrder: Number(form.sortOrder) || 0,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error ?? "Create failed");
      return;
    }
    setMsg(`Created: ${data.community.name}`);
    setForm({ name: "", state: "Ekiti", lga: "", sortOrder: "0" });
    load();
  }

  async function onDelete(id: string, name: string) {
    if (!confirm(`Delete community “${name}”?`)) return;
    const res = await staffFetch(`/api/communities/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Delete failed");
      return;
    }
    load();
  }

  return (
    <StaffShell>
      <h1 className="text-2xl font-bold text-slate-900">Communities</h1>
      <p className="mt-1 text-sm text-slate-600">
        Used in the Ekiti Married Women form community dropdown.
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
        className="mt-6 grid gap-3 rounded-xl border border-slate-200 bg-white p-6 shadow-sm sm:grid-cols-2"
      >
        <div className="sm:col-span-2">
          <label className="text-xs font-semibold uppercase text-slate-500">Name *</label>
          <input
            required
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Town / community name"
          />
        </div>
        <div>
          <label className="text-xs font-semibold uppercase text-slate-500">State</label>
          <select
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            value={form.state}
            onChange={(e) => setForm({ ...form, state: e.target.value, lga: "" })}
          >
            {NIGERIA_STATES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs font-semibold uppercase text-slate-500">LGA</label>
          {form.state === "Ekiti" ? (
            <select
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              value={form.lga}
              onChange={(e) => setForm({ ...form, lga: e.target.value })}
            >
              <option value="">—</option>
              {EKITI_LGAS.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>
          ) : (
            <input
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              value={form.lga}
              onChange={(e) => setForm({ ...form, lga: e.target.value })}
            />
          )}
        </div>
        <div className="sm:col-span-2">
          <button
            type="submit"
            className="rounded-md bg-nysc-green px-4 py-2 text-sm font-semibold text-white"
          >
            Add community
          </button>
        </div>
      </form>

      <div className="mt-8 overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">LGA</th>
              <th className="px-4 py-3">State</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-slate-500">
                  No communities yet.
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-slate-100">
                <td className="px-4 py-3 font-medium">{r.name}</td>
                <td className="px-4 py-3">{r.lga || "—"}</td>
                <td className="px-4 py-3">{r.state || "—"}</td>
                <td className="px-4 py-3">
                  <button
                    type="button"
                    onClick={() => void onDelete(r.id, r.name)}
                    className="text-xs font-medium text-red-600 hover:underline"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </StaffShell>
  );
}
