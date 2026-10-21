import { Link } from 'react-router-dom';
import { Button, Card, ErrorState, PageHero, SkeletonTable } from '../../components/ui';
import { usePlatformAdmin } from '../authentication/session';
import { describeError } from '../../services/api/errors';
import { AuditTable } from '../shared/AuditTable';
import { usePlatformAudit } from './api';
import { StatusBreakdown } from './StatusBreakdown';
import { TenantSummary } from './TenantSummary';

export function PlatformDashboardPage() {
  const admin = usePlatformAdmin();
  const audit = usePlatformAudit({ per_page: 8 });
  return (
    <>
      <PageHero
        eyebrow="Platform administration"
        title={`Welcome back, ${admin.name.split(' ')[0]}`}
        description="Organizations on the platform, and what happened lately."
        actions={
          <Link to="/platform/tenants">
            <Button variant="secondary">Manage organizations</Button>
          </Link>
        }
      />
      <TenantSummary />
      <div className="mb-6 grid gap-4 lg:grid-cols-2">
        <StatusBreakdown />
        <Card title="Where to next">
          <ul className="divide-y divide-line text-sm">
            {[
              [
                '/platform/tenants',
                'Organizations',
                'Create one, open it, switch features and modules on or off.',
              ],
              [
                '/platform/audit',
                'Audit log',
                'Every security and administrative event, filterable.',
              ],
              ['/platform/settings', 'Platform settings', 'Defaults for every organization.'],
            ].map(([to, title, text]) => (
              <li key={to}>
                <Link
                  to={to!}
                  className="flex items-start justify-between gap-3 py-3 transition-colors hover:text-brand-700"
                >
                  <span>
                    <span className="block font-medium">{title}</span>
                    <span className="block text-muted">{text}</span>
                  </span>
                  <span aria-hidden="true" className="pt-0.5 text-muted">
                    ›
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      </div>
      <section>
        <h2 className="mb-3 text-lg font-bold">Recent platform activity</h2>
        {audit.isPending ? (
          <SkeletonTable columns={4} rows={5} label="Loading activity" />
        ) : audit.isError ? (
          <ErrorState message={describeError(audit.error)} onRetry={() => void audit.refetch()} />
        ) : (
          <AuditTable entries={audit.data.data} />
        )}
      </section>
    </>
  );
}
