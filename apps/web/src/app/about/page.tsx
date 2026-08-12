import type { Metadata } from "next";
import { PageHero } from "@/components/PageHero";

export const metadata: Metadata = {
  title: "About NYSC Ekiti",
};

export default function AboutPage() {
  return (
    <>
      <PageHero
        breadcrumb="About"
        title="About NYSC Ekiti State"
        subtitle="The National Youth Service Corps Ekiti State Secretariat coordinates orientation and service-year programmes for Corps Members deployed to Ekiti."
      />
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <div className="prose prose-slate max-w-none">
          <h2 className="text-xl font-semibold text-slate-900">Our mandate</h2>
          <p className="mt-3 text-slate-600 leading-relaxed">
            The National Youth Service Corps (NYSC) was established to foster national unity and
            development through a mandatory one-year service programme for Nigerian graduates.
            The Ekiti State Secretariat administers the scheme within the state — from orientation
            camp through Primary Place of Assignment (PPA) and final clearance.
          </p>

          <h2 className="mt-10 text-xl font-semibold text-slate-900">What this platform provides</h2>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-slate-600">
            <li>Public institutional information about NYSC Ekiti</li>
            <li>Orientation camp guidance for Prospective Corps Members</li>
            <li>Official news, announcements and events</li>
            <li>Resources and FAQs</li>
            <li>Progressive self-service and digital operations for PCMs and Corps Members</li>
          </ul>

          <h2 className="mt-10 text-xl font-semibold text-slate-900">Digital direction</h2>
          <p className="mt-3 text-slate-600 leading-relaxed">
            This platform is designed as an information and operations system modelled around the
            Corps Member lifecycle — not as a generic file store. Processes such as intake,
            camp registration, accommodation, and later service-year workflows are being digitised
            responsibly and in phases.
          </p>
        </div>
      </div>
    </>
  );
}
