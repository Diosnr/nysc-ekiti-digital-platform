"use client";

import { useEffect, useState } from "react";
import { PageHero } from "@/components/PageHero";

type Item = {
  id: string;
  title: string;
  excerpt?: string | null;
  body: string;
  imageUrl?: string | null;
  publishedAt: string;
  authorName?: string | null;
};

export default function NewsPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/content?type=news")
      .then((r) => r.json())
      .then((d) => setItems(d.items ?? []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <>
      <PageHero
        breadcrumb="News"
        title="News"
        subtitle="Updates and stories from NYSC Ekiti State."
      />
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        {loading && (
          <div className="space-y-4">
            {[1, 2].map((i) => (
              <div key={i} className="h-28 animate-pulse rounded-xl bg-slate-200" />
            ))}
          </div>
        )}
        {!loading && items.length === 0 && (
          <p className="text-center text-sm text-slate-500">
            No news published yet. Check back soon.
          </p>
        )}
        <div className="space-y-6">
          {items.map((item) => (
            <article
              key={item.id}
              className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
            >
              {item.imageUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={item.imageUrl}
                  alt=""
                  className="h-48 w-full object-cover"
                />
              )}
              <div className="p-6">
                <time className="text-xs font-medium uppercase tracking-wider text-slate-500">
                  {new Date(item.publishedAt).toLocaleDateString()}
                </time>
                <h2 className="mt-2 text-lg font-semibold text-slate-900">{item.title}</h2>
                <p className="mt-2 text-slate-600 leading-relaxed whitespace-pre-wrap">
                  {item.excerpt || item.body}
                </p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </>
  );
}
