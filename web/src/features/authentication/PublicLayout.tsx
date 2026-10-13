import type { ReactNode } from 'react';

export function PublicLayout({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-4 py-10">
      <div className="mb-6 text-center">
        <p className="text-sm font-semibold uppercase tracking-widest text-accent-600">Sailix</p>
        <h1 className="mt-1 text-2xl font-semibold text-brand-800">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
      </div>
      <div className="rounded-lg border border-line bg-surface p-6 shadow-sm">{children}</div>
    </main>
  );
}
