import type { ReactNode } from 'react';
import { useTenantLook } from '../tenant-look/TenantLookProvider';

/**
 * Every page you see before signing in, in the same shape as the mobile app's sign-in: a banner across the top in the brand
 * colours (the organization's own, when the address names one) holding the logo, name, tagline and welcome message, and the
 * form in a card that rises over the banner's edge. An organization's sign-in picture fills the banner.
 */
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
    <div className="min-h-screen bg-page">
      <header
        className="relative overflow-hidden bg-gradient-to-br from-brand-900 via-brand-800 to-brand-700 bg-cover bg-center px-6 pb-28 pt-10 text-white sm:pb-32 sm:pt-14"
        style={
          background
            ? {
                backgroundImage: `linear-gradient(135deg, color-mix(in srgb, var(--color-brand-900) 80%, transparent), color-mix(in srgb, var(--color-brand-700) 65%, transparent)), url(${background})`,
              }
            : undefined
        }
      >
        <div aria-hidden="true" className="bg-dots absolute inset-0" />
        <div
          aria-hidden="true"
          className="float-slow absolute -bottom-24 -right-16 size-80 rounded-full bg-accent-500/45 blur-3xl"
        />
        <div
          aria-hidden="true"
          className="absolute -left-20 -top-24 size-72 rounded-full bg-brand-600/50 blur-3xl"
        />

        <div className="relative mx-auto max-w-md">
          <div className="inline-flex rounded-2xl bg-white p-2.5 shadow-[var(--shadow-soft)]">
            {logo ? (
              <img src={logo} alt="" className="h-12 max-w-52 object-contain" />
            ) : (
              // no logo of its own (or no organization at all): the Sailix logo
              <img src="/sailix-logo.png" alt="Sailix" className="h-12 w-auto" />
            )}
          </div>

          <div className="mt-6">
            {look?.tagline && (
              <p className="text-xs font-semibold uppercase tracking-widest text-white/75">
                {look.name}
              </p>
            )}
            <p className="mt-1 font-heading text-3xl font-bold leading-tight sm:text-4xl">
              {look ? (look.tagline ?? look.name) : 'Keeping every crew on course.'}
            </p>
            {look?.login_welcome_message ? (
              <p className="mt-3 text-sm text-white/85">{look.login_welcome_message}</p>
            ) : null}
          </div>
        </div>
      </header>

      <main className="page-in relative mx-auto -mt-20 w-full max-w-md px-4 pb-10">
        <div className="rounded-[var(--radius-card)] border border-line bg-surface p-6 shadow-[var(--shadow-lift)] sm:p-8">
          <h1 className="title-bar text-3xl font-bold text-brand-800">{title}</h1>
          {subtitle && <p className="mt-2 text-sm text-muted">{subtitle}</p>}
          <div className="mt-6">{children}</div>
        </div>
        <p className="mt-5 text-center text-xs text-muted">
          {look ? 'Powered by Sailix' : '© Sailix'}
        </p>
      </main>
    </div>
  );
}
