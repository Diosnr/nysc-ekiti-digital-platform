"use client";

import { FormEvent, useEffect, useState } from "react";
import { StaffShell } from "@/components/staff/StaffShell";
import { staffFetch } from "@/lib/staff-api";

type ContentItem = {
  id: string;
  title: string;
  body?: string;
  excerpt?: string | null;
  imageUrl?: string | null;
  publishedAt?: string;
  authorName?: string | null;
};

export default function ProDeskPage() {
  const [tab, setTab] = useState<"news" | "announcement">("news");
  const [items, setItems] = useState<ContentItem[]>([]);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [imageData, setImageData] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function load() {
    const res = await staffFetch(`/api/content?type=${tab}&all=1`);
    if (res.ok) {
      const data = await res.json();
      setItems(data.items ?? []);
    }
  }

  useEffect(() => {
    void load();
  }, [tab]);

  function onFile(file: File | null) {
    if (!file) {
      setImageData(null);
      return;
    }
    if (!file.type.startsWith("image/")) {
      setError("Choose an image file");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setImageData(String(reader.result));
    reader.readAsDataURL(file);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setMsg(null);
    setLoading(true);
    try {
      const res = await staffFetch("/api/content", {
        method: "POST",
        body: JSON.stringify({
          type: tab,
          title,
          body,
          excerpt: body.slice(0, 220),
          imageUrl: imageData,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Publish failed");
        return;
      }
      setMsg(`${tab === "news" ? "News" : "Announcement"} published`);
      setTitle("");
      setBody("");
      setImageData(null);
      void load();
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  async function onDelete(id: string) {
    if (!confirm("Delete this item?")) return;
    const res = await staffFetch(`/api/content?type=${tab}&id=${id}`, {
      method: "DELETE",
    });
    if (res.ok) void load();
  }

  return (
    <StaffShell>
      <h1 className="text-2xl font-bold text-slate-900">Public Relations</h1>
      <p className="mt-1 text-sm text-slate-600">
        Publish news and announcements for the public website. Optional photo uploads to Cloudinary.
      </p>

      {error && (
        <p className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}
      {msg && (
        <p className="mt-4 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">
          {msg}
        </p>
      )}

      <div className="mt-6 flex gap-2">
        {(["news", "announcement"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium ${
              tab === t
                ? "bg-nysc-green text-white"
                : "bg-white text-slate-700 ring-1 ring-slate-200"
            }`}
          >
            {t === "news" ? "News" : "Announcements"}
          </button>
        ))}
      </div>

      <form
        onSubmit={onSubmit}
        className="mt-6 max-w-2xl space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
      >
        <div>
          <label className="text-xs font-semibold uppercase text-slate-500">Title</label>
          <input
            required
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>
        <div>
          <label className="text-xs font-semibold uppercase text-slate-500">Body</label>
          <textarea
            required
            rows={6}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            value={body}
            onChange={(e) => setBody(e.target.value)}
          />
        </div>
        <div>
          <label className="text-xs font-semibold uppercase text-slate-500">Picture (optional)</label>
          <input
            type="file"
            accept="image/*"
            className="mt-1 block w-full text-sm"
            onChange={(e) => onFile(e.target.files?.[0] ?? null)}
          />
          {imageData && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={imageData}
              alt="Preview"
              className="mt-2 h-32 rounded-lg border object-cover"
            />
          )}
        </div>
        <button
          type="submit"
          disabled={loading}
          className="rounded-md bg-nysc-green px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {loading ? "Publishing…" : `Publish ${tab === "news" ? "news" : "announcement"}`}
        </button>
      </form>

      <div className="mt-10 max-w-2xl space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          Recent {tab === "news" ? "news" : "announcements"}
        </h2>
        {items.length === 0 && (
          <p className="text-sm text-slate-500">Nothing published yet.</p>
        )}
        {items.map((it) => (
          <div
            key={it.id}
            className="flex gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
          >
            {it.imageUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={it.imageUrl}
                alt=""
                className="h-16 w-16 shrink-0 rounded-md object-cover"
              />
            )}
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-slate-900">{it.title}</p>
              <p className="mt-0.5 line-clamp-2 text-sm text-slate-600">
                {it.excerpt || it.body}
              </p>
              <p className="mt-1 text-xs text-slate-400">
                {it.authorName}
                {it.publishedAt
                  ? ` · ${new Date(it.publishedAt).toLocaleDateString()}`
                  : ""}
              </p>
            </div>
            <button
              type="button"
              onClick={() => void onDelete(it.id)}
              className="self-start text-xs font-medium text-red-600 hover:underline"
            >
              Delete
            </button>
          </div>
        ))}
      </div>
    </StaffShell>
  );
}
