"use client";

import { useState } from "react";

/** True if the value can be used as an <img src>. */
export function isPhotoSrc(url?: string | null): boolean {
  if (!url?.trim()) return false;
  const u = url.trim();
  return (
    /^https?:\/\//i.test(u) ||
    u.startsWith("//") ||
    u.startsWith("data:image") ||
    u.startsWith("/")
  );
}

export function normalizePhotoSrc(url: string): string {
  const u = url.trim();
  if (u.startsWith("//")) return `https:${u}`;
  return u;
}

type Props = {
  url?: string | null;
  alt: string;
  className?: string;
  sizeClass?: string;
};

export function PcmPhoto({ url, alt, className, sizeClass = "h-40 w-40" }: Props) {
  const [failed, setFailed] = useState(false);
  const ok = isPhotoSrc(url) && !failed;

  if (!ok) {
    return (
      <div
        className={`flex ${sizeClass} items-center justify-center rounded-xl bg-slate-100 text-sm text-slate-400 ${className ?? ""}`}
      >
        No photo
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={normalizePhotoSrc(url!)}
      alt={alt}
      className={`${sizeClass} rounded-xl border border-slate-200 object-cover ${className ?? ""}`}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
    />
  );
}
