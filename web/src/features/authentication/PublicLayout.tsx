import type { ReactNode } from 'react';
import { useTenantLook } from '../tenant-look/TenantLookProvider';

export function PublicLayout({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  const look = useTenantLook();
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-4 py-10">
      <div className="mb-6 text-center">
        {look?.logo_url ? (
          <img src={look.logo_url} alt="" className="mx-auto mb-3 h-16 max-w-full object-contain" />
        ) : null}
        <p className="text-sm font-semibold uppercase tracking-widest text-accent-600">
          {look?.name ?? 'Sailix'}
        </p>
        {look?.tagline ? <p className="mt-1 text-sm text-muted">{look.tagline}</p> : null}
        <h1 className="mt-1 text-2xl font-semibold text-brand-800">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
      </div>
      <div className="rounded-lg border border-line bg-surface p-6 shadow-sm">{children}</div>
    </main>
  );
}
