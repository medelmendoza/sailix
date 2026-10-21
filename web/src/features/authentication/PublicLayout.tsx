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
  const logo = look?.login_logo_url ?? look?.logo_url;
  const background = look?.login_background_url;
  return (
    <div
      className="relative min-h-screen overflow-hidden bg-cover bg-center"
      style={
        background
          ? {
              backgroundImage: `linear-gradient(rgba(255,255,255,.78), rgba(255,255,255,.78)), url(${background})`,
            }
          : undefined
      }
    >
      {/* soft colour behind the card, unless the organization chose its own picture */}
      {!background && (
        <>
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-gradient-to-br from-brand-50 via-page to-brand-100/70"
          />
          <div
            aria-hidden="true"
            className="float-slow absolute -left-24 -top-24 size-80 rounded-full bg-brand-600/15 blur-3xl"
          />
          <div
            aria-hidden="true"
            className="absolute -bottom-28 -right-20 size-96 rounded-full bg-accent-500/20 blur-3xl"
          />
        </>
      )}
      <main className="page-in relative mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-4 py-10">
        <div className="mb-6 text-center">
          {logo ? (
            <img src={logo} alt="" className="mx-auto mb-3 h-16 max-w-full object-contain" />
          ) : null}
          <p className="text-sm font-semibold uppercase tracking-widest text-brand-800">
            {look?.name ?? 'Sailix'}
          </p>
          {look?.tagline ? <p className="mt-1 text-sm text-muted">{look.tagline}</p> : null}
          {look?.login_welcome_message ? (
            <p className="mt-2 text-sm">{look.login_welcome_message}</p>
          ) : null}
          <h1 className="title-bar text-center mt-2 text-3xl font-bold text-brand-800">{title}</h1>
          {subtitle && <p className="mt-2 text-sm text-muted">{subtitle}</p>}
        </div>
        <div className="rounded-[var(--radius-card)] border border-line bg-surface/95 p-6 shadow-[var(--shadow-lift)] backdrop-blur">
          {children}
        </div>
      </main>
    </div>
  );
}
