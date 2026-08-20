"use client";

import { usePathname } from "next/navigation";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";

/** Public site chrome — hidden on /staff/*; footer hidden on /camp-portal/* */
export function ConditionalChrome({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname() || "";
  const isStaff = pathname.startsWith("/staff");
  const isCampPortal = pathname.startsWith("/camp-portal");

  if (isStaff) {
    return <>{children}</>;
  }

  return (
    <>
      <Header />
      <div className="flex-1">{children}</div>
      {!isCampPortal && <Footer />}
    </>
  );
}
