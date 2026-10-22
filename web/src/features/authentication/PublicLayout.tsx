import type { ReactNode } from 'react';
import { useTenantLook } from '../tenant-look/TenantLookProvider';

/**
 * The page every signed-out screen sits in: a quiet grey page, the logo, a small eyebrow and a bold title, then one white
 * card. The submit button of the form inside is a full-width pill. An organization's own picture, logo, colours, tagline
 * and welcome message still apply.
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
    <div
      className="relative min-h-screen overflow-hidden bg-page bg-cover bg-center"
      style={
        background
          ? {
              backgroundImage: `linear-gradient(rgba(255,255,255,.82), rgba(255,255,255,.82)), url(${background})`,
            }
          : undefined
      }
    >
      <main className="page-in relative mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-4 py-10">
        <div className="mb-7 text-center">
          {logo ? (
            <img src={logo} alt="" className="mx-auto mb-5 h-14 max-w-full object-contain" />
          ) : (
            // no logo of its own (or no organization at all): the Sailix logo
            <img src="/sailix-logo.png" alt="Sailix" className="mx-auto mb-5 h-12 w-auto" />
          )}
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-muted">
            {look ? look.name : 'Welcome back'}
          </p>
          <h1 className="title-bar mt-2 text-center text-4xl font-bold text-ink">{title}</h1>
          {look?.tagline ? <p className="mt-2 text-sm text-muted">{look.tagline}</p> : null}
          {look?.login_welcome_message ? (
            <p className="mt-2 text-sm">{look.login_welcome_message}</p>
          ) : null}
          {subtitle && <p className="mt-2 text-sm text-muted">{subtitle}</p>}
        </div>
        <div className="rounded-3xl border border-line/60 bg-surface p-7 shadow-[var(--shadow-lift)] [&_button[type=submit]]:w-full [&_button[type=submit]]:rounded-full [&_button[type=submit]]:py-2.5">
          {children}
        </div>
      </main>
    </div>
  );
}
