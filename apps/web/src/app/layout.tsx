import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "NYSC Ekiti State",
  description: "Official digital platform of the National Youth Service Corps, Ekiti State",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-white text-slate-900 antialiased">
        {children}
      </body>
    </html>
  );
}
