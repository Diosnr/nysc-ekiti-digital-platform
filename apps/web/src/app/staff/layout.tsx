"use client";

import { StaffShell } from "@/components/staff/StaffShell";

/**
 * Persistent staff chrome — sidebar stays mounted while only main content changes.
 */
export default function StaffLayout({ children }: { children: React.ReactNode }) {
  return <StaffShell>{children}</StaffShell>;
}
