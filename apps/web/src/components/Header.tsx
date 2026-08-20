"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getCmToken, clearCmToken } from "@/lib/cm-api";

export function Header() {
  const pathname = usePathname() || "";
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [cmLoggedIn, setCmLoggedIn] = useState(false);

  const isCampPortal = pathname.startsWith("/camp-portal");

  useEffect(() => {
    setCmLoggedIn(Boolean(getCmToken()));
  }, [pathname]);

  function signOutCm() {
    clearCmToken();
    setCmLoggedIn(false);
    setOpen(false);
    router.push("/camp-portal/login");
  }

  return (
    <header className="sticky top-0 z-50 border-b border-slate-200 bg-white shadow-sm">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-nysc-green text-sm font-bold text-white">
            NY
          </span>
          <div className="leading-tight">
            <div className="text-sm font-bold text-slate-900">NYSC Ekiti</div>
            <div className="text-xs text-slate-500">Digital Platform</div>
          </div>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          <Link
            href="/"
            className="rounded-md px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-100"
          >
            Home
          </Link>

          <Link
            href="/camp-portal"
            className="rounded-md px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-100"
          >
            My Portal
          </Link>

          {isCampPortal && cmLoggedIn ? (
            <button
              type="button"
              onClick={signOutCm}
              className="ml-2 rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Sign out
            </button>
          ) : !isCampPortal ? (
            <Link
              href="/staff/login"
              className="ml-2 rounded-md bg-nysc-green px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-nysc-green-light"
            >
              Staff Login
            </Link>
          ) : null}
        </nav>

        <button
          type="button"
          className="rounded-md border border-slate-300 p-2 md:hidden"
          onClick={() => setOpen((v) => !v)}
          aria-label="Menu"
        >
          <span className="block h-0.5 w-5 bg-slate-800" />
          <span className="mt-1 block h-0.5 w-5 bg-slate-800" />
          <span className="mt-1 block h-0.5 w-5 bg-slate-800" />
        </button>
      </div>

      {open && (
        <nav className="border-t border-slate-100 px-4 py-3 md:hidden">
          <Link
            href="/"
            className="block rounded-md px-2 py-2.5 text-sm font-semibold text-slate-800"
            onClick={() => setOpen(false)}
          >
            Home
          </Link>
          <Link
            href="/camp-portal"
            className="block rounded-md px-2 py-2.5 text-sm font-semibold text-slate-800"
            onClick={() => setOpen(false)}
          >
            My Portal
          </Link>
          {isCampPortal && cmLoggedIn ? (
            <button
              type="button"
              onClick={signOutCm}
              className="mt-3 block w-full rounded-md border border-slate-300 px-2 py-2.5 text-center text-sm font-semibold text-slate-700"
            >
              Sign out
            </button>
          ) : !isCampPortal ? (
            <Link
              href="/staff/login"
              className="mt-3 block rounded-md bg-nysc-green px-2 py-2.5 text-center text-sm font-semibold text-white"
              onClick={() => setOpen(false)}
            >
              Staff Login
            </Link>
          ) : null}
        </nav>
      )}
    </header>
  );
}
