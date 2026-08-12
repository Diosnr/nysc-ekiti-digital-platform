import type { Metadata } from "next";
import Link from "next/link";
import { PageHero } from "@/components/PageHero";

export const metadata: Metadata = {
  title: "PCM Services",
};

export default function PcmServicesPage() {
  return (
    <>
      <PageHero
        breadcrumb="PCM / Corps Member Services"
        title="PCM & Corps Member Services"
        subtitle="Self-service entry points for Prospective Corps Members and serving Corps Members. Features are introduced progressively."
      />
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <div className="rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Coming in phases</h2>
          <p className="mt-3 text-slate-600 leading-relaxed">
            Digital intake (including QR-based call-up verification), camp-related self-service,
            and later service-year workflows (PPA, relocation, clearance, etc.) will be rolled out
            according to the platform roadmap. The system is modelled around your Corps Member
            record — not around uploading random files.
          </p>
          <ul className="mt-6 space-y-2 text-sm text-slate-600">
            <li>• Phase 3 — PCM intake & verification</li>
            <li>• Phase 4 — Camp operations (check-in, accommodation, registration, kits, …)</li>
            <li>• Phase 6 — Service-year operations</li>
          </ul>
          <p className="mt-6 text-sm text-slate-500">
            Meanwhile, use{" "}
            <Link href="/orientation-camp" className="font-medium text-nysc-green hover:underline">
              Orientation Camp
            </Link>{" "}
            and{" "}
            <Link href="/announcements" className="font-medium text-nysc-green hover:underline">
              Announcements
            </Link>{" "}
            for official guidance.
          </p>
        </div>
      </div>
    </>
  );
}
