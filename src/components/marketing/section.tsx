export function Section({
  id,
  title,
  subtitle,
  children,
}: {
  id?: string;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
      <div className="max-w-2xl">
        <h2 className="text-2xl font-semibold tracking-tight text-neutral-900 sm:text-3xl">{title}</h2>
        {subtitle ? (
          <p className="mt-3 text-base leading-relaxed text-neutral-600 sm:text-lg">{subtitle}</p>
        ) : null}
      </div>
      <div className="mt-10">{children}</div>
    </section>
  );
}
