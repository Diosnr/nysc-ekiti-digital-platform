import Link from "next/link";
import { HomeNewsStrip } from "@/components/HomeNewsStrip";

const campCards = [
  {
    title: "Nursing / Pregnant women",
    description:
      "Declare nursing or pregnancy status and capture husband’s address for posting consideration.",
    href: "/camp-portal/nursing-pregnant",
  },
  {
    title: "Skills",
    description: "Register up to three skills for camp and service-year programmes.",
    href: "/camp-portal/skills",
  },
  {
    title: "Account (NIN)",
    description: "Upload NIN card images linked to your call-up number.",
    href: "/camp-portal/account",
  },
];

export default function HomePage() {
  return (
    <>
      <section className="relative overflow-hidden bg-slate-900 text-white">
        <div className="absolute inset-0 bg-gradient-to-br from-nysc-green/90 via-slate-900 to-slate-900" />
        <div className="relative mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-28">
          <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-green-300">
            National Youth Service Corps
          </p>
          <h1 className="max-w-3xl text-4xl font-bold tracking-tight sm:text-5xl">
            NYSC Ekiti State
          </h1>
          <p className="mt-5 max-w-2xl text-lg text-slate-200">
            Official digital platform for orientation camp services, Prospective Corps Members, and
            secretariat operations.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/camp-portal/nursing-pregnant"
              className="rounded-md bg-white px-5 py-3 text-sm font-semibold text-slate-900 hover:bg-slate-100"
            >
              Open Camp Portal
            </Link>
            <Link
              href="/staff/login"
              className="rounded-md border border-white/30 px-5 py-3 text-sm font-semibold text-white hover:bg-white/10"
            >
              Staff Login
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <div className="mb-10 max-w-2xl">
          <h2 className="text-2xl font-bold text-slate-900 sm:text-3xl">Camp Portal</h2>
          <p className="mt-3 text-slate-600">
            Complete these forms with your call-up number so submissions stay linked to your record.
          </p>
        </div>
        <div className="grid gap-6 sm:grid-cols-3">
          {campCards.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="group rounded-xl border border-slate-200 bg-white p-6 shadow-sm transition hover:border-nysc-green/40 hover:shadow-md"
            >
              <h3 className="text-lg font-semibold text-slate-900 group-hover:text-nysc-green">
                {item.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">{item.description}</p>
              <span className="mt-4 inline-block text-sm font-medium text-nysc-green">Open →</span>
            </Link>
          ))}
        </div>
      </section>

      <HomeNewsStrip />

      <section className="border-t border-slate-200 bg-slate-50">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <div className="grid items-center gap-10 lg:grid-cols-2">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">About NYSC Ekiti</h2>
              <p className="mt-4 leading-relaxed text-slate-600">
                The NYSC Ekiti State Secretariat coordinates orientation and service-year activities
                for Corps Members deployed to Ekiti. This platform supports camp services and staff
                operations.
              </p>
              <Link
                href="/about"
                className="mt-6 inline-flex rounded-md bg-nysc-green px-4 py-2.5 text-sm font-semibold text-white hover:bg-nysc-green-light"
              >
                Read more
              </Link>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
              <p className="text-sm font-semibold uppercase tracking-wider text-nysc-green">
                Orientation camp
              </p>
              <p className="mt-3 leading-relaxed text-slate-700">
                Find camp guidance, announcements, and FAQs in the information section of the footer.
                Staff handle call-up intake at the secretariat / camp.
              </p>
              <Link
                href="/orientation-camp"
                className="mt-5 inline-block text-sm font-semibold text-nysc-green hover:underline"
              >
                Orientation camp info →
              </Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
