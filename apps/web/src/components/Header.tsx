"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  getCmToken,
  clearCmToken,
  ensureCmSessionActive,
  CM_IDLE_MS,
} from "@/lib/cm-api";

export function Header() {
  const pathname = usePathname() || "";
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [cmLoggedIn, setCmLoggedIn] = useState(false);

  const isCampPortal = pathname.startsWith("/camp-portal");

  useEffect(() => {
    if (isCampPortal && getCmToken()) {
      if (!ensureCmSessionActive()) {
        setCmLoggedIn(false);
        router.replace("/camp-portal/login");
        return;
      }
      setCmLoggedIn(true);

      const onActivity = () => {
        if (getCmToken()) ensureCmSessionActive();
      };
      const events = ["click", "keydown", "scroll", "touchstart"] as const;
      events.forEach((ev) => window.addEventListener(ev, onActivity, { passive: true }));

      const tick = window.setInterval(() => {
        if (getCmToken() && !ensureCmSessionActive()) {
          setCmLoggedIn(false);
          router.replace("/camp-portal/login");
        }
      }, 60_000);

      return () => {
        events.forEach((ev) => window.removeEventListener(ev, onActivity));
        window.clearInterval(tick);
      };
    }
    setCmLoggedIn(Boolean(getCmToken()) && isCampPortal);
  }, [pathname, isCampPortal, router]);

  function signOutCm() {
    clearCmToken();
    setCmLoggedIn(false);
    setOpen(false);
    router.push("/camp-portal/login");
  }

  return (
    <header className="sticky top-0 z-50 border-b border-slate-200 bg-white shadow-sm">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        {isCampPortal ? (
          <div className="flex items-center gap-2.5">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-nysc-green text-sm font-bold text-white">
              NY
            </span>
            <div className="leading-tight">
              <div className="text-sm font-bold text-slate-900">NYSC Ekiti</div>
              <div className="text-xs text-slate-500">My Portal</div>
            </div>
          </div>
        ) : (
          <Link href="/" className="flex items-center gap-2.5">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-nysc-green text-sm font-bold text-white">
              NY
            </span>
            <div className="leading-tight">
              <div className="text-sm font-bold text-slate-900">NYSC Ekiti</div>
              <div className="text-xs text-slate-500">Digital Platform</div>
            </div>
          </Link>
        )}

        <nav className="hidden items-center gap-1 md:flex">
          {!isCampPortal && (
            <>
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
              <Link
                href="/staff/login"
                className="ml-2 rounded-md bg-nysc-green px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-nysc-green-light"
              >
                Staff Login
              </Link>
            </>
          )}

          {isCampPortal && cmLoggedIn && (
            <button
              type="button"
              onClick={signOutCm}
              className="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Sign out
            </button>
          )}
        </nav>

        {(isCampPortal ? cmLoggedIn : true) && (
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
        )}
      </div>

      {open && (
        <nav className="border-t border-slate-100 px-4 py-3 md:hidden">
          {!isCampPortal && (
            <>
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
              <Link
                href="/staff/login"
                className="mt-3 block rounded-md bg-nysc-green px-2 py-2.5 text-center text-sm font-semibold text-white"
                onClick={() => setOpen(false)}
              >
                Staff Login
              </Link>
            </>
          )}
          {isCampPortal && cmLoggedIn && (
            <button
              type="button"
              onClick={signOutCm}
              className="block w-full rounded-md border border-slate-300 px-2 py-2.5 text-center text-sm font-semibold text-slate-700"
            >
              Sign out
            </button>
          )}
        </nav>
      )}
    </header>
  );
}
