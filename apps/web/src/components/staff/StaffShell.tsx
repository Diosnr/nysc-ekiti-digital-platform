"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { clearTokens, getAccessToken, staffFetch } from "@/lib/staff-api";

type Me = {
  user: { name: string | null; email: string };
  roles: string[];
  permissions: string[];
};

type NavItem = {
  href: string;
  label: string;
  perm: string | null;
  group?: "create";
};

const ShellCtx = createContext(false);

const nav: NavItem[] = [
  { href: "/staff/dashboard", label: "Dashboard", perm: null },
  { href: "/staff/security/checkin", label: "Security gate", perm: "security:checkin" },
  { href: "/staff/pcm", label: "PCM Registry", perm: "pcm:read" },
  {
    href: "/staff/registration",
    label: "Registration",
    perm: "registration:complete",
  },
  {
    href: "/staff/admin/camp-addresses",
    label: "Camp addresses",
    perm: "camp:address:manage",
    group: "create",
  },
  {
    href: "/staff/admin/communities",
    label: "Communities",
    perm: "community:manage",
    group: "create",
  },
  { href: "/staff/admin/users", label: "Users", perm: "user:read" },
  { href: "/staff/admin/roles", label: "Roles", perm: "role:read" },
  { href: "/staff/admin/audit", label: "Audit log", perm: "audit:read" },
];

export function StaffShell({ children }: { children: React.ReactNode }) {
  const nested = useContext(ShellCtx);
  // Pages still wrapping StaffShell: only render children (layout owns chrome)
  if (nested) return <>{children}</>;

  return (
    <ShellCtx.Provider value={true}>
      <StaffShellInner>{children}</StaffShellInner>
    </ShellCtx.Provider>
  );
}

function StaffShellInner({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(true);
  const loaded = useRef(false);

  const bare =
    pathname.startsWith("/staff/login") || pathname.startsWith("/staff/activate");

  useEffect(() => {
    if (bare) return;
    if (!getAccessToken()) {
      router.replace("/staff/login");
      return;
    }
    if (loaded.current) return;
    staffFetch("/api/auth/me")
      .then(async (res) => {
        if (!res.ok) {
          router.replace("/staff/login");
          return;
        }
        setMe(await res.json());
        loaded.current = true;
      })
      .catch(() => router.replace("/staff/login"));
  }, [router, bare]);

  function logout() {
    const refresh = localStorage.getItem("nysc_refresh_token");
    staffFetch("/api/auth/logout", {
      method: "POST",
      body: JSON.stringify({ refreshToken: refresh }),
    }).finally(() => {
      clearTokens();
      loaded.current = false;
      setMe(null);
      router.replace("/staff/login");
    });
  }

  if (bare) return <>{children}</>;

  const perms = me?.permissions ?? [];
  const roles = me?.roles ?? [];
  const isSecurity = roles.includes("Security Officer");
  const isSuper =
    roles.some((r) => r.toLowerCase() === "super admin") || perms.includes("*");
  const isRegistration =
    roles.includes("Registration Officer") ||
    perms.includes("registration:complete");

  const can = (p: string | null) => {
    if (!p) return true;
    if (isSuper || perms.includes("*") || perms.includes(p)) return true;
    if (p === "pcm:read" && perms.includes("pcm:search")) return true;
    if (p === "registration:complete" && isRegistration) return true;
    if (isSecurity && !isSuper) {
      return ["security:checkin", "pcm:read", "pcm:search"].includes(p);
    }
    return false;
  };

  const visible = nav.filter((n) => {
    if (!can(n.perm)) return false;
    if (isSecurity && !isSuper) {
      return ["/staff/security/checkin", "/staff/pcm"].includes(n.href);
    }
    return true;
  });

  const topLinks = visible.filter((n) => !n.group);
  const createLinks = visible.filter((n) => n.group === "create");

  function NavLink({ item }: { item: NavItem }) {
    const active =
      item.href === "/staff/pcm"
        ? pathname === "/staff/pcm" || pathname.startsWith("/staff/pcm/")
        : pathname.startsWith(item.href);
    return (
      <Link
        href={item.href}
        prefetch
        onClick={() => setMobileOpen(false)}
        className={`block rounded-lg px-3 py-2 text-sm font-medium transition ${
          active
            ? "bg-nysc-green text-white"
            : "text-slate-700 hover:bg-slate-100"
        }`}
      >
        {item.label}
      </Link>
    );
  }

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="border-b border-slate-200 px-4 py-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-nysc-green text-xs font-bold text-white">
            NY
          </div>
          <div className="leading-tight">
            <div className="text-sm font-bold text-slate-900">NYSC Ekiti</div>
            <div className="text-[11px] text-slate-500">
              {isSecurity && !isSuper ? "Security" : "Staff"}
            </div>
          </div>
        </div>
      </div>
      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {topLinks.map((n) => (
          <NavLink key={n.href} item={n} />
        ))}
        {createLinks.length > 0 && (
          <div className="pt-3">
            <button
              type="button"
              onClick={() => setCreateOpen((v) => !v)}
              className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-400 hover:text-slate-600"
            >
              Create
              <span className="text-[10px]">{createOpen ? "▼" : "▶"}</span>
            </button>
            {createOpen && (
              <div className="ml-2 space-y-1 border-l border-slate-200 pl-2">
                {createLinks.map((n) => (
                  <NavLink key={n.href} item={n} />
                ))}
              </div>
            )}
          </div>
        )}
      </nav>
      <div className="border-t border-slate-200 p-4">
        <div className="mb-2 truncate text-sm font-medium text-slate-900">
          {me ? me.user.name || me.user.email : "…"}
        </div>
        <div className="mb-3 truncate text-[11px] text-slate-500">
          {roles.slice(0, 2).join(" · ") || "Signed in"}
        </div>
        <button
          type="button"
          onClick={logout}
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Logout
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-100">
      <div className="sticky top-0 z-40 flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 lg:hidden">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-nysc-green text-xs font-bold text-white">
            NY
          </div>
          <span className="text-sm font-bold text-slate-900">NYSC Ekiti</span>
        </div>
        <button
          type="button"
          className="rounded-md border border-slate-300 p-2"
          onClick={() => setMobileOpen((v) => !v)}
          aria-label="Menu"
        >
          <span className="block h-0.5 w-5 bg-slate-800" />
          <span className="mt-1 block h-0.5 w-5 bg-slate-800" />
          <span className="mt-1 block h-0.5 w-5 bg-slate-800" />
        </button>
      </div>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/40"
            onClick={() => setMobileOpen(false)}
            aria-label="Close menu"
          />
          <aside className="absolute left-0 top-0 h-full w-72 bg-white shadow-xl">
            {sidebar}
          </aside>
        </div>
      )}

      <div className="lg:flex lg:min-h-screen">
        <aside className="hidden w-64 shrink-0 border-r border-slate-200 bg-white lg:block">
          <div className="sticky top-0 h-screen overflow-y-auto">{sidebar}</div>
        </aside>
        <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          {children}
        </main>
      </div>
    </div>
  );
}
