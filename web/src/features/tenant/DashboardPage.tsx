import { Link } from 'react-router-dom';
import { Button, PageHero, Skeleton, StatTile } from '../../components/ui';
import { ICONS } from '../../components/icons';
import { can, hasFeature, useMe } from '../authentication/session';
import { useDashboardReady } from './api';
import { DashboardPanels } from './DashboardPanels';

/** A figure that has not arrived shimmers; one that has is shown, with a plain hint under it. */
const figure = (v?: number) => (v === undefined ? <Skeleton className="h-7 w-10" /> : v);

export function DashboardPage() {
  const me = useMe();
  const showCrew = can(me, 'users.view') && hasFeature(me, 'crew');
  const showDocuments = can(me, 'documents.manage') && hasFeature(me, 'documents');
  const showAnnouncements = can(me, 'announcements.manage') && hasFeature(me, 'announcements');
  const showRequests = can(me, 'users.manage');
  // everything the page shows is fetched together and revealed together, so nothing pops in one piece at a time
  const { counts: arrived, ready } = useDashboardReady({
    crew: showCrew,
    documents: showDocuments,
    announcements: showAnnouncements,
    requests: showRequests,
  });
  const counts = ready ? arrived : ({} as typeof arrived);
  const openRequests = counts.requests ?? 0;
  const first = (me.user.display_name ?? me.user.username).split(' ')[0];

  return (
    <>
      <PageHero
        eyebrow={me.tenant.name}
        title={`Welcome back, ${first}`}
        description={`Overview of ${me.tenant.name}.`}
        actions={
          <div className="flex flex-wrap gap-2">
            {showDocuments && (
              <Link to="/app/documents">
                <Button variant="secondary">Review documents</Button>
              </Link>
            )}
            {showAnnouncements && (
              <Link to="/app/announcements">
                <Button variant="secondary">Write an announcement</Button>
              </Link>
            )}
          </div>
        }
      />

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
