import { CalendarDays, Globe, Hash, Users } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { cn, ErrorState, ProfileTabs, StatusBadge } from '../../components/ui';
import { toApiError } from '../../services/api/errors';
import { platformScope } from '../tenant/api';
import { BrandingEditor } from '../tenant/BrandingPage';
import { DomainsEditor } from '../tenant/DomainsPage';
import { formatDateTime } from '../shared/AuditTable';
import { describeError, useTenantAdmins, useTenantById } from './api';
import { TenantActivityTab } from './TenantActivityTab';
import { TenantAdminsTab } from './TenantAdminsTab';
import { TABS, TenantDetailSkeleton } from './TenantDetailSkeleton';
import { TenantFeaturesTab } from './TenantFeaturesTab';
import { TenantOverviewTab } from './TenantOverviewTab';

/** One fact in the hero's row: a small icon and the text. */
function Fact({ icon, children, mono }: { icon: ReactNode; children: ReactNode; mono?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-sm text-muted">
      <span aria-hidden="true" className="text-brand-700">
        {icon}
      </span>
      <span className={mono ? 'font-mono text-xs' : undefined}>{children}</span>
    </span>
  );
}

const BACK_PILL =
  'inline-flex w-fit items-center gap-1.5 rounded-full border border-line bg-surface px-3.5 py-1.5 text-sm font-medium transition-colors hover:border-brand-600 hover:text-brand-800';

/**
 * An organization, in the order the schoolhub console uses: the hero (who, what state, the facts), the section tabs
 * (Overview, Appearance, Feature Access, Domains, Activity, then Administrators) and the open section.
 */
export function TenantDetailPage() {
  const { id = '' } = useParams();
  const tenant = useTenantById(id);
  const admins = useTenantAdmins(id);
  const [params, setParams] = useSearchParams();
  const requested = params.get('tab') ?? 'overview';
  const tab = TABS.some((x) => x.key === requested) ? requested : 'overview';

  if (tenant.isPending) return <TenantDetailSkeleton tab={tab} />;
  if (tenant.isError) {
    const e = toApiError(tenant.error);
    return (
      <>
        <ErrorState
          message={e.status === 404 ? 'That organization does not exist.' : describeError(e)}
          onRetry={e.status === 404 ? undefined : () => void tenant.refetch()}
        />
        <Link
          to="/platform/tenants"
          className="mt-3 inline-block text-sm text-accent-600 hover:underline"
        >
          Back to organizations
        </Link>
      </>
    );
  }

  const t = tenant.data;
  const open = (key: string) =>
    setParams(key === 'overview' ? {} : { tab: key }, { replace: true });

  return (
    <div className={cn('flex flex-col gap-6', tab !== 'appearance' && 'max-w-5xl')}>
      <Link to="/platform/tenants" className={BACK_PILL}>
        ← Back to organizations
      </Link>

      <header className="rounded-[var(--radius-card)] border border-line bg-surface p-5 shadow-[var(--shadow-soft)]">
        <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
          <span
            aria-hidden="true"
            className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-600 to-brand-900 font-heading text-3xl font-bold text-white shadow-sm"
          >
            {t.name.charAt(0).toUpperCase()}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="break-words text-3xl font-bold leading-tight">{t.name}</h1>
              <StatusBadge status={t.status} />
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-1.5">
              <Fact icon={<Hash className="size-4" />} mono>
                {t.code}
              </Fact>
              {t.default_address && (
                <Fact icon={<Globe className="size-4" />} mono>
                  {t.default_address}
                </Fact>
              )}
              <Fact icon={<Users className="size-4" />}>
                {admins.isSuccess
                  ? `${admins.data.data.length} administrator${admins.data.data.length === 1 ? '' : 's'}`
                  : '…'}
              </Fact>
              <Fact icon={<CalendarDays className="size-4" />}>
                Since {formatDateTime(t.created_at)}
              </Fact>
              {t.activated_at && (
                <Fact icon={<CalendarDays className="size-4" />}>
                  Active since {formatDateTime(t.activated_at)}
                </Fact>
              )}
            </div>
          </div>
        </div>
      </header>

      <ProfileTabs label="Organization sections" tabs={[...TABS]} value={tab} onChange={open} />

      <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
        {tab === 'overview' && (
          <TenantOverviewTab
            key={t.id + t.name}
            tenant={t}
            onOpenAppearance={() => open('appearance')}
          />
        )}
        {tab === 'appearance' && <BrandingEditor scope={platformScope(t.id)} />}
        {tab === 'features' && <TenantFeaturesTab tenant={t} />}
        {tab === 'domains' && <DomainsEditor scope={platformScope(t.id)} />}
        {tab === 'activity' && <TenantActivityTab tenantId={t.id} />}
        {tab === 'admins' && <TenantAdminsTab tenant={t} />}
      </div>
    </div>
  );
}
