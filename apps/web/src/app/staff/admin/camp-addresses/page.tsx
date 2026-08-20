"use client";

import { FormEvent, useEffect, useState } from "react";
import { StaffShell } from "@/components/staff/StaffShell";
import { staffFetch } from "@/lib/staff-api";
import { NIGERIA_STATES } from "@/lib/nigeria";

type Row = {
  id: string;
  name: string;
  address: string;
  state: string | null;
  lga: string | null;
  isActive: boolean;
  sortOrder: number;
  notes: string | null;
};

const emptyForm = {
  name: "",
  address: "",
  state: "Ekiti",
  lga: "",
  sortOrder: "0",
  notes: "",
};

export default function CampAddressesAdminPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [lgas, setLgas] = useState<string[]>([]);

  async function load() {
    setError(null);
    const res = await staffFetch("/api/camp-addresses?all=1");
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error ?? "Failed to load (need camp:address:manage)");
      return;
    }
    setRows(data.campAddresses ?? []);
  }

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    const state = form.state.trim();
    if (!state) {
      setLgas([]);
      return;
    }

    let cancelled = false;
    setLgas([]);
    fetch(`/api/geo/lgas?state=${encodeURIComponent(state)}`)
      .then(async (res) => {
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled) setLgas(data.lgas ?? []);
      })
      .catch(() => {
        if (!cancelled) setLgas([]);
      });

    return () => {
      cancelled = true;
    };
  }, [form.state]);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setMsg(null);
    const res = await staffFetch("/api/camp-addresses", {
      method: "POST",
      body: JSON.stringify({
        name: form.name,
        address: form.address,
        state: form.state || null,
        lga: form.lga || null,
        sortOrder: Number(form.sortOrder) || 0,
        notes: form.notes || null,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error ?? "Create failed");
      return;
    }
    setMsg(`Created: ${data.campAddress.name}`);
    setForm(emptyForm);
    setOpen(false);
    load();
  }

  async function toggleActive(row: Row) {
    setError(null);
    const res = await staffFetch(`/api/camp-addresses/${row.id}`, {
      method: "PATCH",
      body: JSON.stringify({ isActive: !row.isActive }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Update failed");
      return;
    }
    load();
  }

  return (
    <StaffShell>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Camp addresses</h1>
          <p className="mt-1 text-sm text-slate-600">
            Manage orientation camp locations. Active ones appear in PCM intake dropdowns.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="rounded-md bg-nysc-green px-3 py-2 text-sm font-semibold text-white"
        >
          {open ? "Close" : "Add camp address"}
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
          onSubmit={onCreate}
          className="mt-6 grid gap-3 rounded-xl border border-slate-200 bg-white p-6 shadow-sm sm:grid-cols-2"
        >
          <div className="sm:col-span-2">
            <label className="text-xs font-semibold uppercase text-slate-500">Name *</label>
            <input
              required
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              placeholder="e.g. Ekiti Orientation Camp"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>
          <div className="sm:col-span-2">
            <label className="text-xs font-semibold uppercase text-slate-500">Full address *</label>
            <textarea
              required
              rows={3}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              placeholder="Street, town, landmarks…"
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
            />
          </div>
          <div>
            <label className="text-xs font-semibold uppercase text-slate-500">State</label>
            <select
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              value={form.state}
              onChange={(e) => setForm({ ...form, state: e.target.value, lga: "" })}
            >
              <option value="">—</option>
              {NIGERIA_STATES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold uppercase text-slate-500">LGA</label>
            <select
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              value={form.lga}
              onChange={(e) => setForm({ ...form, lga: e.target.value })}
              disabled={!form.state || lgas.length === 0}
            >
              <option value="">{form.state ? "Select LGA" : "Select state first"}</option>
              {lgas.map((lga) => (
                <option key={lga} value={lga}>
                  {lga}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold uppercase text-slate-500">Sort order</label>
            <input
              type="number"
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              value={form.sortOrder}
              onChange={(e) => setForm({ ...form, sortOrder: e.target.value })}
            />
          </div>
          <div className="sm:col-span-2">
            <label className="text-xs font-semibold uppercase text-slate-500">Notes</label>
            <input
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </div>
          <div className="sm:col-span-2">
            <button
              type="submit"
              className="rounded-md bg-nysc-green px-4 py-2 text-sm font-semibold text-white"
            >
              Save camp address
            </button>
          </div>
        </form>
      )}

      <div className="mt-8 overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Address</th>
              <th className="px-4 py-3">State / LGA</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                  No camp addresses yet. Add the Ekiti orientation camp first.
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-slate-100">
                <td className="px-4 py-3 font-medium">{r.name}</td>
                <td className="max-w-xs px-4 py-3 text-slate-600">{r.address}</td>
                <td className="px-4 py-3 text-slate-600">
                  {[r.state, r.lga].filter(Boolean).join(" / ") || "—"}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      r.isActive
                        ? "bg-green-50 text-green-800"
                        : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {r.isActive ? "Active" : "Inactive"}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <button
                    type="button"
                    onClick={() => void toggleActive(r)}
                    className="text-xs font-medium text-nysc-green hover:underline"
                  >
                    {r.isActive ? "Deactivate" : "Activate"}
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
