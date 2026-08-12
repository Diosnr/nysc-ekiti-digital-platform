import type { Metadata } from "next";
import { PageHero } from "@/components/PageHero";

export const metadata: Metadata = {
  title: "FAQs",
};

const faqs = [
  {
    q: "What is this website?",
    a: "This is the official digital information and operations platform for NYSC Ekiti State. It provides public information and will progressively offer self-service and operational tools around the Corps Member lifecycle.",
  },
  {
    q: "Where can I find orientation camp information?",
    a: "See the Orientation Camp page and monitor Announcements and News for official notices, dates and requirements.",
  },
  {
    q: "Can I complete camp registration online?",
    a: "Digital intake and camp workflows are being introduced in phases. Follow official announcements for what is currently available to Prospective Corps Members.",
  },
  {
    q: "How do I contact the State Secretariat?",
    a: "Use the Contact page for published contact details and the contact form when available.",
  },
  {
    q: "Is this a file-sharing portal?",
    a: "No. The platform is designed around institutional information and digitised NYSC processes (intake, camp operations, service-year workflows), not as a generic document repository.",
  },
];

export default function FaqsPage() {
  return (
    <>
      <PageHero
        breadcrumb="FAQs"
        title="Frequently Asked Questions"
        subtitle="Common questions about NYSC Ekiti and this platform."
      />
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <div className="space-y-4">
          {faqs.map((item) => (
            <details
              key={item.q}
              className="group rounded-xl border border-slate-200 bg-white p-5 shadow-sm open:ring-1 open:ring-nysc-green/20"
            >
              <summary className="cursor-pointer list-none font-semibold text-slate-900">
                {item.q}
              </summary>
              <p className="mt-3 text-slate-600 leading-relaxed">{item.a}</p>
            </details>
          ))}
        </div>
      </div>
    </>
  );
}
