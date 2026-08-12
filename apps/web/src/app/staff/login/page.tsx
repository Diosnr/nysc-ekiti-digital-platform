import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Staff Login",
};

/**
 * Staff login UI foundation (Phase 2).
 * Wired to real auth API once the server routes are running against PostgreSQL.
 * Do not treat this form as production-ready until Phase 2 API is verified.
 */
export default function StaffLoginPage() {
  return (
    <main className="flex min-h-[70vh] items-center justify-center px-4 py-16">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-wider text-nysc-green">
          Staff portal
        </p>
        <h1 className="mt-2 text-2xl font-bold text-slate-900">Sign in</h1>
        <p className="mt-2 text-sm text-slate-600">
          For authorized NYSC Ekiti officials only. Unauthorized access is prohibited.
        </p>

        <form className="mt-8 space-y-4" method="post" action="#">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-slate-700">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="username"
              required
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-nysc-green focus:outline-none focus:ring-1 focus:ring-nysc-green"
              placeholder="you@example.com"
            />
          </div>
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-slate-700">
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-nysc-green focus:outline-none focus:ring-1 focus:ring-nysc-green"
            />
          </div>
          <button
            type="submit"
            className="w-full rounded-md bg-nysc-green px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-nysc-green-light"
          >
            Sign in
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-slate-500">
          Auth API and session enforcement land with the Phase 2 backend wiring.{" "}
          <Link href="/" className="text-nysc-green hover:underline">
            Return to public site
          </Link>
        </p>
      </div>
    </main>
  );
}
