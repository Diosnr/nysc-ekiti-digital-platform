"use client";

import { useState } from "react";

type Hit = { callUpNumber: string; fullName: string };

type Props = {
  onFound: (hit: Hit) => void;
  onClear?: () => void;
};

export function CallUpLookup({ onFound, onClear }: Props) {
  const [q, setQ] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [locked, setLocked] = useState<Hit | null>(null);

  async function search() {
    setError(null);
    if (!q.trim()) {
      setError("Enter a call-up number");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(
        `/api/public/pcm-lookup?callUp=${encodeURIComponent(q.trim())}`
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Lookup failed");
        return;
      }
      if (!data.found) {
        setError(
          "No registered PCM with that call-up number. Complete intake at camp first."
        );
        setLocked(null);
        onClear?.();
        return;
      }
      const hit = {
        callUpNumber: data.callUpNumber as string,
        fullName: data.fullName as string,
      };
      setLocked(hit);
      onFound(hit);
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  function clear() {
    setLocked(null);
    setQ("");
    setError(null);
    onClear?.();
  }

  return (
    <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
      <label className="text-xs font-semibold uppercase text-slate-500">
        Call-up number *
      </label>
      <div className="flex flex-wrap gap-2">
        <input
          className="min-w-[200px] flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm"
          value={locked ? locked.callUpNumber : q}
          onChange={(e) => {
            if (locked) return;
            setQ(e.target.value);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              if (!locked) void search();
            }
          }}
          placeholder="Search registered call-up…"
          readOnly={Boolean(locked)}
          disabled={Boolean(locked)}
        />
        {!locked ? (
          <button
            type="button"
            onClick={() => void search()}
            disabled={loading}
            className="rounded-md bg-nysc-green px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {loading ? "Searching…" : "Search"}
          </button>
        ) : (
          <button
            type="button"
            onClick={clear}
            className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium"
          >
            Change
          </button>
        )}
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {locked && (
        <div>
          <label className="text-xs font-semibold uppercase text-slate-500">
            Full name
          </label>
          <input
            className="mt-1 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-900"
            value={locked.fullName}
            readOnly
          />
        </div>
      )}
    </div>
  );
}
