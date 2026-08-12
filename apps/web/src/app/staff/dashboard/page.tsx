"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type MeResponse = {
  user: { id: string; email: string; name: string | null; post: string | null };
  roles: string[];
  permissions: string[];
};

export default function StaffDashboardPage() {
  const router = useRouter();
  const [me, setMe] = useState<MeResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = localStorage.getItem("nysc_access_token");
    if (!token) {
      router.replace("/staff/login");
      return;
    }
    fetch("/api/auth/me", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(async (res) => {
        if (!res.ok) {
          localStorage.removeItem("nysc_access_token");
          localStorage.removeItem("nysc_refresh_token");
          router.replace("/staff/login");
          return;
        }
        setMe(await res.json());
      })
      .catch(() => setError("Could not load session. Is the API and database running?"));
  }, [router]);

  async function logout() {
    const access = localStorage.getItem("nysc_access_token");
    const refresh = localStorage.getItem("nysc_refresh_token");
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(access ? { Authorization: `Bearer ${access}` } : {}),
        },
        body: JSON.stringify({ refreshToken: refresh }),
      });
    } catch {
      /* ignore */
    }
    localStorage.removeItem("nysc_access_token");
    localStorage.removeItem("nysc_refresh_token");
    router.replace("/staff/login");
  }

  if (error) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-16">
        <p className="text-red-600">{error}</p>
        <Link href="/staff/login" className="mt-4 inline-block text-nysc-green">
          Back to login
        </Link>
      </main>
    );
  }

  if (!me) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-16">
        <p className="text-slate-600">Loading session…</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-nysc-green">Staff dashboard</p>
          <h1 className="mt-1 text-3xl font-bold text-slate-900">
            Welcome, {me.user.name || me.user.email}
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            Roles: {me.roles.join(", ") || "None"}
            {me.user.post ? ` · ${me.user.post}` : ""}
          </p>
        </div>
        <button
          type="button"
          onClick={logout}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Logout
        </button>
      </div>

      <div className="mt-10 grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Pending files
          </p>
          <p className="mt-2 text-2xl font-bold text-slate-900">—</p>
          <p className="mt-1 text-xs text-slate-500">Electronic file movement in Phase 6</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Permissions
          </p>
          <p className="mt-2 text-2xl font-bold text-slate-900">{me.permissions.length}</p>
          <p className="mt-1 text-xs text-slate-500">Granted via your roles</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Modules</p>
          <p className="mt-2 text-sm text-slate-600">
            Camp ops & file movement unlock in later phases.
          </p>
        </div>
      </div>

      <div className="mt-10 rounded-xl border border-slate-200 bg-slate-50 p-6">
        <h2 className="font-semibold text-slate-900">Phase 2 status</h2>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-slate-600">
          <li>Authenticated session via JWT</li>
          <li>Dynamic RBAC permissions loaded on login</li>
          <li>Admin APIs: users, roles, permissions, audit (permission-gated)</li>
          <li>Next: officer activation, role UI, LGA/zone scope helpers</li>
        </ul>
      </div>
    </main>
  );
}
