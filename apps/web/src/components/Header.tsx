"use client";

import Link from "next/link";
import { useState } from "react";

const nav = [
  { href: "/", label: "Home" },
  { href: "/about", label: "About" },
  { href: "/orientation-camp", label: "Orientation Camp" },
  { href: "/news", label: "News" },
  { href: "/announcements", label: "Announcements" },
  { href: "/events", label: "Events" },
  { href: "/resources", label: "Resources" },
  { href: "/gallery", label: "Gallery" },
  { href: "/faqs", label: "FAQs" },
  { href: "/contact", label: "Contact" },
];

export function Header() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="border-b border-nysc-green bg-nysc-green">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-1.5 text-xs text-white sm:px-6">
          <span>National Youth Service Corps — Ekiti State</span>
          <div className="flex gap-3">
            <Link href="/pcm" className="hover:underline">
              PCM Registration
            </Link>
            <Link href="/staff" className="hover:underline">
              Staff
            </Link>
          </div>
        </div>
      </div>
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <Link href="/" className="flex items-center gap-2">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-nysc-green text-sm font-bold text-white">
            NY
          </span>
          <div className="leading-tight">
            <div className="text-sm font-bold text-slate-900">NYSC Ekiti</div>
            <div className="text-xs text-slate-500">Digital Platform</div>
          </div>
        </Link>
        <nav className="hidden items-center gap-1 lg:flex">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-md px-2.5 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100"
            >
              {item.label}
            </Link>
          ))}
          <Link
            href="/pcm"
            className="ml-2 rounded-md bg-nysc-green px-3 py-1.5 text-sm font-semibold text-white hover:bg-nysc-green-light"
          >
            PCM Register
          </Link>
        </nav>
        <button
          type="button"
          className="rounded-md border border-slate-300 p-2 lg:hidden"
          onClick={() => setOpen((v) => !v)}
          aria-label="Menu"
        >
          <span className="block h-0.5 w-5 bg-slate-800" />
          <span className="mt-1 block h-0.5 w-5 bg-slate-800" />
          <span className="mt-1 block h-0.5 w-5 bg-slate-800" />
        </button>
      </div>
      {open && (
        <nav className="border-t border-slate-100 px-4 py-3 lg:hidden">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="block rounded-md px-2 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              onClick={() => setOpen(false)}
            >
              {item.label}
            </Link>
          ))}
          <Link
            href="/pcm"
            className="mt-1 block rounded-md bg-nysc-green px-2 py-2 text-center text-sm font-semibold text-white"
            onClick={() => setOpen(false)}
          >
            PCM Register
          </Link>
        </nav>
      )}
    </header>
  );
}
