import { ChevronDown } from 'lucide-react';
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

/** Whose portal this is: the organization's own logo and name, or the Sailix logo with the name under it. */
function Brand({
  portalName,
  portalKind,
  logoUrl,
  bar,
}: Pick<Props, 'portalName' | 'portalKind' | 'logoUrl'> & {
  /** Drawn in the top bar (one row, no border) instead of at the top of the side menu. */
  bar?: boolean;
}) {
  return logoUrl ? (
    // the organization's own logo, with its name
    <div
      className={cn('flex min-w-0 items-center gap-2.5', !bar && 'border-b border-line px-6 py-4')}
    >
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
    <div className={cn('min-w-0', !bar && 'border-b border-line px-6 py-4')}>
      <img src="/sailix-logo.png" alt="Sailix" className="h-8 w-auto" />
      <p className={cn('truncate text-xs leading-tight text-muted', bar ? 'mt-0.5' : 'mt-2')}>
        {portalName === 'Sailix' ? (
          portalKind
        ) : (
          <>
            <span className="font-semibold text-ink">{portalName}</span> · {portalKind}
          </>
        )}
      </p>
    </div>
  );
}

function Sidebar({ sections, portalName, portalKind, logoUrl }: Props) {
  return (
    <>
      <Brand portalName={portalName} portalKind={portalKind} logoUrl={logoUrl} />
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

export type MenuPlace = 'top' | 'side';
const PLACE_KEY = 'sailix.menu';

/** Where the menu is: along the top (the default) or at the side. Remembered in this browser only. */
function useMenuPlace(): [MenuPlace, (p: MenuPlace) => void] {
  const [place, setPlace] = useState<MenuPlace>(() => {
    try {
      return localStorage.getItem(PLACE_KEY) === 'side' ? 'side' : 'top';
    } catch {
      return 'top';
    }
  });
  const change = (p: MenuPlace) => {
    setPlace(p);
    try {
      localStorage.setItem(PLACE_KEY, p);
    } catch {
      /* storage blocked: it just is not remembered */
    }
  };
  return [place, change];
}

/**
 * The menu along the top bar. A section with one page is a plain link; a section with several is a button that opens its pages
 * in a panel under it. The panels stay in the page and are only hidden, so every link is always there for the keyboard and
 * for screen readers once the panel is opened.
 */
function TopNav({ sections }: { sections: NavSection[] }) {
  const { pathname } = useLocation();
  // open for the page it was opened on, so choosing a link closes it without an effect
  const [openAt, setOpenAt] = useState<{ key: string; path: string } | null>(null);
  const openKey = openAt && openAt.path === pathname ? openAt.key : null;
  const box = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!openKey) return;
    const away = (e: MouseEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpenAt(null);
    };
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpenAt(null);
    document.addEventListener('mousedown', away);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', away);
      document.removeEventListener('keydown', esc);
    };
  }, [openKey]);

  const here = (i: { to: string; end?: boolean }) =>
    i.end ? pathname === i.to : pathname === i.to || pathname.startsWith(`${i.to}/`);
  const pill = (active: boolean) =>
    cn(
      'inline-flex min-h-10 items-center gap-2 whitespace-nowrap rounded-full px-3.5 text-sm font-medium transition-colors',
      active ? 'bg-brand-50 text-brand-800' : 'text-ink hover:bg-brand-50/70 hover:text-brand-800',
    );

  return (
    <nav ref={box} aria-label="Main" className="hidden min-w-0 flex-1 items-center gap-1 xl:flex">
      {sections.map((section) => {
        const single = section.items.length === 1 ? section.items[0] : null;
        if (single) {
          return (
            <NavLink
              key={section.title}
              to={single.to}
              end={single.end}
              className={({ isActive }) => pill(isActive)}
            >
              <span aria-hidden="true" className="[&>svg]:h-4 [&>svg]:w-4">
                {single.icon}
              </span>
              {single.label}
            </NavLink>
          );
        }
        const active = section.items.some(here);
        const open = openKey === section.title;
        return (
          <div key={section.title} className="relative">
            <button
              type="button"
              aria-haspopup="true"
              aria-expanded={open}
              onClick={() => setOpenAt(open ? null : { key: section.title, path: pathname })}
              className={pill(active || open)}
            >
              {section.title}
              <ChevronDown
                aria-hidden="true"
                className={cn('size-4 transition-transform', open && 'rotate-180')}
              />
            </button>
            <div
              className={cn(
                'absolute left-0 top-full z-40 mt-2 w-60 rounded-2xl border border-line bg-surface p-1.5 shadow-[var(--shadow-lift)] transition',
                open ? 'visible translate-y-0 opacity-100' : 'invisible -translate-y-1 opacity-0',
              )}
            >
              {section.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    cn(
                      'flex min-h-10 items-center gap-2.5 rounded-xl px-2.5 py-1.5 text-sm font-medium transition-colors',
                      isActive
                        ? 'bg-brand-50 text-brand-800'
                        : 'text-ink hover:bg-brand-50/70 hover:text-brand-800',
                    )
                  }
                >
                  <span
                    aria-hidden="true"
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-800"
                  >
                    {item.icon}
                  </span>
                  <span className="min-w-0 truncate">{item.label}</span>
                </NavLink>
              ))}
            </div>
          </div>
        );
      })}
    </nav>
  );
}

