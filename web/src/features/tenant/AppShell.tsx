import { NavLink, Outlet } from 'react-router-dom';
import { Button, cn } from '../../components/ui';
import { can, useLogout, useMe } from '../authentication/session';

interface NavItem {
  to: string;
  label: string;
  ability?: string;
  end?: boolean;
}

// Menu entries follow the abilities returned by /me. This is cosmetic: the API re-checks every call.
const NAV: NavItem[] = [
  { to: '/app', label: 'Dashboard', end: true },
  { to: '/app/todos', label: 'To-dos', ability: 'todos.manage' },
  { to: '/app/announcements', label: 'Announcements', ability: 'announcements.manage' },
  { to: '/app/members', label: 'Members', ability: 'users.view' },
  { to: '/app/deletion-requests', label: 'Deletion requests', ability: 'users.manage' },
  { to: '/app/feedback', label: 'Feedback', ability: 'users.manage' },
  { to: '/app/modules', label: 'Modules', ability: 'tenant.view' },
  { to: '/app/settings', label: 'Settings', ability: 'tenant.manage' },
  { to: '/app/audit', label: 'Audit log', ability: 'audit.view' },
  { to: '/app/account', label: 'My account' },
];

export function AppShell() {
  const me = useMe();
  const logout = useLogout('tenant');
  const items = NAV.filter((i) => !i.ability || can(me, i.ability));

  return (
    <div className="min-h-screen md:grid md:grid-cols-[15rem_1fr]">
      <aside className="bg-brand-800 text-white md:min-h-screen">
        <div className="px-5 py-4">
          <p className="text-xs font-semibold uppercase tracking-widest text-accent-100">Sailix</p>
          <p className="mt-1 truncate text-sm font-medium" title={me.tenant.name}>
            {me.tenant.name}
          </p>
        </div>
        <nav aria-label="Main" className="flex gap-1 overflow-x-auto px-3 pb-3 md:flex-col md:pb-0">
          {items.map((i) => (
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
          <span className="truncate text-sm text-muted">
            {me.user.display_name ?? me.user.username}
          </span>
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
