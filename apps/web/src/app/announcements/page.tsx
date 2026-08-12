import type { Metadata } from "next";
import { PageHero } from "@/components/PageHero";

export const metadata: Metadata = {
  title: "Announcements",
};

const placeholder = [
  {
    id: "1",
    title: "Platform launch notice",
    date: "2026-08-12",
    body: "The NYSC Ekiti Digital Information & Operations Platform is being rolled out in phases. Public pages are live; operational modules will follow according to the published roadmap.",
  },
];

export default function AnnouncementsPage() {
  return (
    <>
      <PageHero
        breadcrumb="Announcements"
        title="Announcements"
        subtitle="Official notices from the NYSC Ekiti State Secretariat."
      />
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <div className="space-y-6">
          {placeholder.map((item) => (
            <div
              key={item.id}
              className="rounded-xl border-l-4 border-nysc-green bg-white p-6 shadow-sm ring-1 ring-slate-200"
            >
              <time className="text-xs font-medium uppercase tracking-wider text-slate-500">
                {item.date}
              </time>
              <h2 className="mt-2 text-lg font-semibold text-slate-900">{item.title}</h2>
              <p className="mt-2 text-slate-600 leading-relaxed">{item.body}</p>
            </div>
          ))}
        </div>
        <p className="mt-8 text-center text-sm text-slate-500">
          Dynamic announcement management will be enabled for authorised officers in a later phase.
        </p>
      </div>
    </>
  );
}
