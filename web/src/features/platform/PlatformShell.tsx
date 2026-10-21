import { AdminLayout, type NavSection } from '../../components/AdminLayout';
import { ICONS } from '../../components/icons';
import { useLogout, usePlatformAdmin } from '../authentication/session';

const SECTIONS: NavSection[] = [
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

export function PlatformShell() {
  const admin = usePlatformAdmin();
  const logout = useLogout('platform');
  return (
    <AdminLayout
      sections={SECTIONS}
      portalName="Sailix"
      portalKind="Platform Administration"
      user={{ name: admin.name, role: 'Superadmin' }}
      onSignOut={() => logout.mutate()}
      signingOut={logout.isPending}
    />
  );
}
