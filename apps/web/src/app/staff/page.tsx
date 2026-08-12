import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Staff Portal",
};

export default function StaffPortalHome() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
      <h1 className="text-3xl font-bold text-slate-900">Staff Portal</h1>
      <p className="mt-3 text-slate-600">
        Authenticated operations surface for NYSC Ekiti officials. Phase 2 establishes
        identity, dynamic RBAC and audit foundations. Camp operations and electronic
        file movement follow in later phases.
      </p>
      <div className="mt-8 flex flex-wrap gap-3">
        <Link
          href="/staff/login"
          className="rounded-md bg-nysc-green px-4 py-2.5 text-sm font-semibold text-white hover:bg-nysc-green-light"
        >
          Staff login
        </Link>
        <Link
          href="/"
          className="rounded-md border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          Public website
        </Link>
      </div>
    </main>
  );
}
