import { useState, type ReactNode } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { Button, cn } from '../../components/ui';
import { useLogout, usePlatformAdmin } from '../authentication/session';

/** Plain 24px line icons (no icon font): they take the text colour of the link. */
function Icon({ children }: { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

const ICONS = {
  dashboard: (
    <Icon>
      <rect x="3" y="3" width="7" height="9" rx="1" />
      <rect x="14" y="3" width="7" height="5" rx="1" />
      <rect x="14" y="12" width="7" height="9" rx="1" />
      <rect x="3" y="16" width="7" height="5" rx="1" />
    </Icon>
  ),
  organizations: (
    <Icon>
      <path d="M3 21h18M5 21V7l7-4 7 4v14M9 21v-6h6v6M9 10h.01M15 10h.01" />
    </Icon>
  ),
  audit: (
    <Icon>
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8zM14 3v5h5M9 13h6M9 17h6" />
    </Icon>
  ),
  settings: (
    <Icon>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
    </Icon>
  ),
};

/** Sections of the sidebar, in the order the schoolhub platform console uses them. */
const SECTIONS: {
  title: string;
  items: { to: string; label: string; icon: ReactNode; end?: boolean }[];
}[] = [
  {
    title: 'Overview',
    items: [{ to: '/platform', label: 'Dashboard', icon: ICONS.dashboard, end: true }],
  },
  {
    title: 'Platform',
    items: [
      { to: '/platform/tenants', label: 'Organizations', icon: ICONS.organizations },
      { to: '/platform/audit', label: 'Audit log', icon: ICONS.audit },
    ],
  },
  {
    title: 'Administration',
    items: [{ to: '/platform/settings', label: 'Platform settings', icon: ICONS.settings }],
  },
];

function Sidebar() {
  return (
    <>
      <div className="flex min-w-0 items-center gap-2.5 border-b border-line px-6 py-4">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-accent-600 to-brand-800 text-sm font-bold text-white shadow-sm">
          S
        </span>
        <div className="min-w-0">
          <p className="truncate text-base font-bold leading-tight">Sailix</p>
          <p className="truncate text-xs leading-tight text-muted">Platform Administration</p>
        </div>
      </div>
      <nav aria-label="Platform" className="flex-1 overflow-y-auto px-3 py-4">
        {SECTIONS.map((section, i) => (
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
                      isActive ? 'bg-accent-100 text-brand-800' : 'hover:bg-line/50',
                    )
                  }
                >
                  {({ isActive }) => (
                    <>
                      <span
                        aria-hidden="true"
                        className={cn(
                          'flex h-7 w-7 shrink-0 items-center justify-center rounded-lg',
                          isActive
                            ? 'bg-gradient-to-br from-accent-600 to-brand-800 text-white shadow-sm'
                            : 'bg-line/60 text-muted',
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

export function PlatformShell() {
  const admin = usePlatformAdmin();
  const logout = useLogout('platform');
  const { pathname } = useLocation();
  // the drawer is open for the page it was opened on, so a link tap closes it without an effect
  const [openAt, setOpenAt] = useState<string | null>(null);
  const open = openAt === pathname;
  const setOpen = (v: boolean) => setOpenAt(v ? pathname : null);

  return (
    <div className="flex min-h-screen">
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-line bg-surface lg:flex">
        <Sidebar />
      </aside>
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="fixed inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <aside className="fixed inset-y-0 left-0 flex w-64 flex-col bg-surface shadow-xl">
            <Sidebar />
          </aside>
        </div>
      )}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-line bg-surface px-4 py-3">
          <button
            type="button"
            className="rounded-md p-2 text-muted hover:bg-line/50 lg:hidden"
            aria-label="Open navigation menu"
            onClick={() => setOpen(true)}
          >
            <svg
              viewBox="0 0 24 24"
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              aria-hidden="true"
            >
              <path d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <div className="ml-auto flex items-center gap-3">
            <span className="truncate text-sm text-muted">{admin.name}</span>
            <Button variant="secondary" loading={logout.isPending} onClick={() => logout.mutate()}>
              Sign out
            </Button>
          </div>
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
