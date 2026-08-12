"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { clearTokens, getAccessToken, staffFetch } from "@/lib/staff-api";

type Me = {
  user: { name: string | null; email: string };
  roles: string[];
  permissions: string[];
};

const nav = [
  { href: "/staff/dashboard", label: "Dashboard", perm: null },
  { href: "/staff/admin/users", label: "Users", perm: "user:read" },
  { href: "/staff/admin/roles", label: "Roles", perm: "role:read" },
  { href: "/staff/admin/audit", label: "Audit log", perm: "audit:read" },
];

export function StaffShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);

  useEffect(() => {
    if (!getAccessToken()) {
      router.replace("/staff/login");
      return;
    }
    staffFetch("/api/auth/me")
      .then(async (res) => {
        if (!res.ok) return;
        setMe(await res.json());
      })
      .catch(() => router.replace("/staff/login"));
  }, [router]);

  function logout() {
    const refresh = localStorage.getItem("nysc_refresh_token");
    staffFetch("/api/auth/logout", {
      method: "POST",
      body: JSON.stringify({ refreshToken: refresh }),
    }).finally(() => {
      clearTokens();
      router.replace("/staff/login");
    });
  }

  const perms = me?.permissions ?? [];
  const can = (p: string | null) => !p || perms.includes(p) || perms.includes("*");

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-6">
            <Link href="/staff/dashboard" className="font-semibold text-nysc-green">
              NYSC Ekiti · Staff
            </Link>
            <nav className="hidden gap-1 sm:flex">
              {nav.filter((n) => can(n.perm)).map((n) => (
                <Link
                  key={n.href}
                  href={n.href}
                  className={`rounded-md px-3 py-1.5 text-sm font-medium ${
                    pathname.startsWith(n.href)
                      ? "bg-green-50 text-nysc-green"
                      : "text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  {n.label}
                </Link>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <span className="hidden text-slate-600 sm:inline">
              {me ? me.user.name || me.user.email : "…"}
            </span>
            <button
              type="button"
              onClick={logout}
              className="rounded-md border border-slate-300 px-2.5 py-1 text-slate-700 hover:bg-slate-50"
            >
              Logout
            </button>
          </div>
        </div>
      </header>
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">{children}</div>
    </div>
  );
}
