"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { StaffShell } from "@/components/staff/StaffShell";
import { staffFetch } from "@/lib/staff-api";

type Me = {
  user: { name: string | null; email: string; post: string | null };
  roles: string[];
  permissions: string[];
};

export default function StaffDashboardPage() {
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);

  useEffect(() => {
    staffFetch("/api/auth/me").then(async (res) => {
      if (!res.ok) return;
      const data = (await res.json()) as Me;
      setMe(data);
      // Security-focused roles go straight to gate — no stub dashboard
      const roles = data.roles ?? [];
      const isSecurity =
        roles.includes("Security Officer") && !roles.includes("Super Admin");
      if (isSecurity) {
        router.replace("/staff/security/checkin");
      }
    });
  }, [router]);

  if (!me) {
    return (
      <StaffShell>
        <p className="text-slate-600">Loading…</p>
      </StaffShell>
    );
  }

  if (
    me.roles.includes("Security Officer") &&
    !me.roles.includes("Super Admin")
  ) {
    return (
      <StaffShell>
        <p className="text-slate-600">Opening security gate…</p>
      </StaffShell>
    );
  }

  return (
    <StaffShell>
      <h1 className="text-2xl font-bold text-slate-900">
        Welcome, {me.user.name || me.user.email}
      </h1>
      <p className="mt-1 text-sm text-slate-600">
        Roles: {me.roles.join(", ") || "None"}
        {me.user.post ? ` · ${me.user.post}` : ""}
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {me.permissions.includes("pcm:create") && (
          <Link
            href="/staff/pcm/intake"
            className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm hover:border-nysc-green/40"
          >
            <p className="font-semibold text-slate-900">PCM Intake</p>
            <p className="mt-1 text-sm text-slate-600">Scan or register call-up letters</p>
          </Link>
        )}
        {me.permissions.includes("pcm:read") && (
          <Link
            href="/staff/pcm"
            className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm hover:border-nysc-green/40"
          >
            <p className="font-semibold text-slate-900">PCM Registry</p>
            <p className="mt-1 text-sm text-slate-600">Search verified records</p>
          </Link>
        )}
        {me.permissions.includes("security:checkin") && (
          <Link
            href="/staff/security/checkin"
            className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm hover:border-nysc-green/40"
          >
            <p className="font-semibold text-slate-900">Security gate</p>
            <p className="mt-1 text-sm text-slate-600">Check-in and check-out</p>
          </Link>
        )}
        {me.permissions.includes("user:read") && (
          <Link
            href="/staff/admin/users"
            className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm hover:border-nysc-green/40"
          >
            <p className="font-semibold text-slate-900">Users</p>
            <p className="mt-1 text-sm text-slate-600">Officers and activation</p>
          </Link>
        )}
        {me.permissions.includes("camp:address:manage") && (
          <Link
            href="/staff/admin/camp-addresses"
            className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm hover:border-nysc-green/40"
          >
            <p className="font-semibold text-slate-900">Camp addresses</p>
            <p className="mt-1 text-sm text-slate-600">Manage orientation camps</p>
          </Link>
        )}
      </div>
    </StaffShell>
  );
}
