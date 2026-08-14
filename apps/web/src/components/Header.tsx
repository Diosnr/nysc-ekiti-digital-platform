"use client";

import Link from "next/link";
import { useState } from "react";

const campPortal = [
  {
    href: "/camp-portal/nursing-pregnant",
    label: "Ekiti Married Women",
    desc: "Husband address for posting",
  },
  {
    href: "/camp-portal/skills",
    label: "Skills",
    desc: "Declare up to 3 skills",
  },
  {
    href: "/camp-portal/account",
    label: "Account",
    desc: "Upload NIN card images",
  },
];

export function Header() {
  const [open, setOpen] = useState(false);
  const [campOpen, setCampOpen] = useState(false);

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

          <div
            className="relative"
            onMouseEnter={() => setCampOpen(true)}
            onMouseLeave={() => setCampOpen(false)}
          >
            <button
              type="button"
              className="flex items-center gap-1 rounded-md px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-100"
              onClick={() => setCampOpen((v) => !v)}
              aria-expanded={campOpen}
            >
              Camp Portal
              <span className="text-[10px] text-slate-400">▼</span>
            </button>
            {campOpen && (
              <div className="absolute left-0 top-full z-50 min-w-[260px] rounded-xl border border-slate-200 bg-white py-2 shadow-lg">
                {campPortal.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="block px-4 py-2.5 hover:bg-green-50"
                    onClick={() => setCampOpen(false)}
                  >
                    <div className="text-sm font-semibold text-slate-900">{item.label}</div>
                    <div className="text-xs text-slate-500">{item.desc}</div>
                  </Link>
                ))}
              </div>
            )}
          </div>

          <Link
            href="/staff/login"
            className="ml-2 rounded-md bg-nysc-green px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-nysc-green-light"
          >
            Staff Login
          </Link>
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
          <p className="mt-2 px-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
            Camp Portal
          </p>
          {campPortal.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="block rounded-md px-2 py-2 text-sm text-slate-700"
              onClick={() => setOpen(false)}
            >
              {item.label}
            </Link>
          ))}
          <Link
            href="/staff/login"
            className="mt-3 block rounded-md bg-nysc-green px-2 py-2.5 text-center text-sm font-semibold text-white"
            onClick={() => setOpen(false)}
          >
            Staff Login
          </Link>
        </nav>
      )}
    </header>
  );
}
