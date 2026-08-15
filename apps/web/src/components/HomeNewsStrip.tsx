"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Item = {
  id: string;
  title: string;
  excerpt?: string | null;
  body: string;
  imageUrl?: string | null;
  publishedAt: string;
};

/** Quiet strip of latest PRO news below primary home content. */
export function HomeNewsStrip() {
  const [items, setItems] = useState<Item[]>([]);

  useEffect(() => {
    fetch("/api/content?type=news")
      .then((r) => r.json())
      .then((d) => setItems((d.items ?? []).slice(0, 3)))
      .catch(() => setItems([]));
  }, []);

  if (!items.length) return null;

  return (
    <section className="border-t border-slate-100 bg-white">
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <div className="mb-6 flex items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-nysc-green">
              From the secretariat
            </p>
            <h2 className="mt-1 text-lg font-semibold text-slate-900">Latest news</h2>
          </div>
          <Link
            href="/news"
            className="text-sm font-medium text-nysc-green hover:underline"
          >
            All news →
          </Link>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          {items.map((item) => (
            <article
              key={item.id}
              className="overflow-hidden rounded-xl border border-slate-100 bg-slate-50/80"
            >
              {item.imageUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={item.imageUrl}
                  alt=""
                  className="h-28 w-full object-cover"
                />
              )}
              <div className="p-4">
                <time className="text-[11px] uppercase tracking-wide text-slate-400">
                  {new Date(item.publishedAt).toLocaleDateString()}
                </time>
                <h3 className="mt-1 line-clamp-2 text-sm font-semibold text-slate-900">
                  {item.title}
                </h3>
                <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-slate-500">
                  {item.excerpt || item.body}
                </p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
