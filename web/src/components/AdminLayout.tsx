import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { ConfirmDialog } from './ui';
import { cn } from './ui/cn';
import { ICONS } from './icons';

export interface NavSection {
  title: string;
  items: { to: string; label: string; icon: ReactNode; end?: boolean }[];
}

interface Props {
  sections: NavSection[];
  /** Name in the sidebar header, and what kind of portal this is (the line under it). */
  portalName: string;
  portalKind: string;
  logoUrl?: string | null;
  user: { name: string; role: string };
  /** The account page of the signed-in person, when there is one (the superadmin has none). */
  accountTo?: string;
  onSignOut: () => void;
  signingOut: boolean;
}

function Sidebar({ sections, portalName, portalKind, logoUrl }: Props) {
  return (
    <>
      {logoUrl ? (
        // the organization's own logo, with its name
        <div className="flex min-w-0 items-center gap-2.5 border-b border-line px-6 py-4">
          <img src={logoUrl} alt="" className="h-9 w-9 shrink-0 rounded-full object-cover" />
          <div className="min-w-0">
            <p className="truncate font-heading text-lg font-bold leading-tight" title={portalName}>
              {portalName}
            </p>
            <p className="truncate text-xs leading-tight text-muted">{portalKind}</p>
          </div>
        </div>
      ) : (
        // no logo of its own: the Sailix logo, and whose portal this is under it
        <div className="min-w-0 border-b border-line px-6 py-4">
          <img src="/sailix-logo.png" alt="Sailix" className="h-8 w-auto" />
          <p className="mt-2 truncate text-xs leading-tight text-muted">
            {portalName === 'Sailix' ? (
              portalKind
            ) : (
              <>
                <span className="font-semibold text-ink">{portalName}</span> · {portalKind}
              </>
            )}
          </p>
        </div>
      )}
      <nav aria-label="Main" className="flex-1 overflow-y-auto px-3 py-4">
        {sections.map((section, i) => (
          <div key={section.title} className={i === 0 ? '' : 'mt-5'}>
            <p className="px-3 pb-1.5 text-xs font-semibold uppercase tracking-wider text-muted">
              {section.title}
            </p>
            <div className="space-y-0.5">
              {section.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    cn(
                      'group flex min-h-10 items-center gap-2.5 rounded-xl px-2.5 py-1.5 text-sm font-medium transition',
                      isActive
                        ? 'bg-brand-50 text-brand-800 shadow-[inset_3px_0_0_var(--color-brand-700)]'
                        : 'text-ink hover:bg-brand-50/70 hover:text-brand-800',
                    )
                  }
                >
                  {({ isActive }) => (
                    <>
                      <span
                        aria-hidden="true"
                        className={cn(
                          'flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-colors',
                          isActive
                            ? 'bg-gradient-to-br from-brand-600 to-brand-800 text-white shadow-sm'
                            : 'bg-brand-50 text-brand-800 group-hover:bg-brand-100',
                        )}
                      >
                        {item.icon}
                      </span>
                      <span className="min-w-0 truncate">{item.label}</span>
                    </>
                  )}
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>
    </>
  );
}

/** The person at the top right: their name and role, and a menu with their account and Sign out (asked twice). */
function AccountMenu({
  user,
  accountTo,
  onSignOut,
  signingOut,
}: Pick<Props, 'user' | 'accountTo' | 'onSignOut' | 'signingOut'>) {
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', away);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', away);
      document.removeEventListener('keydown', esc);
    };
  }, [open]);

  const initials = user.name
    .split(/\s+/)
    .map((w) => w.charAt(0))
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <div ref={box} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Account menu, ${user.name}`}
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded-full py-1 pl-1 pr-3 transition-colors hover:bg-brand-50"
      >
        <span
          aria-hidden="true"
          className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-brand-600 to-brand-900 text-xs font-semibold text-white"
        >
          {initials}
        </span>
        <span className="hidden min-w-0 text-left sm:block">
          <span className="block max-w-40 truncate text-sm font-medium leading-tight">
            {user.name}
          </span>
          <span className="block text-xs leading-tight text-muted">{user.role}</span>
        </span>
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 z-40 mt-2 w-52 rounded-2xl border border-line bg-surface p-1.5 shadow-[var(--shadow-lift)]"
        >
          {accountTo && (
            <Link
              role="menuitem"
              to={accountTo}
              onClick={() => setOpen(false)}
              className="block rounded-xl px-3 py-2 text-sm hover:bg-brand-50"
            >
              My account
            </Link>
          )}
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              setConfirming(true);
            }}
            className="block w-full rounded-xl px-3 py-2 text-left text-sm hover:bg-brand-50"
          >
            Sign out
          </button>
        </div>
      )}
      <ConfirmDialog
        open={confirming}
        title="Sign out"
        description="Are you sure you want to sign out?"
        confirmLabel="Sign out"
        loading={signingOut}
        onConfirm={onSignOut}
        onCancel={() => setConfirming(false)}
      />
    </div>
  );
}

/**
 * The shell of both consoles (superadmin and organization admin): a light sidebar with a logo block and grouped,
 * icon-led sections; a sticky top bar with the portal's name and the account menu; a drawer below the `lg` width.
 */
export function AdminLayout(props: Props) {
  const { pathname } = useLocation();
  // the drawer is open for the page it was opened on, so a link tap closes it without an effect
  const [openAt, setOpenAt] = useState<string | null>(null);
  const open = openAt === pathname;
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 4);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <div className="flex min-h-screen">
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-line bg-surface lg:flex">
        <Sidebar {...props} />
      </aside>
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="fixed inset-0 bg-black/40" onClick={() => setOpenAt(null)} />
          <aside className="fixed inset-y-0 left-0 flex w-64 flex-col bg-surface shadow-xl">
            <Sidebar {...props} />
          </aside>
        </div>
      )}
      <div className="flex min-w-0 flex-1 flex-col">
        <header
          className={cn(
            'sticky top-0 z-30 flex items-center justify-between gap-2 border-b border-line bg-surface/90 px-4 py-3 backdrop-blur transition-shadow sm:px-6',
            scrolled && 'shadow-[0_8px_20px_-14px_rgb(15_32_54/0.35)]',
          )}
        >
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="rounded-md p-2 text-muted hover:bg-line/50 lg:hidden"
              aria-label="Open navigation menu"
              onClick={() => setOpenAt(pathname)}
            >
              <span className="block [&>svg]:h-5 [&>svg]:w-5">{ICONS.menu}</span>
            </button>
            <span className="hidden text-sm font-medium text-muted sm:inline">
              {props.portalKind}
            </span>
          </div>
          <AccountMenu
            user={props.user}
            accountTo={props.accountTo}
            onSignOut={props.onSignOut}
            signingOut={props.signingOut}
          />
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6">
          {/* keyed by the page, so its content eases in each time the route changes */}
          <div key={pathname} className="page-in">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
