"use client";

import { useEffect, useState } from "react";
import { PageHero } from "@/components/PageHero";

type Item = {
  id: string;
  title: string;
  body: string;
  imageUrl?: string | null;
  publishedAt: string;
};

export default function AnnouncementsPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/content?type=announcement")
      .then((r) => r.json())
      .then((d) => setItems(d.items ?? []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <>
      <PageHero
        breadcrumb="Announcements"
        title="Announcements"
        subtitle="Official notices from the NYSC Ekiti State Secretariat."
      />
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        {loading && (
          <div className="space-y-4">
            {[1, 2].map((i) => (
              <div key={i} className="h-24 animate-pulse rounded-xl bg-slate-200" />
            ))}
          </div>
        )}
        {!loading && items.length === 0 && (
          <p className="text-center text-sm text-slate-500">No announcements yet.</p>
        )}
        <div className="space-y-6">
          {items.map((item) => (
            <div
              key={item.id}
              className="overflow-hidden rounded-xl border-l-4 border-nysc-green bg-white shadow-sm ring-1 ring-slate-200"
            >
              {item.imageUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={item.imageUrl}
                  alt=""
                  className="h-40 w-full object-cover"
                />
              )}
              <div className="p-6">
                <time className="text-xs font-medium uppercase tracking-wider text-slate-500">
                  {new Date(item.publishedAt).toLocaleDateString()}
                </time>
                <h2 className="mt-2 text-lg font-semibold text-slate-900">{item.title}</h2>
                <p className="mt-2 text-slate-600 leading-relaxed whitespace-pre-wrap">
                  {item.body}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
