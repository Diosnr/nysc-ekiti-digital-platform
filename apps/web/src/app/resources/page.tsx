import type { Metadata } from "next";
import { PageHero } from "@/components/PageHero";

export const metadata: Metadata = {
  title: "Resources",
};

export default function ResourcesPage() {
  return (
    <>
      <PageHero
        breadcrumb="Resources"
        title="Resources"
        subtitle="Guides, forms and downloadable materials for Prospective Corps Members and the public."
      />
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-10 text-center">
          <p className="text-slate-600">Resources will appear here as they are published.</p>
          <p className="mt-2 text-sm text-slate-500">
            Authorised officers will be able to upload and categorise documents in a later phase.
            Always verify critical instructions through official announcements.
          </p>
        </div>
      </div>
    </>
  );
}
