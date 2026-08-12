"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { StaffShell } from "@/components/staff/StaffShell";
import { staffFetch } from "@/lib/staff-api";

type Me = {
  user: { name: string | null; email: string; post: string | null };
  roles: string[];
  permissions: string[];
};

export default function StaffDashboardPage() {
  const [me, setMe] = useState<Me | null>(null);

  useEffect(() => {
    staffFetch("/api/auth/me").then(async (res) => {
      if (res.ok) setMe(await res.json());
    });
  }, []);

  return (
    <StaffShell>
      {!me ? (
        <p className="text-slate-600">Loading…</p>
      ) : (
        <>
          <h1 className="text-2xl font-bold text-slate-900">
            Welcome, {me.user.name || me.user.email}
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Roles: {me.roles.join(", ") || "None"}
            {me.user.post ? ` · ${me.user.post}` : ""}
          </p>

          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Permissions
              </p>
              <p className="mt-2 text-2xl font-bold">{me.permissions.length}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Pending files
              </p>
              <p className="mt-2 text-2xl font-bold text-slate-400">—</p>
              <p className="text-xs text-slate-500">Phase 6</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Admin</p>
              <div className="mt-3 flex flex-col gap-1 text-sm">
                {me.permissions.includes("user:read") && (
                  <Link href="/staff/admin/users" className="text-nysc-green hover:underline">
                    Manage users →
                  </Link>
                )}
                {me.permissions.includes("role:read") && (
                  <Link href="/staff/admin/roles" className="text-nysc-green hover:underline">
                    Manage roles →
                  </Link>
                )}
                {me.permissions.includes("audit:read") && (
                  <Link href="/staff/admin/audit" className="text-nysc-green hover:underline">
                    Audit log →
                  </Link>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </StaffShell>
  );
}
