import { AdminLayout, type NavSection } from '../../components/AdminLayout';
import { ICONS, type IconName } from '../../components/icons';
import { can, hasFeature, useLogout, useMe } from '../authentication/session';
import { useTenantLook } from '../tenant-look/TenantLookProvider';

interface NavItem {
  to: string;
  label: string;
  icon: IconName;
  ability?: string;
  /** Core feature the platform can switch off for the organization. */
  feature?: string;
  end?: boolean;
}

// Menu entries follow the abilities returned by /me and the features the platform left on. This is cosmetic: the API
// re-checks every call.
const GROUPS: { title: string; items: NavItem[] }[] = [
  {
    title: 'Overview',
    items: [{ to: '/app', label: 'Dashboard', icon: 'dashboard', end: true }],
  },
  {
    title: 'People',
    items: [
      { to: '/app/crew', label: 'Crew', icon: 'crew', ability: 'users.view', feature: 'crew' },
      { to: '/app/members', label: 'Members', icon: 'members', ability: 'users.view' },
      {
        to: '/app/deletion-requests',
        label: 'Deletion requests',
        icon: 'deletion',
        ability: 'users.manage',
      },
    ],
  },
  {
    title: 'Documents',
    items: [
      {
        to: '/app/documents',
        label: 'Documents',
        icon: 'documents',
        ability: 'documents.manage',
        feature: 'documents',
      },
      {
        to: '/app/document-types',
        label: 'Document types',
        icon: 'docTypes',
        ability: 'documents.manage',
        feature: 'documents',
      },
    ],
  },
  {
    title: 'Communication',
    items: [
      {
        to: '/app/announcements',
        label: 'Announcements',
        icon: 'announcements',
        ability: 'announcements.manage',
        feature: 'announcements',
      },
      {
        to: '/app/todos',
        label: 'To-dos',
        icon: 'todos',
        ability: 'todos.manage',
        feature: 'todos',
      },
      {
        to: '/app/feedback',
        label: 'Feedback',
        icon: 'feedback',
        ability: 'users.manage',
        feature: 'feedback',
      },
    ],
  },
  {
    title: 'Operations',
    items: [
      {
        to: '/app/payroll-import',
        label: 'Payroll import',
        icon: 'finance',
        ability: 'finance.manage',
        feature: 'finance',
      },
      { to: '/app/callit', label: 'Call-it reports', icon: 'callit', ability: 'callit.manage' },
    ],
  },
  {
    title: 'Administration',
    items: [
      { to: '/app/modules', label: 'Modules', icon: 'modules', ability: 'tenant.view' },
      { to: '/app/settings', label: 'Settings', icon: 'settings', ability: 'tenant.manage' },
      {
        to: '/app/branding',
        label: 'Branding',
        icon: 'branding',
        ability: 'tenant.manage',
        feature: 'branding',
      },
      {
        to: '/app/domains',
        label: 'Domains',
        icon: 'domains',
        ability: 'tenant.manage',
        feature: 'branding',
      },
      { to: '/app/audit', label: 'Audit log', icon: 'audit', ability: 'audit.view' },
    ],
  },
];

export function AppShell() {
  const me = useMe();
  const look = useTenantLook();
  const logout = useLogout('tenant');

  const sections: NavSection[] = GROUPS.map((g) => ({
    title: g.title,
    items: g.items
      .filter(
        (i) => (!i.ability || can(me, i.ability)) && (!i.feature || hasFeature(me, i.feature)),
      )
      .map((i) => ({ to: i.to, label: i.label, icon: ICONS[i.icon], end: i.end })),
  })).filter((s) => s.items.length > 0);

  return (
    <AdminLayout
      sections={sections}
      portalName={look?.name ?? me.tenant.name}
      portalKind="Admin Portal"
      logoUrl={look?.logo_url}
      user={{
        name: me.user.display_name ?? me.user.username,
        role: me.membership.role === 'tenant_admin' ? 'Administrator' : 'Crew',
      }}
      accountTo="/app/account"
      onSignOut={() => logout.mutate()}
      signingOut={logout.isPending}
    />
  );
}
