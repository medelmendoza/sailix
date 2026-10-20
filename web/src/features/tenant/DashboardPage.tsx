import { Link } from 'react-router-dom';
import { ErrorState, PageHeader, Spinner } from '../../components/ui';
import { describeError } from '../../services/api/errors';
import { AuditTable } from '../shared/AuditTable';
import { can, hasFeature, useMe } from '../authentication/session';
import { useAuditLogs, useDeletionRequests } from './api';
import { AnnouncementsPanel, DocumentApprovalPanel, UserApplicationPanel } from './DashboardPanels';

export function DashboardPage() {
  const me = useMe();
  const deletions = useDeletionRequests({ per_page: 1 });
  const audit = useAuditLogs({ per_page: 5 });
  const openDeletions = deletions.data?.meta.total ?? 0;

  return (
    <>
      <PageHeader title="Dashboard" description={`Overview of ${me.tenant.name}.`} />
      {can(me, 'users.manage') && openDeletions > 0 ? (
        <p className="mb-4 rounded-md border border-line bg-surface px-4 py-3 text-sm">
          {openDeletions} account deletion {openDeletions === 1 ? 'request is' : 'requests are'}{' '}
          open.{' '}
          <Link
            to="/app/deletion-requests"
            className="text-brand-700 underline-offset-2 hover:underline"
          >
            Review
          </Link>
        </p>
      ) : null}
      <div className="grid gap-4 xl:grid-cols-2">
        {can(me, 'users.view') && hasFeature(me, 'crew') && <UserApplicationPanel />}
        {can(me, 'documents.manage') && hasFeature(me, 'documents') && <DocumentApprovalPanel />}
        {can(me, 'announcements.manage') && hasFeature(me, 'announcements') && (
          <div className="xl:col-span-2">
            <AnnouncementsPanel />
          </div>
        )}
      </div>
      {can(me, 'audit.view') && (
        <section className="mt-8">
          <h2 className="mb-3 text-base font-semibold">Recent activity</h2>
          {audit.isPending ? (
            <Spinner />
          ) : audit.isError ? (
            <ErrorState message={describeError(audit.error)} onRetry={() => void audit.refetch()} />
          ) : (
            <AuditTable entries={audit.data.data} />
          )}
        </section>
      )}
    </>
  );
}
