import type { Metadata } from "next";
import { PageHero } from "@/components/PageHero";

export const metadata: Metadata = {
  title: "News",
};

const placeholderNews = [
  {
    id: "1",
    title: "Welcome to the NYSC Ekiti Digital Platform",
    date: "2026-08-12",
    excerpt:
      "The State Secretariat is launching a modern digital information and operations platform to serve the public, Prospective Corps Members, and operational teams.",
  },
];

export default function NewsPage() {
  return (
    <>
      <PageHero
        breadcrumb="News"
        title="News"
        subtitle="Updates and stories from NYSC Ekiti State."
      />
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <div className="space-y-6">
          {placeholderNews.map((item) => (
            <article
              key={item.id}
              className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
            >
              <time className="text-xs font-medium uppercase tracking-wider text-slate-500">
                {item.date}
              </time>
              <h2 className="mt-2 text-lg font-semibold text-slate-900">{item.title}</h2>
              <p className="mt-2 text-slate-600 leading-relaxed">{item.excerpt}</p>
            </article>
          ))}
        </div>
        <p className="mt-8 text-center text-sm text-slate-500">
          Content management for news will be connected in a later phase. Official updates will appear here.
        </p>
      </div>
    </>
  );
}
