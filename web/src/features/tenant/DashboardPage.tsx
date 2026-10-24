import { Link } from 'react-router-dom';
import { Anchor, FileCheck2, Megaphone } from 'lucide-react';
import { ErrorState, PageHero, Skeleton, StatTile } from '../../components/ui';
import { describeError } from '../../services/api/errors';
import { ICONS } from '../../components/icons';
import { can, hasFeature, useMe } from '../authentication/session';
import { useDashboard } from './api';
import { DashboardPanels } from './DashboardPanels';

/** A figure that has not arrived shimmers; one that has is shown, with a plain hint under it. */
const figure = (v?: number) => (v === undefined ? <Skeleton className="h-[30px] w-10" /> : v);

export function DashboardPage() {
  const me = useMe();
  const showCrew = can(me, 'users.view') && hasFeature(me, 'crew');
  const showDocuments = can(me, 'documents.manage') && hasFeature(me, 'documents');
  const showAnnouncements = can(me, 'announcements.manage') && hasFeature(me, 'announcements');
  const showRequests = can(me, 'users.manage');
  // everything the page shows comes in one request and is revealed together, so nothing pops in one piece at a time
  const dashboard = useDashboard();
  const ready = !dashboard.isPending;
  const d = dashboard.data;
  const counts = {
    crew: d?.crew?.total,
    pendingCrew: d?.crew?.pending.meta.total,
    pendingDocs: d?.documents?.pending.meta.total,
    announcements: d?.announcements?.latest.meta.total,
    requests: d?.deletion_requests?.open,
  };
  const openRequests = counts.requests ?? 0;
  const first = (me.user.display_name ?? me.user.username).split(' ')[0];

  const today = new Date().toLocaleDateString('en', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
  const GLASS =
    'inline-flex min-h-10 items-center gap-2 rounded-full bg-white/10 px-5 text-sm font-semibold text-white ring-1 ring-white/30 transition-colors hover:bg-white/20';

  const hero = (
    <PageHero
      eyebrow={me.tenant.name}
      title={`Welcome back, ${first}`}
      description={`${today} · Overview of ${me.tenant.name}.`}
      mark={Anchor}
      actions={
        <div className="flex flex-wrap gap-2">
          {showDocuments && (
            <Link
              to="/app/documents"
              className="inline-flex min-h-10 items-center gap-2 rounded-full bg-white px-5 text-sm font-semibold text-brand-800 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <FileCheck2 className="size-4" aria-hidden="true" />
              Review documents
            </Link>
          )}
          {showAnnouncements && (
            <Link to="/app/announcements" className={GLASS}>
              <Megaphone className="size-4" aria-hidden="true" />
              Write an announcement
            </Link>
          )}
        </div>
      }
    />
  );

  // one failed request must not leave the page shimmering for ever: say so, and offer to try again
  if (dashboard.isError) {
    return (
      <>
        {hero}
        <ErrorState
          message={describeError(dashboard.error)}
          onRetry={() => void dashboard.refetch()}
        />
      </>
    );
  }

  return (
    <>
      {hero}

      {(showCrew || showDocuments || showAnnouncements || showRequests) && (
        <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {showCrew && (
            <StatTile
              to="/app/crew"
              label="Crew"
              value={figure(counts.crew)}
              hint={
                counts.pendingCrew === undefined ? (
                  <Skeleton className="mt-1 h-3 w-32" />
                ) : counts.pendingCrew > 0 ? (
                  `${counts.pendingCrew} waiting for approval`
                ) : (
                  'all approved'
                )
              }
              icon={ICONS.crew}
              tone="blue"
            />
          )}
          {showDocuments && (
            <StatTile
              to="/app/documents"
              label="Documents to review"
              value={figure(counts.pendingDocs)}
              hint={counts.pendingDocs ? 'sent in by crew' : 'nothing waiting'}
              icon={ICONS.documents}
              tone={counts.pendingDocs ? 'amber' : 'green'}
            />
          )}
          {showAnnouncements && (
            <StatTile
              to="/app/announcements"
              label="Announcements"
              value={figure(counts.announcements)}
              hint="written so far"
              icon={ICONS.announcements}
              tone="blue"
            />
          )}
          {showRequests && (
            <StatTile
              to="/app/deletion-requests"
              label="Deletion requests"
              value={figure(counts.requests)}
              hint={openRequests > 0 ? 'open, to review' : 'none open'}
              icon={ICONS.deletion}
              tone={openRequests > 0 ? 'amber' : 'slate'}
            />
          )}
        </div>
      )}

      {showRequests && openRequests > 0 ? (
        <p className="mb-6 flex flex-wrap items-center gap-x-2 rounded-[var(--radius-card)] border border-warn-fg/30 bg-warn-bg px-4 py-3 text-sm text-warn-fg">
          <span>
            {openRequests} account deletion {openRequests === 1 ? 'request is' : 'requests are'}{' '}
            open.
          </span>
          <Link
            to="/app/deletion-requests"
            className="font-semibold underline-offset-2 hover:underline"
          >
            Review
          </Link>
        </p>
      ) : null}

      <DashboardPanels
        loading={!ready}
        crew={showCrew}
        documents={showDocuments}
        announcements={showAnnouncements}
      />
    </>
  );
}
