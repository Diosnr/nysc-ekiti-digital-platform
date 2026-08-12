"use client";

import { FormEvent, useMemo, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";

function ActivateForm() {
  const params = useSearchParams();
  const router = useRouter();
  const token = useMemo(() => params.get("token") ?? "", [params]);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (password !== confirm) {
      setError("Passwords do not match");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/activate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password, name: name || undefined, phone: phone || undefined }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Activation failed");
        return;
      }
      setDone(true);
      setTimeout(() => router.push("/staff/login"), 2000);
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  if (!token) {
    return (
      <p className="text-sm text-red-600">
        Missing activation token. Use the link sent by your administrator.
      </p>
    );
  }

  if (done) {
    return (
      <p className="text-sm text-green-800">
        Account activated. Redirecting to login…
      </p>
    );
  }

  return (
    <form onSubmit={onSubmit} className="mt-6 space-y-4">
      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}
      <input
        type="text"
        placeholder="Full name"
        className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <input
        type="tel"
        placeholder="Phone (for WhatsApp notifications later)"
        className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
      />
      <input
        type="password"
        required
        placeholder="New password (min 8 characters)"
        className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      <input
        type="password"
        required
        placeholder="Confirm password"
        className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
        value={confirm}
        onChange={(e) => setConfirm(e.target.value)}
      />
      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-md bg-nysc-green px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
      >
        {loading ? "Activating…" : "Activate account"}
      </button>
    </form>
  );
}

export default function ActivatePage() {
  return (
    <main className="flex min-h-[70vh] items-center justify-center px-4 py-16">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-wider text-nysc-green">
          Officer activation
        </p>
        <h1 className="mt-2 text-2xl font-bold text-slate-900">Complete your profile</h1>
        <p className="mt-2 text-sm text-slate-600">
          Set your password to activate your NYSC Ekiti staff account.
        </p>
        <Suspense fallback={<p className="mt-6 text-sm text-slate-500">Loading…</p>}>
          <ActivateForm />
        </Suspense>
        <p className="mt-6 text-center text-xs text-slate-500">
          <Link href="/staff/login" className="text-nysc-green hover:underline">
            Back to login
          </Link>
        </p>
      </div>
    </main>
  );
}
