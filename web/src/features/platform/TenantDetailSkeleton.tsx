import { Link } from 'react-router-dom';
import { Card, Skeleton, SkeletonDataTable, SkeletonField } from '../../components/ui';
import { BrandingSkeleton } from '../tenant/BrandingPage';
import { DomainsSkeleton } from '../tenant/DomainsPage';

/** The tabs of an organization's page, in order. Shared with the page's loading placeholder. */
export const TABS = [
  { key: 'admins', label: 'Administrators' },
  { key: 'address', label: 'Address and domains' },
  { key: 'branding', label: 'Branding' },
  { key: 'features', label: 'Feature access' },
  { key: 'modules', label: 'Modules' },
] as const;

export const FEATURES_NOTE =
  'A feature that is off is hidden in the portal and the mobile app, and the server refuses it. Astra, Call-it and Tala are switched under Modules.';

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

/** The rows of the feature switches while they load: a name and a line under it, a switch at the end. */
export function FeatureRowsSkeleton() {
  return (
    <Card>
      <ul role="status" aria-label="Loading feature access" className="divide-y divide-line">
        {Array.from({ length: 7 }, (_, i) => (
          <li key={i} className="flex items-center justify-between gap-4 py-3">
            <div className="min-w-0 space-y-2">
              <Skeleton className="h-4 w-36" />
              <Skeleton className="h-3.5 w-72 max-w-full" />
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Skeleton className="size-5" />
              <Skeleton className="h-4 w-6" />
            </div>
          </li>
        ))}
      </ul>
    </Card>
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

/**
 * The whole organization page while its first request runs: the back link, the header card (avatar, name, status and
 * buttons, the three facts, the tab strip) and, under it, the shape of the tab the address asks for. The known texts are
 * real; only what comes from the server shimmers.
 */
export function TenantDetailSkeleton({ tab }: { tab: string }) {
  return (
    <div role="status" aria-label="Loading organization">
      <Link
        to="/platform/tenants"
        className="mb-3 inline-block text-sm text-accent-600 hover:underline"
      >
        ← Organizations
      </Link>
      <header className="mb-4 rounded-[var(--radius-card)] border border-line bg-surface p-5 shadow-[var(--shadow-soft)]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 items-center gap-4">
            <Skeleton className="size-14 shrink-0 rounded-full" />
            <div className="min-w-0 space-y-2">
              <Skeleton className="h-8 w-64 max-w-full" />
              <Skeleton className="h-4 w-48" />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Skeleton className="h-6 w-20 rounded-full" />
            <Skeleton className="h-10 w-28 rounded-full" />
          </div>
        </div>
        <dl className="mt-4 grid gap-3 border-t border-line pt-4 text-sm sm:grid-cols-3">
          {['Created', 'Activated', 'Administrators'].map((label) => (
            <div key={label}>
              <dt className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</dt>
              <dd className="mt-1">
                <Skeleton className="h-5 w-36" />
              </dd>
            </div>
          ))}
        </dl>
        <div
          aria-hidden="true"
          className="-mb-1 mt-4 flex gap-1 overflow-x-auto border-t border-line pt-3 text-sm"
        >
          {TABS.map((x) => (
            <span
              key={x.key}
              className={`whitespace-nowrap rounded-lg px-3 py-1.5 font-medium ${
                tab === x.key ? 'bg-accent-100 text-brand-800' : 'text-muted'
              }`}
            >
              {x.label}
            </span>
          ))}
        </div>
      </header>

      <div className="flex flex-col gap-6">
        {tab === 'admins' && (
          <Card title="Administrators" actions={<Skeleton className="h-10 w-44 rounded-full" />}>
            <AdminsTableSkeleton />
          </Card>
        )}
        {tab === 'address' && (
          <section className="flex flex-col gap-3">
            <h2 className="text-base font-semibold">Address and domains</h2>
            <DomainsSkeleton />
          </section>
        )}
        {tab === 'branding' && (
          <section className="flex flex-col gap-3">
            <h2 className="text-base font-semibold">Branding</h2>
            <BrandingSkeleton />
          </section>
        )}
        {tab === 'features' && (
          <section className="flex flex-col gap-3">
            <div>
              <h2 className="text-base font-semibold">Feature access</h2>
              <p className="text-sm text-muted">{FEATURES_NOTE}</p>
            </div>
            <FeatureRowsSkeleton />
          </section>
        )}
        {tab === 'modules' && (
          <section>
            <h2 className="mb-3 text-base font-semibold">Modules</h2>
            <ModuleCardsSkeleton />
          </section>
        )}
      </div>
    </div>
  );
}
