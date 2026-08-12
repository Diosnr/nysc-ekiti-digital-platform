"use client";

import { FormEvent, useEffect, useState } from "react";
import { StaffShell } from "@/components/staff/StaffShell";
import { staffFetch } from "@/lib/staff-api";

type UserRow = {
  id: string;
  email: string;
  name: string | null;
  rank: string | null;
  post: string | null;
  lgaCode: string | null;
  zoneCode: string | null;
  isActive: boolean;
  roles: string[];
};

type RoleOption = { id: string; name: string };

export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [roles, setRoles] = useState<RoleOption[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    email: "",
    name: "",
    password: "",
    rank: "",
    post: "",
    lgaCode: "",
    zoneCode: "",
    roleIds: [] as string[],
  });

  async function load() {
    const [uRes, rRes] = await Promise.all([
      staffFetch("/api/admin/users"),
      staffFetch("/api/admin/roles"),
    ]);
    if (uRes.ok) {
      const data = await uRes.json();
      setUsers(data.users);
    } else if (uRes.status === 403) setError("You need user:read permission.");
    if (rRes.ok) {
      const data = await rRes.json();
      setRoles(data.roles.map((r: { id: string; name: string }) => ({ id: r.id, name: r.name })));
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setMsg(null);
    const res = await staffFetch("/api/admin/users", {
      method: "POST",
      body: JSON.stringify({
        email: form.email,
        name: form.name || null,
        password: form.password || null,
        rank: form.rank || null,
        post: form.post || null,
        lgaCode: form.lgaCode || null,
        zoneCode: form.zoneCode || null,
        roleIds: form.roleIds,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Create failed");
      return;
    }
    setMsg(`Created ${data.user.email}`);
    setOpen(false);
    setForm({
      email: "",
      name: "",
      password: "",
      rank: "",
      post: "",
      lgaCode: "",
      zoneCode: "",
      roleIds: [],
    });
    load();
  }

  function toggleRole(id: string) {
    setForm((f) => ({
      ...f,
      roleIds: f.roleIds.includes(id)
        ? f.roleIds.filter((x) => x !== id)
        : [...f.roleIds, id],
    }));
  }

  return (
    <StaffShell>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Users / Officers</h1>
          <p className="mt-1 text-sm text-slate-600">
            Create officers, assign roles, set LGA/zone scope fields.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="rounded-md bg-nysc-green px-3 py-2 text-sm font-semibold text-white hover:bg-nysc-green-light"
        >
          {open ? "Close" : "Add user"}
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
          <input
            required
            type="email"
            placeholder="Email"
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
          <input
            type="text"
            placeholder="Full name"
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
          <input
            type="password"
            placeholder="Temporary password"
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
          />
          <input
            type="text"
            placeholder="Rank"
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
            value={form.rank}
            onChange={(e) => setForm({ ...form, rank: e.target.value })}
          />
          <input
            type="text"
            placeholder="Post"
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
            value={form.post}
            onChange={(e) => setForm({ ...form, post: e.target.value })}
          />
          <input
            type="text"
            placeholder="LGA code (for LGI scope)"
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
            value={form.lgaCode}
            onChange={(e) => setForm({ ...form, lgaCode: e.target.value })}
          />
          <input
            type="text"
            placeholder="Zone code (for ZI scope)"
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
            value={form.zoneCode}
            onChange={(e) => setForm({ ...form, zoneCode: e.target.value })}
          />
          <div className="sm:col-span-2">
            <p className="mb-2 text-sm font-medium text-slate-700">Roles</p>
            <div className="flex flex-wrap gap-2">
              {roles.map((r) => (
                <label
                  key={r.id}
                  className="flex items-center gap-1.5 rounded-full border border-slate-200 px-3 py-1 text-xs"
                >
                  <input
                    type="checkbox"
                    checked={form.roleIds.includes(r.id)}
                    onChange={() => toggleRole(r.id)}
                  />
                  {r.name}
                </label>
              ))}
            </div>
          </div>
          <div className="sm:col-span-2">
            <button
              type="submit"
              className="rounded-md bg-nysc-green px-4 py-2 text-sm font-semibold text-white"
            >
              Create user
            </button>
          </div>
        </form>
      )}

      <div className="mt-8 overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Roles</th>
              <th className="px-4 py-3">Scope</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-b border-slate-100">
                <td className="px-4 py-3 font-medium text-slate-900">{u.email}</td>
                <td className="px-4 py-3 text-slate-600">{u.name ?? "—"}</td>
                <td className="px-4 py-3 text-slate-600">{u.roles.join(", ") || "—"}</td>
                <td className="px-4 py-3 text-slate-600">
                  {[u.lgaCode && `LGA ${u.lgaCode}`, u.zoneCode && `Zone ${u.zoneCode}`]
                    .filter(Boolean)
                    .join(" · ") || "—"}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      u.isActive ? "bg-green-50 text-green-800" : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {u.isActive ? "Active" : "Inactive"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </StaffShell>
  );
}
