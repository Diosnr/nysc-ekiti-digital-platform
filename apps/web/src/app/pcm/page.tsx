import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "PCM Registration",
};

/** Public self-service intake removed — staff perform intake in admin. */
export default function PcmPublicRedirectPage() {
  return (
    <main className="mx-auto max-w-lg px-4 py-16 text-center sm:px-6">
      <h1 className="text-2xl font-bold text-slate-900">PCM registration</h1>
      <p className="mt-3 text-slate-600">
        Call-up intake is handled by authorized NYSC Ekiti staff at orientation /
        secretariat. Prospective corps members should report with their call-up
        letter.
      </p>
      <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
        <Link
          href="/staff/login"
          className="rounded-md bg-nysc-green px-4 py-2.5 text-sm font-semibold text-white"
        >
          Staff login
        </Link>
        <Link
          href="/orientation-camp"
          className="rounded-md border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-800"
        >
          Orientation camp info
        </Link>
      </div>
    </main>
  );
}
