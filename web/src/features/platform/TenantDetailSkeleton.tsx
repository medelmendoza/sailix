import { Link } from 'react-router-dom';
import { Card, cn, Skeleton, SkeletonDataTable, SkeletonField } from '../../components/ui';
import { AUDIT_CELLS, AUDIT_HEADERS } from '../shared/AuditTable';
import { BrandingSkeleton } from '../tenant/BrandingPage';
import { DomainsSkeleton } from '../tenant/DomainsPage';

/** The tabs of an organization's page, in order. Shared with the page's loading placeholder. */
export const TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'appearance', label: 'Appearance' },
  { key: 'features', label: 'Feature Access' },
  { key: 'domains', label: 'Domains' },
  { key: 'activity', label: 'Activity' },
  { key: 'admins', label: 'Administrators' },
] as const;

export const FEATURES_NOTE =
  'Choose which features this organization can use. Turning one off hides it in the portal and the mobile app and the server refuses it, but nothing is deleted: turning it back on restores everything. Astra, Call-it and Tala are switched under Modules, further down.';

export const ADMIN_HEADERS = ['Account', 'Email', 'Status'];

/** The administrators table while it loads. */
export function AdminsTableSkeleton() {
  return (
    <SkeletonDataTable
      caption="Administrators"
      headers={ADMIN_HEADERS}
      cells={['text', 'text', 'pill']}
      rows={3}
      label="Loading administrators"
    />
  );
}

/** The feature rows while they load: a name with its code chip, a line under it, the switch, and the save bar. */
export function FeatureRowsSkeleton() {
  return (
    <>
      <ul
        role="status"
        aria-label="Loading feature access"
        className="divide-y divide-line rounded-[var(--radius-card)] border border-line bg-surface shadow-[var(--shadow-soft)]"
      >
        {Array.from({ length: 7 }, (_, i) => (
          <li key={i} className="flex items-center justify-between gap-4 px-4 py-3.5">
            <div className="min-w-0 space-y-2">
              <div className="flex items-center gap-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 w-14" />
              </div>
              <Skeleton className="h-3.5 w-72 max-w-full" />
            </div>
            <Skeleton className="h-6 w-11 shrink-0 rounded-full" />
          </li>
        ))}
      </ul>
      <div className="flex items-center justify-between gap-3 rounded-2xl border border-line bg-surface p-3 shadow-[var(--shadow-soft)]">
        <span className="text-sm text-muted">All changes saved</span>
        <Skeleton className="h-10 w-36 rounded-full" />
      </div>
    </>
  );
}

/** The module cards while they load (a title and status, then the form of each). */
export function ModuleCardsSkeleton() {
  return (
    <div role="status" aria-label="Loading modules" className="flex flex-col gap-4">
      {Array.from({ length: 3 }, (_, i) => (
        <Card key={i}>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <Skeleton className="h-7 w-24" />
            <Skeleton className="h-5 w-24 rounded-full" />
          </div>
          <div className="flex max-w-lg flex-col gap-4">
            <Skeleton className="h-4 w-3/4" />
            <SkeletonField label="Status" />
            <Skeleton className="h-10 w-24 rounded-full" />
          </div>
        </Card>
      ))}
    </div>
  );
}

/** The Overview tab while it loads: the real form card and status card with their labels, the values shimmering. */
function OverviewSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <Card>
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="flex flex-col gap-4">
            <SkeletonField label="Name" />
            <div className="grid gap-4 sm:grid-cols-2">
              <SkeletonField label="Agency code" />
              <SkeletonField label="Address name" />
            </div>
            <SkeletonField label="Default address" />
          </div>
          <div className="flex flex-col gap-3 rounded-xl bg-brand-50 p-4">
            <h3 className="text-sm font-semibold">Branding &amp; appearance</h3>
            <Skeleton className="h-3.5 w-full" />
            <Skeleton className="h-3.5 w-2/3" />
            <Skeleton className="h-10 w-40 rounded-full" />
          </div>
          <div className="lg:col-span-2">
            <Skeleton className="h-10 w-36 rounded-full" />
          </div>
        </div>
      </Card>
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="min-w-0 space-y-2">
            <h3 className="text-sm font-semibold">Status</h3>
            <Skeleton className="h-3.5 w-96 max-w-full" />
          </div>
          <Skeleton className="h-10 w-28 rounded-full" />
        </div>
      </Card>
    </div>
  );
}

/**
 * The whole organization page while its first request runs: the back pill, the hero (avatar, name, the row of facts), the
 * real tab strip and, under it, the shape of the tab the address asks for. The known texts are real; only what comes from
 * the server shimmers.
 */
export function TenantDetailSkeleton({ tab }: { tab: string }) {
  return (
    <div
      role="status"
      aria-label="Loading organization"
      className={cn('flex flex-col gap-6', tab !== 'appearance' && 'max-w-5xl')}
    >
      <Link
        to="/platform/tenants"
        className="inline-flex w-fit items-center gap-1.5 rounded-full border border-line bg-surface px-3.5 py-1.5 text-sm font-medium transition-colors hover:border-brand-600 hover:text-brand-800"
      >
        ← Back to organizations
      </Link>
      <header className="rounded-[var(--radius-card)] border border-line bg-surface p-5 shadow-[var(--shadow-soft)]">
        <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
          <Skeleton className="size-16 shrink-0 rounded-full" />
          <div className="min-w-0 flex-1 space-y-3">
            <div className="flex items-center gap-3">
              <Skeleton className="h-9 w-64 max-w-full" />
              <Skeleton className="h-6 w-20 rounded-full" />
            </div>
            <div className="flex flex-wrap gap-x-5 gap-y-2">
              {['w-24', 'w-40', 'w-32', 'w-48'].map((w) => (
                <Skeleton key={w} className={cn('h-4', w)} />
              ))}
            </div>
          </div>
        </div>
      </header>
      <div aria-hidden="true" className="flex gap-1 overflow-x-auto border-b border-line">
        {TABS.map((x) => (
          <span
            key={x.key}
            className={cn(
              '-mb-px whitespace-nowrap border-b-2 px-4 py-3 text-base font-medium',
              tab === x.key ? 'border-brand-700 text-brand-700' : 'border-transparent text-muted',
            )}
          >
            {x.label}
          </span>
        ))}
      </div>

      <div>
        {tab === 'overview' && <OverviewSkeleton />}
        {tab === 'appearance' && <BrandingSkeleton />}
        {tab === 'features' && (
          <div className="flex flex-col gap-8">
            <section className="flex flex-col gap-4">
              <p className="text-sm text-muted">{FEATURES_NOTE}</p>
              <FeatureRowsSkeleton />
            </section>
            <section>
              <h2 className="mb-3 text-base font-semibold">Modules</h2>
              <ModuleCardsSkeleton />
            </section>
          </div>
        )}
        {tab === 'domains' && <DomainsSkeleton />}
        {tab === 'activity' && (
          <SkeletonDataTable
            caption="Audit log"
            headers={AUDIT_HEADERS}
            cells={AUDIT_CELLS}
            rows={8}
            label="Loading activity"
          />
        )}
        {tab === 'admins' && (
          <Card title="Administrators" actions={<Skeleton className="h-10 w-44 rounded-full" />}>
            <AdminsTableSkeleton />
          </Card>
        )}
      </div>
      <span className="sr-only">Loading…</span>
    </div>
  );
}
