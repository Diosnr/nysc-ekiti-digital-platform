import type { Metadata } from "next";
import { PageHero } from "@/components/PageHero";

export const metadata: Metadata = {
  title: "Contact",
};

export default function ContactPage() {
  return (
    <>
      <PageHero
        breadcrumb="Contact"
        title="Contact"
        subtitle="Reach the NYSC Ekiti State Secretariat."
      />
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <div className="grid gap-8 sm:grid-cols-2">
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">Secretariat</h2>
            <ul className="mt-4 space-y-2 text-sm text-slate-600">
              <li>NYSC Ekiti State Secretariat</li>
              <li>Ado-Ekiti, Ekiti State, Nigeria</li>
              <li className="pt-2 text-slate-500">
                Full address, phone and email will be published here once confirmed by the Secretariat.
              </li>
            </ul>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">Enquiries</h2>
            <p className="mt-4 text-sm text-slate-600 leading-relaxed">
              For Prospective Corps Members, please check Announcements and the Orientation Camp page
              first. A contact form and ticket-style handling can be added in a later phase if required.
            </p>
          </div>
        </div>
        <p className="mt-8 text-center text-sm text-slate-500">
          Official contact details should be confirmed by NYSC Ekiti stakeholders before public display of phone numbers or emails.
        </p>
      </div>
    </>
  );
}
