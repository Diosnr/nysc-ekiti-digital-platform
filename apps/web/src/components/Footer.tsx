import Link from "next/link";

export function Footer() {
  return (
    <footer className="border-t border-slate-200 bg-slate-900 text-slate-300">
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <p className="text-lg font-semibold text-white">NYSC Ekiti State</p>
            <p className="mt-2 text-sm leading-relaxed">
              National Youth Service Corps — Ekiti State Secretariat. Serving the nation through
              structured national service.
            </p>
          </div>
          <div>
            <p className="text-sm font-semibold uppercase tracking-wider text-white">Corps members</p>
            <ul className="mt-3 space-y-2 text-sm">
              <li>
                <Link href="/camp-portal" className="hover:text-white">
                  My Portal
                </Link>
              </li>
              <li>
                <Link href="/orientation-camp" className="hover:text-white">
                  Orientation Camp
                </Link>
              </li>
              <li>
                <Link href="/faqs" className="hover:text-white">
                  FAQs
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <p className="text-sm font-semibold uppercase tracking-wider text-white">Information</p>
            <ul className="mt-3 space-y-2 text-sm">
              <li>
                <Link href="/about" className="hover:text-white">
                  About NYSC Ekiti
                </Link>
              </li>
              <li>
                <Link href="/news" className="hover:text-white">
                  News
                </Link>
              </li>
              <li>
                <Link href="/announcements" className="hover:text-white">
                  Announcements
                </Link>
              </li>
              <li>
                <Link href="/events" className="hover:text-white">
                  Events
                </Link>
              </li>
              <li>
                <Link href="/resources" className="hover:text-white">
                  Resources
                </Link>
              </li>
              <li>
                <Link href="/gallery" className="hover:text-white">
                  Gallery
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <p className="text-sm font-semibold uppercase tracking-wider text-white">Contact</p>
            <ul className="mt-3 space-y-2 text-sm">
              <li>NYSC Ekiti State Secretariat</li>
              <li>Ado-Ekiti, Ekiti State, Nigeria</li>
              <li>
                <Link href="/contact" className="hover:text-white">
                  Contact form
                </Link>
              </li>
            </ul>
          </div>
        </div>
        <div className="mt-10 border-t border-slate-700 pt-6 text-center text-xs text-slate-500">
          <p>
            © {new Date().getFullYear()} National Youth Service Corps, Ekiti State. All rights
            reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
