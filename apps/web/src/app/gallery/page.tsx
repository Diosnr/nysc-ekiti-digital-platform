import type { Metadata } from "next";
import { PageHero } from "@/components/PageHero";

export const metadata: Metadata = {
  title: "Gallery",
};

export default function GalleryPage() {
  return (
    <>
      <PageHero
        breadcrumb="Gallery"
        title="Gallery"
        subtitle="Photographs and media from NYSC Ekiti programmes and orientation activities."
      />
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-16 text-center">
          <p className="text-slate-600">Gallery content will be published by authorised staff.</p>
          <p className="mt-2 text-sm text-slate-500">
            Media management and album support are planned for a later phase.
          </p>
        </div>
      </div>
    </>
  );
}
