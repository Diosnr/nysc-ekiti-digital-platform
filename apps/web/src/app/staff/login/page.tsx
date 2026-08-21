"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { setTokens } from "@/lib/staff-api";
import { PasswordField } from "@/components/PasswordField";
import { NyscLogo } from "@/components/NyscLogo";

function homeForRoles(roles: string[]): string {
  if (roles.includes("Security Officer") && roles.length === 1) {
    return "/staff/security/checkin";
  }
  if (roles.includes("Security Officer") && !roles.includes("Super Admin")) {
    return "/staff/security/checkin";
  }
  if (
    roles.some((r) => r.toLowerCase().includes("platoon officer")) &&
    !roles.some((r) => r.toLowerCase().includes("head of platoon")) &&
    !roles.some((r) => r.toLowerCase() === "super admin")
  ) {
    return "/staff/platoon";
  }
  return "/staff/dashboard";
}

export default function StaffLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Login failed");
        return;
      }
      setTokens(data.accessToken, data.refreshToken);
      router.replace(homeForRoles(data.roles ?? []));
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="mb-6 text-center">
          <div className="mx-auto flex justify-center">
            <NyscLogo size={48} />
          </div>
          <h1 className="mt-3 text-xl font-bold text-slate-900">Staff login</h1>
          <p className="mt-1 text-sm text-slate-600">NYSC Ekiti operations</p>
        </div>
        {error && (
          <p className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-semibold uppercase text-slate-500">Email</label>
            <input
              type="email"
              required
              autoComplete="username"
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <PasswordField
            id="password"
            name="password"
            label="Password"
            labelClassName="text-xs font-semibold uppercase text-slate-500"
            required
            autoComplete="current-password"
            value={password}
            onChange={setPassword}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 pr-10 text-sm"
          />
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-md bg-nysc-green px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
          >
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>
        <p className="mt-6 text-center text-xs text-slate-500">
          <Link href="/" className="text-nysc-green hover:underline">
            ← Public site
          </Link>
        </p>
      </div>
    </div>
  );
}
