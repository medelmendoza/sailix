import { AdminLayout, type NavSection } from '../../components/AdminLayout';
import { ICONS } from '../../components/icons';
import { hasFeature, useLogout, useMe } from '../authentication/session';
import { useTenantLook } from '../tenant-look/TenantLookProvider';

interface NavItem {
  to: string;
  label: string;
  icon: keyof typeof ICONS;
  /** Core feature the platform can switch off for the organization. */
  feature?: string;
  end?: boolean;
}

// The sections of the mobile app (Dashboard, Files, Announcements, Finance) plus the to-do list; Services come later.
const ITEMS: NavItem[] = [
  { to: '/portal', label: 'Dashboard', icon: 'dashboard', end: true },
  { to: '/portal/files', label: 'Files', icon: 'documents', feature: 'documents' },
  {
    to: '/portal/announcements',
    label: 'Announcements',
    icon: 'announcements',
    feature: 'announcements',
  },
  { to: '/portal/todos', label: 'To-do list', icon: 'todos', feature: 'todos' },
  { to: '/portal/finance', label: 'Finance', icon: 'finance', feature: 'finance' },
];

/** The crew's client portal: the organization's colours and logo around the member's own pages. */
export function PortalShell() {
  const me = useMe();
  const look = useTenantLook();
  const logout = useLogout('tenant', '/portal/login');

  const sections: NavSection[] = [
    {
      title: 'My portal',
      items: ITEMS.filter((i) => !i.feature || hasFeature(me, i.feature)).map((i) => ({
        to: i.to,
        label: i.label,
        icon: ICONS[i.icon],
        end: i.end,
      })),
    },
  ];

  return (
    <AdminLayout
      sections={sections}
      portalName={look?.name ?? me.tenant.name}
      portalKind="Client Portal"
      logoUrl={look?.logo_url}
      user={{ name: me.user.display_name ?? me.user.username, role: 'Crew' }}
      accountTo="/portal/account"
      onSignOut={() => logout.mutate()}
      signingOut={logout.isPending}
    />
  );
}
