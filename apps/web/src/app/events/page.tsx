import type { Metadata } from "next";
import { PageHero } from "@/components/PageHero";

export const metadata: Metadata = {
  title: "Events",
};

export default function EventsPage() {
  return (
    <>
      <PageHero
        breadcrumb="Events"
        title="Events"
        subtitle="Upcoming and past events related to NYSC Ekiti programmes."
      />
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-10 text-center">
          <p className="text-slate-600">No public events listed at this time.</p>
          <p className="mt-2 text-sm text-slate-500">
            Event listings will be managed by authorised staff and published here when available.
          </p>
        </div>
      </div>
    </>
  );
}
