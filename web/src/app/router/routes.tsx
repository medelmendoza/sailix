import { Navigate } from 'react-router-dom';
import type { RouteObject } from 'react-router-dom';
import type { ReactNode } from 'react';
import { ForgotPasswordPage } from '../../features/authentication/ForgotPasswordPage';
import { LoginPage } from '../../features/authentication/LoginPage';
import { PlatformLoginPage } from '../../features/authentication/PlatformLoginPage';
import { can, RequirePlatform, RequireTenant, useMe } from '../../features/authentication/session';
import { TokenPasswordPage } from '../../features/authentication/TokenPasswordPage';
import { PlatformShell } from '../../features/platform/PlatformShell';
import { AccountPage } from '../../features/tenant/AccountPage';
import { AppShell } from '../../features/tenant/AppShell';
import { AuditPage } from '../../features/tenant/AuditPage';
import { DashboardPage } from '../../features/tenant/DashboardPage';
import { TodosPage } from '../../features/tenant/TodosPage';
import { AnnouncementsPage } from '../../features/tenant/AnnouncementsPage';
import { DeletionRequestsPage } from '../../features/tenant/DeletionRequestsPage';
import { FeedbackPage } from '../../features/tenant/FeedbackPage';
import { MembersPage } from '../../features/tenant/MembersPage';
import { ModulesPage } from '../../features/tenant/ModulesPage';
import { SettingsPage } from '../../features/tenant/SettingsPage';
import { ForbiddenPage, NotFoundPage } from './NotFound';

/** Route-level ability check. Cosmetic: the API enforces every ability on each request regardless. */
function RequireAbility({ ability, children }: { ability: string; children: ReactNode }) {
  const me = useMe();
  return can(me, ability) ? children : <ForbiddenPage />;
}

const guard = (ability: string, element: ReactNode) => (
  <RequireAbility ability={ability}>{element}</RequireAbility>
);

// Superadmin pages are split into their own chunks: they are never downloaded for a tenant session.
const platformPage = <K extends string>(
  load: () => Promise<Record<K, () => ReactNode>>,
  name: K,
) => ({
  lazy: async () => ({ Component: (await load())[name] }),
});

export const routes: RouteObject[] = [
  { path: '/', element: <Navigate to="/app" replace /> },
  { path: '/login', element: <LoginPage /> },
  { path: '/forgot-password', element: <ForgotPasswordPage /> },
  { path: '/reset-password', element: <TokenPasswordPage kind="reset" /> },
  { path: '/accept-invitation', element: <TokenPasswordPage kind="invitation" /> },
  { path: '/platform/login', element: <PlatformLoginPage /> },
  {
    path: '/app',
    element: (
      <RequireTenant>
        <AppShell />
      </RequireTenant>
    ),
    children: [
      { index: true, element: <DashboardPage /> },
      { path: 'members', element: guard('users.view', <MembersPage />) },
      { path: 'deletion-requests', element: guard('users.manage', <DeletionRequestsPage />) },
      { path: 'todos', element: guard('todos.manage', <TodosPage />) },
      { path: 'announcements', element: guard('announcements.manage', <AnnouncementsPage />) },
      { path: 'feedback', element: guard('users.manage', <FeedbackPage />) },
      { path: 'modules', element: guard('tenant.view', <ModulesPage />) },
      { path: 'settings', element: guard('tenant.manage', <SettingsPage />) },
      { path: 'audit', element: guard('audit.view', <AuditPage />) },
      { path: 'account', element: <AccountPage /> },
    ],
  },
  {
    path: '/platform',
    element: (
      <RequirePlatform>
        <PlatformShell />
      </RequirePlatform>
    ),
    children: [
      {
        index: true,
        ...platformPage(
          () => import('../../features/platform/PlatformDashboardPage'),
          'PlatformDashboardPage',
        ),
      },
      {
        path: 'tenants',
        ...platformPage(() => import('../../features/platform/TenantsPage'), 'TenantsPage'),
      },
      {
        path: 'tenants/:id',
        ...platformPage(
          () => import('../../features/platform/TenantDetailPage'),
          'TenantDetailPage',
        ),
      },
      {
        path: 'settings',
        ...platformPage(
          () => import('../../features/platform/PlatformSettingsPage'),
          'PlatformSettingsPage',
        ),
      },
      {
        path: 'audit',
        ...platformPage(
          () => import('../../features/platform/PlatformAuditPage'),
          'PlatformAuditPage',
        ),
      },
    ],
  },
  { path: '*', element: <NotFoundPage /> },
];
