type PageHeroProps = {
  title: string;
  subtitle?: string;
  breadcrumb?: string;
};

export function PageHero({ title, subtitle, breadcrumb }: PageHeroProps) {
  return (
    <section className="border-b border-slate-200 bg-gradient-to-br from-slate-50 to-green-50">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16">
        {breadcrumb && (
          <p className="mb-2 text-sm font-medium text-nysc-green">{breadcrumb}</p>
        )}
        <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">{title}</h1>
        {subtitle && (
          <p className="mt-3 max-w-2xl text-lg text-slate-600">{subtitle}</p>
        )}
      </div>
    </section>
  );
}
