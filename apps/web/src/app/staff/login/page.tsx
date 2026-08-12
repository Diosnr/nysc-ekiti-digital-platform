import type { Metadata } from "next";
import Link from "next/link";
import { StaffLoginForm } from "@/components/StaffLoginForm";

export const metadata: Metadata = {
  title: "Staff Login",
};

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
        <StaffLoginForm />
        <p className="mt-6 text-center text-xs text-slate-500">
          <Link href="/" className="text-nysc-green hover:underline">
            Return to public site
          </Link>
        </p>
      </div>
    </main>
  );
}
