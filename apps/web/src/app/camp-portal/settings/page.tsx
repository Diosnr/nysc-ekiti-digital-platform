"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getCmToken, clearCmToken, cmFetch } from "@/lib/cm-api";

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result || ""));
    r.onerror = () => reject(new Error("read failed"));
    r.readAsDataURL(file);
  });
}

export default function CmSettingsPage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [hasCustomPassword, setHasCustomPassword] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pwMsg, setPwMsg] = useState<string | null>(null);
  const [pwError, setPwError] = useState<string | null>(null);
  const [pwLoading, setPwLoading] = useState(false);

  const [photoMsg, setPhotoMsg] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [photoLoading, setPhotoLoading] = useState(false);

  useEffect(() => {
    const token = getCmToken();
    if (!token) {
      router.replace("/camp-portal/login");
      return;
    }
    cmFetch("/api/camp-portal/auth/me")
      .then(async (res) => {
        if (!res.ok) {
          clearCmToken();
          router.replace("/camp-portal/login");
          return;
        }
        const data = await res.json();
        setPhotoUrl(data.pcm?.photographUrl ?? null);
        setHasCustomPassword(Boolean(data.pcm?.hasCustomPassword));
      })
      .catch(() => {
        clearCmToken();
        router.replace("/camp-portal/login");
      })
      .finally(() => setChecking(false));
  }, [router]);

  async function onPassword(e: FormEvent) {
    e.preventDefault();
    setPwError(null);
    setPwMsg(null);
    if (newPassword !== confirmPassword) {
      setPwError("New passwords do not match");
      return;
    }
    if (newPassword.length < 6) {
      setPwError("New password must be at least 6 characters");
      return;
    }
    setPwLoading(true);
    try {
      const res = await cmFetch("/api/camp-portal/settings/password", {
        method: "POST",
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setPwError(data.error ?? "Could not update password");
        return;
      }
      setPwMsg("Password updated. Use it next time you sign in.");
      setHasCustomPassword(true);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch {
      setPwError("Network error");
    } finally {
      setPwLoading(false);
    }
  }

  async function onPhoto(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPhotoError(null);
    setPhotoMsg(null);
    const form = e.currentTarget;
    const file = (new FormData(form).get("photo") as File | null) ?? null;
    if (!file || !file.size) {
      setPhotoError("Choose a photo");
      return;
    }
    setPhotoLoading(true);
    try {
      const photoDataUrl = await fileToDataUrl(file);
      const res = await cmFetch("/api/camp-portal/settings/photo", {
        method: "POST",
        body: JSON.stringify({ photoDataUrl }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setPhotoError(data.error ?? "Upload failed");
        return;
      }
      setPhotoUrl(data.photographUrl ?? null);
      setPhotoMsg("Profile photo updated.");
      form.reset();
    } catch {
      setPhotoError("Network error");
    } finally {
      setPhotoLoading(false);
    }
  }

  if (checking) {
    return (
      <main className="mx-auto max-w-xl px-4 py-16 text-center text-sm text-slate-500">
        Loading…
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-xl px-4 py-12 sm:px-6">
      <Link
        href="/camp-portal"
        className="text-sm font-medium text-nysc-green hover:underline"
      >
        ← My Portal
      </Link>
      <h1 className="mt-4 text-2xl font-bold text-slate-900">Settings</h1>
      <p className="mt-2 text-sm text-slate-600">
        Change your portal password and profile photo.
      </p>

      <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          Profile photo
        </h2>
        <div className="mt-4 flex items-center gap-4">
          {photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={photoUrl}
              alt="Profile"
              className="h-20 w-20 rounded-full object-cover border border-slate-200"
            />
          ) : (
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-slate-100 text-slate-400 text-xs">
              No photo
            </div>
          )}
        </div>
        {photoError && (
          <p className="mt-3 text-sm text-red-600">{photoError}</p>
        )}
        {photoMsg && (
          <p className="mt-3 text-sm text-green-700">{photoMsg}</p>
        )}
        <form onSubmit={onPhoto} className="mt-4 space-y-3">
          <input
            name="photo"
            type="file"
            accept="image/*"
            required
            className="block w-full text-sm"
          />
          <button
            type="submit"
            disabled={photoLoading}
            className="rounded-md bg-nysc-green px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {photoLoading ? "Uploading…" : "Upload photo"}
          </button>
        </form>
      </section>

      <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          Change password
        </h2>
        <p className="mt-2 text-xs text-slate-500">
          {hasCustomPassword
            ? "Enter your current portal password, then choose a new one."
            : "Default password is your call-up number or state code. Set a custom password below."}
        </p>
        {pwError && (
          <p className="mt-3 text-sm text-red-600">{pwError}</p>
        )}
        {pwMsg && (
          <p className="mt-3 text-sm text-green-700">{pwMsg}</p>
        )}
        <form onSubmit={onPassword} className="mt-4 space-y-3">
          <div>
            <label className="text-xs font-semibold uppercase text-slate-500">
              Current password
            </label>
            <input
              type="password"
              required
              autoComplete="current-password"
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs font-semibold uppercase text-slate-500">
              New password
            </label>
            <input
              type="password"
              required
              minLength={6}
              autoComplete="new-password"
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs font-semibold uppercase text-slate-500">
              Confirm new password
            </label>
            <input
              type="password"ragte              required
              minLength={6}
              autoComplete="new-password"
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
          </div>
          <button
            type="submit"
            disabled={pwLoading}
            className="w-full rounded-md bg-nysc-green px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
          >
            {pwLoading ? "Saving…" : "Update password"}
          </button>
        </form>
      </section>
    </main>
  );
}
