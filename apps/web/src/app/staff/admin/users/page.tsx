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
  platoonCode: string | null;
  isActive: boolean;
  hasPassword?: boolean;
  roles: string[];
};

type RoleOption = { id: string; name: string };

const PLATOON_OPTIONS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"];

function isPlatoonRoleName(name: string) {
  const x = name.toLowerCase();
  return x.includes("platoon officer") && !x.includes("head");
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [roles, setRoles] = useState<RoleOption[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editPlatoon, setEditPlatoon] = useState("");
  const [canDelete, setCanDelete] = useState(false);
  const [form, setForm] = useState({
    email: "",
    name: "",
    password: "",
    rank: "",
    post: "",
    lgaCode: "",
    zoneCode: "",
    platoonCode: "",
    roleIds: [] as string[],
  });

  const selectedRoleNames = roles
    .filter((r) => form.roleIds.includes(r.id))
    .map((r) => r.name);
  const needsPlatoon = selectedRoleNames.some(isPlatoonRoleName);

  async function load() {
    const [uRes, rRes, meRes] = await Promise.all([
      staffFetch("/api/admin/users"),
      staffFetch("/api/admin/roles"),
      staffFetch("/api/auth/me"),
    ]);
    if (uRes.ok) {
      const data = await uRes.json();
      setUsers(data.users);
    } else if (uRes.status === 403) setError("You need user:read permission.");
    if (rRes.ok) {
      const data = await rRes.json();
      setRoles(data.roles.map((r: { id: string; name: string }) => ({ id: r.id, name: r.name })));
    }
    if (meRes.ok) {
      const me = await meRes.json();
      const perms: string[] = me.permissions ?? [];
      const roleNames: string[] = me.roles ?? [];
      setCanDelete(
        perms.includes("*") ||
          perms.includes("user:deactivate") ||
          roleNames.includes("Super Admin")
      );
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setMsg(null);
    if (needsPlatoon && !form.platoonCode) {
      setError("Select platoon 1–10 for Platoon Officer");
      return;
    }
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
        platoonCode: form.platoonCode || null,
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
      platoonCode: "",
      roleIds: [],
    });
    load();
  }

  async function savePlatoon(userId: string) {
    setError(null);
    setMsg(null);
    if (!editPlatoon || !/^(10|[1-9])$/.test(editPlatoon)) {
      setError("Platoon must be 1–10");
      return;
    }
    const res = await staffFetch(`/api/admin/users/${userId}`, {
      method: "PATCH",
      body: JSON.stringify({ platoonCode: editPlatoon }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error ?? "Update failed");
      return;
    }
    setMsg(`Platoon updated to ${editPlatoon}`);
    setEditId(null);
    load();
  }

  async function issueLink(userId: string, email: string, hasPassword: boolean) {
    setError(null);
    setMsg(null);
    const res = await staffFetch(`/api/admin/users/${userId}/activate`, { method: "POST" });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Could not issue link");
      return;
    }
    const url = data.url || data.resetUrl || data.activationUrl;
    const label = hasPassword || data.mode === "reset" ? "Reset link" : "Activation link";
    setMsg(`${label} for ${email}: ${url}`);
    try {
      await navigator.clipboard.writeText(url);
      setMsg((m) => `${m} (copied to clipboard)`);
    } catch {
      /* ignore */
    }
  }

  async function deleteUser(u: UserRow) {
    if (
      !confirm(
        `Delete user permanently?\n\n${u.email}\n${u.name || ""}\n\nThis cannot be undone.`
      )
    ) {
      return;
    }
    setError(null);
    setMsg(null);
    const res = await staffFetch(`/api/admin/users/${u.id}`, { method: "DELETE" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error ?? "Delete failed");
      return;
    }
    setMsg(`Deleted ${u.email}`);
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
            Platoon Officers require a platoon number (1–10). After a password is set, links become
            reset links.
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
        <p className="mt-4 break-all rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">
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
            placeholder="Optional temp password (or use activation link)"
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
            placeholder="LGA code (LGI scope)"
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
            value={form.lgaCode}
            onChange={(e) => setForm({ ...form, lgaCode: e.target.value })}
          />
          <input
            type="text"
            placeholder="Zone code (ZI scope)"
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
            value={form.zoneCode}
            onChange={(e) => setForm({ ...form, zoneCode: e.target.value })}
          />
          {needsPlatoon && (
            <div>
              <label className="text-xs font-semibold uppercase text-slate-500">
                Platoon number *
              </label>
              <select
                required
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                value={form.platoonCode}
                onChange={(e) => setForm({ ...form, platoonCode: e.target.value })}
              >
                <option value="">Select 1–10…</option>
                {PLATOON_OPTIONS.map((p) => (
                  <option key={p} value={p}>
                    Platoon {p}
                  </option>
                ))}
              </select>
            </div>
          )}
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
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => {
              const isPlatoon = u.roles.some(isPlatoonRoleName);
              const hasPw = Boolean(u.hasPassword);
              return (
                <tr key={u.id} className="border-b border-slate-100">
                  <td className="px-4 py-3 font-medium text-slate-900">{u.email}</td>
                  <td className="px-4 py-3 text-slate-600">{u.name ?? "—"}</td>
                  <td className="px-4 py-3 text-slate-600">{u.roles.join(", ") || "—"}</td>
                  <td className="px-4 py-3 text-slate-600">
                    {[
                      u.platoonCode && `Platoon ${u.platoonCode}`,
                      u.lgaCode && `LGA ${u.lgaCode}`,
                      u.zoneCode && `Zone ${u.zoneCode}`,
                    ]
                      .filter(Boolean)
                      .join(" · ") || "—"}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        u.isActive
                          ? "bg-green-50 text-green-800"
                          : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {u.isActive ? "Active" : "Inactive"}
                    </span>
                    {hasPw ? (
                      <span className="ml-1 text-[10px] text-slate-400">password set</span>
                    ) : (
                      <span className="ml-1 text-[10px] text-amber-600">no password</span>
                    )}
                  </td>
                  <td className="px-4 py-3 space-x-2 whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => void issueLink(u.id, u.email, hasPw)}
                      className="text-xs font-medium text-nysc-green hover:underline"
                    >
                      {hasPw ? "Reset link" : "Activation link"}
                    </button>
                    {isPlatoon && (
                      <>
                        {editId === u.id ? (
                          <span className="inline-flex items-center gap-1">
                            <select
                              className="rounded border border-slate-300 text-xs"
                              value={editPlatoon}
                              onChange={(e) => setEditPlatoon(e.target.value)}
                            >
                              {PLATOON_OPTIONS.map((p) => (
                                <option key={p} value={p}>
                                  {p}
                                </option>
                              ))}
                            </select>
                            <button
                              type="button"
                              className="text-xs font-semibold text-nysc-green"
                              onClick={() => void savePlatoon(u.id)}
                            >
                              Save
                            </button>
                            <button
                              type="button"
                              className="text-xs text-slate-500"
                              onClick={() => setEditId(null)}
                            >
                              Cancel
                            </button>
                          </span>
                        ) : (
                          <button
                            type="button"
                            className="text-xs font-medium text-slate-700 hover:underline"
                            onClick={() => {
                              setEditId(u.id);
                              setEditPlatoon(u.platoonCode || "1");
                            }}
                          >
                            Edit platoon
                          </button>
                        )}
                      </>
                    )}
                    {canDelete && (
                      <button
                        type="button"
                        onClick={() => void deleteUser(u)}
                        className="text-xs font-medium text-red-600 hover:underline"
                      >
                        Delete
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </StaffShell>
  );
}
