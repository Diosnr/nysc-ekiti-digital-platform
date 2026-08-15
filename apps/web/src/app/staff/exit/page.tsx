"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { StaffShell } from "@/components/staff/StaffShell";

/** Legacy path — camp exit lives under E-Filing. */
export default function ExitRedirectPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/staff/e-file");
  }, [router]);
  return (
    <StaffShell>
      <p className="text-sm text-slate-600">Opening E-Filing…</p>
    </StaffShell>
  );
}
