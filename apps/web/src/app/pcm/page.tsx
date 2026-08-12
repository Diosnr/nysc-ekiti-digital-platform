import type { Metadata } from "next";
import Link from "next/link";
import { PcmIntakeClient } from "@/components/PcmIntakeClient";

export const metadata: Metadata = {
  title: "PCM Registration",
  description: "Prospective Corps Member intake for NYSC Ekiti — scan your call-up QR or enter details.",
};

export default function PcmSelfServicePage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <p className="text-sm font-semibold uppercase tracking-wider text-nysc-green">
        Prospective Corps Members
      </p>
      <h1 className="mt-2 text-3xl font-bold text-slate-900">Ekiti intake registration</h1>
      <p className="mt-3 max-w-2xl text-slate-600">
        Scan the QR code on your NYSC call-up letter or enter your details. This process stays on the
        NYSC Ekiti platform — you are not redirected away as part of the normal flow.
      </p>

      <div className="mt-10 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <PcmIntakeClient />
      </div>

      <p className="mt-8 text-center text-sm text-slate-500">
        <Link href="/" className="text-nysc-green hover:underline">
          Back to NYSC Ekiti home
        </Link>
        {" · "}
        <Link href="/orientation-camp" className="text-nysc-green hover:underline">
          Orientation camp info
        </Link>
      </p>
    </main>
  );
}
