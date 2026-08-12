import Link from "next/link";

const highlights = [
  {
    title: "Orientation Camp",
    description: "Information for Prospective Corps Members on camp activities, requirements and schedules.",
    href: "/orientation-camp",
  },
  {
    title: "Announcements",
    description: "Official notices from the NYSC Ekiti State Secretariat.",
    href: "/announcements",
  },
  {
    title: "Resources",
    description: "Guides, forms and downloadable materials for PCMs and the public.",
    href: "/resources",
  },
  {
    title: "PCM Services",
    description: "Self-service entry points for Prospective and serving Corps Members.",
    href: "/pcm",
  },
];

export default function HomePage() {
  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden bg-slate-900 text-white">
        <div className="absolute inset-0 bg-gradient-to-br from-nysc-green/90 via-slate-900 to-slate-900" />
        <div className="relative mx-auto max-w-7xl px-4 py-20 sm:px-6 sm:py-28">
          <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-green-300">
            National Youth Service Corps
          </p>
          <h1 className="max-w-3xl text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
            NYSC Ekiti State
          </h1>
          <p className="mt-5 max-w-2xl text-lg text-slate-200 sm:text-xl">
            Official digital information and operations platform for Prospective Corps Members,
            Corps Members, and the public.
          </p>
          <div className="mt-8 flex flex-wrap gap-4">
            <Link
              href="/orientation-camp"
              className="rounded-md bg-white px-5 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-100"
            >
              Orientation Camp Info
            </Link>
            <Link
              href="/announcements"
              className="rounded-md border border-white/30 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
            >
              Latest Announcements
            </Link>
          </div>
        </div>
      </section>

      {/* Highlights */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <div className="mb-10 max-w-2xl">
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            What you can find here
          </h2>
          <p className="mt-3 text-slate-600">
            Institutional information, camp guidance, official notices, and progressive self-service
            for Corps Members — built around the NYSC lifecycle.
          </p>
        </div>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {highlights.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="group rounded-xl border border-slate-200 bg-white p-6 shadow-sm transition hover:border-nysc-green/40 hover:shadow-md"
            >
              <h3 className="text-lg font-semibold text-slate-900 group-hover:text-nysc-green">
                {item.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">{item.description}</p>
              <span className="mt-4 inline-block text-sm font-medium text-nysc-green">
                Learn more →
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* About teaser */}
      <section className="border-t border-slate-200 bg-slate-50">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
          <div className="grid items-center gap-10 lg:grid-cols-2">
            <div>
              <h2 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
                About NYSC Ekiti
              </h2>
              <p className="mt-4 text-slate-600 leading-relaxed">
                The National Youth Service Corps (NYSC) Ekiti State Secretariat coordinates the
                orientation and service-year activities of Corps Members deployed to Ekiti State.
                This platform supports transparent information sharing and progressive digitisation
                of operational processes.
              </p>
              <Link
                href="/about"
                className="mt-6 inline-flex rounded-md bg-nysc-green px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-nysc-green-light"
              >
                Read more about us
              </Link>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
              <p className="text-sm font-semibold uppercase tracking-wider text-nysc-green">
                For Prospective Corps Members
              </p>
              <p className="mt-3 text-slate-700 leading-relaxed">
                Prepare for orientation camp, review requirements, and access official announcements.
                Self-service intake and camp-related services will be expanded progressively on this platform.
              </p>
              <Link
                href="/pcm"
                className="mt-5 inline-block text-sm font-semibold text-nysc-green hover:underline"
              >
                Go to PCM Services →
              </Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
