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
  { href: "/staff/security/checkin", label: "Security check-in", perm: "security:checkin" },
  { href: "/staff/pcm/intake", label: "PCM Intake", perm: "pcm:create" },
  { href: "/staff/pcm", label: "PCM Registry", perm: "pcm:read" },
  { href: "/staff/admin/camp-addresses", label: "Camp addresses", perm: "camp:address:manage" },
  { href: "/staff/admin/users", label: "Users", perm: "user:read" },
  { href: "/staff/admin/roles", label: "Roles", perm: "role:read" },
  { href: "/staff/admin/audit", label: "Audit log", perm: "audit:read" },
];

export function StaffShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);

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
  const can = (p: string | null) =>
    !p ||
    perms.includes(p) ||
    (p === "pcm:create" && perms.includes("pcm:verify")) ||
    (p === "pcm:read" && perms.includes("pcm:search")) ||
    perms.includes("*");

  const links = nav.filter((n) => can(n.perm));

  return (
    <div className="min-h-screen bg-slate-100">
      <header className="border-b border-emerald-900/20 bg-nysc-green text-white shadow-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/15 text-sm font-bold">
              NY
            </div>
            <div className="leading-tight">
              <div className="text-sm font-bold tracking-wide">NYSC Ekiti</div>
              <div className="text-[11px] text-white/80">Staff operations</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden text-right text-sm sm:block">
              <div className="font-medium">{me ? me.user.name || me.user.email : "…"}</div>
              <div className="text-[11px] text-white/75">
                {me?.roles?.slice(0, 2).join(" · ") || "Signed in"}
              </div>
            </div>
            <button
              type="button"
              onClick={logout}
              className="rounded-md border border-white/30 bg-white/10 px-3 py-1.5 text-sm font-medium hover:bg-white/20"
            >
              Logout
            </button>
            <button
              type="button"
              className="rounded-md border border-white/30 p-2 sm:hidden"
              onClick={() => setMobileOpen((v) => !v)}
              aria-label="Menu"
            >
              <span className="block h-0.5 w-5 bg-white" />
              <span className="mt-1 block h-0.5 w-5 bg-white" />
              <span className="mt-1 block h-0.5 w-5 bg-white" />
            </button>
          </div>
        </div>
      </header>

      <nav className="border-b border-slate-200 bg-white shadow-sm">
        <div className="mx-auto hidden max-w-6xl gap-1 px-4 sm:flex sm:px-6">
          {links.map((n) => {
            const active =
              n.href === "/staff/pcm"
                ? pathname === "/staff/pcm" ||
                  Boolean(pathname.match(/^\/staff\/pcm\/[^/]+$/))
                : pathname.startsWith(n.href);
            return (
              <Link
                key={n.href}
                href={n.href}
                className={`border-b-2 px-4 py-3 text-sm font-semibold transition ${
                  active
                    ? "border-nysc-green text-nysc-green"
                    : "border-transparent text-slate-600 hover:text-slate-900"
                }`}
              >
                {n.label}
              </Link>
            );
          })}
        </div>
        {mobileOpen && (
          <div className="border-t border-slate-100 px-2 py-2 sm:hidden">
            {links.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                onClick={() => setMobileOpen(false)}
                className={`block rounded-md px-3 py-2.5 text-sm font-medium ${
                  pathname.startsWith(n.href)
                    ? "bg-green-50 text-nysc-green"
                    : "text-slate-700"
                }`}
              >
                {n.label}
              </Link>
            ))}
          </div>
        )}
      </nav>

      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">{children}</div>
    </div>
  );
}
