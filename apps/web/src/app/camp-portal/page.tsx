"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { clearCmToken, cmFetch, ensureCmSessionActive } from "@/lib/cm-api";

type Pcm = {
  id: string;
  callUpNumber: string;
  fullName: string;
  stateCode: string | null;
  photographUrl?: string | null;
};

const ITEMS = [
  {
    href: "/camp-portal/nursing-pregnant",
    label: "Special Status",
    desc: "Pregnant, nursing, married, or single mother",
  },
  {
    href: "/camp-portal/skills",
    label: "Skills",
    desc: "Declare up to 3 skills",
  },
  {
    href: "/camp-portal/account",
    label: "NIN / Account",
    desc: "Upload NIN card images",
  },
];

export default function CampPortalDashboard() {
  const router = useRouter();
  const [pcm, setPcm] = useState<Pcm | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!ensureCmSessionActive()) {
      clearCmToken();
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
        setPcm(data.pcm);
      })
      .catch(() => {
        clearCmToken();
        router.replace("/camp-portal/login");
      })
      .finally(() => setLoading(false));
  }, [router]);

  if (loading) {
    return (
      <main className="mx-auto max-w-xl px-4 py-16 text-center text-sm text-slate-500">
        Loading…
      </main>
    );
  }

  if (!pcm) return null;

  return (
    <main className="mx-auto max-w-xl px-4 py-12 sm:px-6">
      <div className="flex gap-3">
        {pcm.photographUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={pcm.photographUrl}
            alt=""
            className="h-14 w-14 rounded-full object-cover border border-slate-200"
          />
        ) : (
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-sm font-bold text-slate-500">
            {pcm.fullName.slice(0, 1)}
          </div>
        )}
        <div>
          <h1 className="text-2xl font-bold text-slate-900">My Portal</h1>
          <p className="mt-0.5 text-sm text-slate-600">{pcm.fullName}</p>
          <p className="text-xs text-slate-500">
            {pcm.callUpNumber}
            {pcm.stateCode ? ` · ${pcm.stateCode}` : ""}
          </p>
        </div>
      </div>

      <div className="mt-8 space-y-3">
        {ITEMS.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="block rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-nysc-green hover:bg-green-50/40"
          >
            <div className="text-base font-semibold text-slate-900">{item.label}</div>
            <div className="mt-0.5 text-sm text-slate-500">{item.desc}</div>
          </Link>
        ))}
      </div>
    </main>
  );
}
