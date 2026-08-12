import type { Metadata } from "next";
import Link from "next/link";
import { PageHero } from "@/components/PageHero";

export const metadata: Metadata = {
  title: "Orientation Camp",
};

const sections = [
  {
    title: "Before you arrive",
    body: "Ensure you have your call-up letter, required documents, and personal effects as specified in official guidelines. Monitor announcements on this platform for camp-specific instructions.",
  },
  {
    title: "On arrival",
    body: "Security check-in, verification of identity, and subsequent processing (accommodation, registration, kit issuance) follow structured camp procedures. Digital check-in and related workflows are being introduced progressively.",
  },
  {
    title: "Camp activities",
    body: "Orientation includes drills, lectures, skills acquisition, and other programmes designed to prepare Corps Members for service. Schedules and notices will be published through official channels.",
  },
  {
    title: "After camp",
    body: "Successful completion of orientation leads to posting to a Primary Place of Assignment (PPA) and the service-year phase. Clearance and related processes are managed by the State Secretariat.",
  },
];

export default function OrientationCampPage() {
  return (
    <>
      <PageHero
        breadcrumb="Orientation Camp"
        title="Orientation Camp"
        subtitle="Guidance for Prospective Corps Members deployed to NYSC Ekiti State orientation camp."
      />
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <div className="space-y-8">
          {sections.map((s) => (
            <div key={s.title} className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-900">{s.title}</h2>
              <p className="mt-2 text-slate-600 leading-relaxed">{s.body}</p>
            </div>
          ))}
        </div>
        <div className="mt-10 rounded-xl border border-green-200 bg-green-50 p-6">
          <p className="font-semibold text-nysc-green">Official notices</p>
          <p className="mt-2 text-sm text-slate-700">
            Camp dates, requirements and urgent instructions are published under{" "}
            <Link href="/announcements" className="font-medium text-nysc-green underline">
              Announcements
            </Link>{" "}
            and{" "}
            <Link href="/news" className="font-medium text-nysc-green underline">
              News
            </Link>
            . Always rely on official sources.
          </p>
        </div>
      </div>
    </>
  );
}
