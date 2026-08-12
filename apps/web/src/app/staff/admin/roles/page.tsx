"use client";

import { FormEvent, useEffect, useState } from "react";
import { StaffShell } from "@/components/staff/StaffShell";
import { staffFetch } from "@/lib/staff-api";

type RoleRow = {
  id: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  isActive: boolean;
  userCount: number;
  permissions: string[];
};

type Perm = { id: string; key: string; description: string | null; module: string | null };

export default function AdminRolesPage() {
  const [roles, setRoles] = useState<RoleRow[]>([]);
  const [permissions, setPermissions] = useState<Perm[]>([]);
  const [selected, setSelected] = useState<RoleRow | null>(null);
  const [selectedPerms, setSelectedPerms] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");

  async function load() {
    const [rRes, pRes] = await Promise.all([
      staffFetch("/api/admin/roles"),
      staffFetch("/api/admin/permissions"),
    ]);
    if (rRes.ok) {
      const data = await rRes.json();
      setRoles(data.roles);
    } else if (rRes.status === 403) setError("You need role:read permission.");
    if (pRes.ok) {
      const data = await pRes.json();
      setPermissions(data.permissions);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function selectRole(r: RoleRow) {
    setSelected(r);
    setSelectedPerms([...r.permissions]);
    setMsg(null);
    setError(null);
  }

  function togglePerm(key: string) {
    setSelectedPerms((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  }

  async function savePermissions() {
    if (!selected) return;
    setError(null);
    setMsg(null);
    const res = await staffFetch(`/api/admin/roles/${selected.id}/permissions`, {
      method: "PUT",
      body: JSON.stringify({ permissions: selectedPerms }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Failed to save permissions");
      return;
    }
    setMsg(`Permissions updated for ${selected.name}`);
    await load();
  }

  async function createRole(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setMsg(null);
    const res = await staffFetch("/api/admin/roles", {
      method: "POST",
      body: JSON.stringify({ name: newName, description: newDesc || null }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Create failed");
      return;
    }
    setMsg(`Role created: ${data.role.name}`);
    setNewName("");
    setNewDesc("");
    load();
  }

  const modules = Array.from(new Set(permissions.map((p) => p.module || "other"))).sort();

  return (
    <StaffShell>
      <h1 className="text-2xl font-bold text-slate-900">Roles & permissions</h1>
      <p className="mt-1 text-sm text-slate-600">
        Dynamic RBAC — create roles and map any permission set. Super Admin is a system role.
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

      <div className="mt-8 grid gap-6 lg:grid-cols-5">
        <div className="lg:col-span-2 space-y-4">
          <form
            onSubmit={createRole}
            className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-2"
          >
            <p className="text-sm font-semibold text-slate-900">Create role</p>
            <input
              required
              placeholder="Role name"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
            />
            <input
              placeholder="Description"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
            />
            <button
              type="submit"
              className="rounded-md bg-nysc-green px-3 py-2 text-sm font-semibold text-white"
            >
              Create
            </button>
          </form>

          <ul className="rounded-xl border border-slate-200 bg-white shadow-sm divide-y divide-slate-100">
            {roles.map((r) => (
              <li key={r.id}>
                <button
                  type="button"
                  onClick={() => selectRole(r)}
                  className={`w-full px-4 py-3 text-left hover:bg-slate-50 ${
                    selected?.id === r.id ? "bg-green-50" : ""
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-slate-900">{r.name}</span>
                    {r.isSystem && (
                      <span className="text-[10px] font-semibold uppercase text-amber-700">
                        System
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500">
                    {r.permissions.length} perms · {r.userCount} users
                  </p>
                </button>
              </li>
            ))}
          </ul>
        </div>

        <div className="lg:col-span-3 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          {!selected ? (
            <p className="text-sm text-slate-500">Select a role to edit its permissions.</p>
          ) : (
            <>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">{selected.name}</h2>
                  <p className="text-sm text-slate-600">{selected.description || "No description"}</p>
                </div>
                <button
                  type="button"
                  onClick={savePermissions}
                  className="rounded-md bg-nysc-green px-3 py-2 text-sm font-semibold text-white"
                >
                  Save permissions
                </button>
              </div>

              <div className="mt-6 space-y-6 max-h-[60vh] overflow-y-auto pr-1">
                {modules.map((mod) => (
                  <div key={mod}>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
                      {mod}
                    </p>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {permissions
                        .filter((p) => (p.module || "other") === mod)
                        .map((p) => (
                          <label
                            key={p.key}
                            className="flex items-start gap-2 rounded-md border border-slate-100 px-2 py-1.5 text-sm hover:bg-slate-50"
                          >
                            <input
                              type="checkbox"
                              className="mt-1"
                              checked={selectedPerms.includes(p.key)}
                              onChange={() => togglePerm(p.key)}
                            />
                            <span>
                              <span className="font-mono text-xs text-slate-800">{p.key}</span>
                              {p.description && (
                                <span className="block text-xs text-slate-500">{p.description}</span>
                              )}
                            </span>
                          </label>
                        ))}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </StaffShell>
  );
}
