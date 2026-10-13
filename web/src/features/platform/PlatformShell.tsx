import { NavLink, Outlet } from 'react-router-dom';
import { Button, cn } from '../../components/ui';
import { useLogout, usePlatformAdmin } from '../authentication/session';

const NAV = [
  { to: '/platform', label: 'Dashboard', end: true },
  { to: '/platform/tenants', label: 'Organizations' },
  { to: '/platform/settings', label: 'Platform settings' },
  { to: '/platform/audit', label: 'Audit log' },
];

export function PlatformShell() {
  const admin = usePlatformAdmin();
  const logout = useLogout('platform');

  return (
    <div className="min-h-screen md:grid md:grid-cols-[15rem_1fr]">
      <aside className="bg-brand-900 text-white md:min-h-screen">
        <div className="px-5 py-4">
          <p className="text-xs font-semibold uppercase tracking-widest text-accent-100">Sailix</p>
          <p className="mt-1 text-sm font-medium">Platform administration</p>
        </div>
        <nav
          aria-label="Platform"
          className="flex gap-1 overflow-x-auto px-3 pb-3 md:flex-col md:pb-0"
        >
          {NAV.map((i) => (
            <NavLink
              key={i.to}
              to={i.to}
              end={i.end}
              className={({ isActive }) =>
                cn(
                  'whitespace-nowrap rounded-md px-3 py-2 text-sm',
                  isActive ? 'bg-white/15 font-medium' : 'text-white/80 hover:bg-white/10',
                )
              }
            >
              {i.label}
            </NavLink>
          ))}
        </nav>
      </aside>
      <div className="flex min-w-0 flex-col">
        <header className="flex items-center justify-end gap-3 border-b border-line bg-surface px-4 py-3">
          <span className="truncate text-sm text-muted">{admin.name}</span>
          <Button variant="secondary" loading={logout.isPending} onClick={() => logout.mutate()}>
            Sign out
          </Button>
        </header>
        <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