/** The person at the top right: their name and role, and a menu with their account and Sign out (asked twice). */
function AccountMenu({
  user,
  accountTo,
  onSignOut,
  signingOut,
  place,
  onPlace,
}: Pick<Props, 'user' | 'accountTo' | 'onSignOut' | 'signingOut'> & {
  place: MenuPlace;
  onPlace: (p: MenuPlace) => void;
}) {
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
              onPlace(place === 'top' ? 'side' : 'top');
            }}
            className="hidden w-full rounded-xl px-3 py-2 text-left text-sm hover:bg-brand-50 xl:block"
          >
            {place === 'top' ? 'Show the menu at the side' : 'Show the menu at the top'}
          </button>
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
  const [place, setPlace] = useMenuPlace();
  const top = place === 'top';

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 4);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const account = (
    <AccountMenu
      user={props.user}
      accountTo={props.accountTo}
      onSignOut={props.onSignOut}
      signingOut={props.signingOut}
      place={place}
      onPlace={setPlace}
    />
  );
  // the menu along the top needs the room of a wide window (xl); the side menu needs less (lg)
  const burger = (
    <button
      type="button"
      className={cn('rounded-md p-2 text-muted hover:bg-line/50', top ? 'xl:hidden' : 'lg:hidden')}
      aria-label="Open navigation menu"
      onClick={() => setOpenAt(pathname)}
    >
      <span className="block [&>svg]:h-5 [&>svg]:w-5">{ICONS.menu}</span>
    </button>
  );
  const shadow = scrolled && 'shadow-[0_8px_20px_-14px_rgb(15_32_54/0.35)]';

  return (
    <div className={cn('flex min-h-screen', top && 'flex-col')}>
      {!top && (
        <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-line bg-surface lg:flex">
          <Sidebar {...props} />
        </aside>
      )}
      {open && (
        <div className={cn('fixed inset-0 z-40', top ? 'xl:hidden' : 'lg:hidden')}>
          <div className="fixed inset-0 bg-black/40" onClick={() => setOpenAt(null)} />
          <aside className="fixed inset-y-0 left-0 flex w-64 flex-col bg-surface shadow-xl">
            <Sidebar {...props} />
          </aside>
        </div>
      )}
      <div className="flex min-w-0 flex-1 flex-col">
        {top ? (
          <header
            className={cn(
              'sticky top-0 z-30 flex items-center gap-3 border-b border-line bg-surface/95 px-4 py-2.5 backdrop-blur transition-shadow sm:px-6',
              shadow,
            )}
          >
            {burger}
            <div className="shrink-0 xl:pr-4">
              <Brand
                portalName={props.portalName}
                portalKind={props.portalKind}
                logoUrl={props.logoUrl}
                bar
              />
            </div>
            <TopNav sections={props.sections} />
            <div className="ml-auto xl:ml-0">{account}</div>
          </header>
        ) : (
          <header
            className={cn(
              'sticky top-0 z-30 flex items-center justify-between gap-2 border-b border-line bg-surface/90 px-4 py-3 backdrop-blur transition-shadow sm:px-6',
              shadow,
            )}
          >
            <div className="flex items-center gap-2">
              {burger}
              <span className="hidden text-sm font-medium text-muted sm:inline">
                {props.portalKind}
              </span>
            </div>
            {account}
          </header>
        )}
        <main className="min-w-0 w-full flex-1 p-[var(--page-pad)]">
          {/* keyed by the page, so its content eases in each time the route changes */}
          <div key={pathname} className="page-in">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
