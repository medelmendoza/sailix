import { useState } from 'react';
import {
  Badge,
  Card,
  EmptyState,
  ErrorState,
  PageHeader,
  Pagination,
  Spinner,
  Table,
} from '../../components/ui';
import { describeError } from '../../services/api/errors';
import { formatDateTime } from '../shared/AuditTable';
import { useFeedback } from './api';

const CATEGORY: Record<string, string> = {
  bug: 'Something is wrong',
  idea: 'An idea',
  other: 'Other',
};

export function FeedbackPage() {
  const [page, setPage] = useState(1);
  const feedback = useFeedback({ page, per_page: 20 });

  return (
    <>
      <PageHeader
        title="Feedback"
        description="What members of your organization sent from the mobile app, newest first."
      />
      <Card className="mb-4 text-sm text-muted">
        Feedback about the Sailix app only. It is not sent to Tala or any other service.
      </Card>
      {feedback.isPending ? (
        <Spinner />
      ) : feedback.isError ? (
        <ErrorState
          message={describeError(feedback.error)}
          onRetry={() => void feedback.refetch()}
        />
      ) : feedback.data.data.length === 0 ? (
        <EmptyState title="No feedback yet" />
      ) : (
        <>
          <Table caption="Feedback" headers={['From', 'About', 'Message', 'Sent']}>
            {feedback.data.data.map((f) => (
              <tr key={f.id}>
                <td className="px-4 py-3">
                  <p className="font-medium">{f.membership?.user?.username}</p>
                  <p className="text-xs text-muted">{f.membership?.user?.email}</p>
                </td>
                <td className="px-4 py-3">
                  <Badge tone={f.category === 'bug' ? 'warning' : 'info'}>
                    {CATEGORY[f.category] ?? f.category}
                  </Badge>
                </td>
                {/* member-written text: rendered as text, never as HTML */}
                <td className="whitespace-pre-wrap px-4 py-3">{f.message}</td>
                <td className="whitespace-nowrap px-4 py-3">{formatDateTime(f.created_at)}</td>
              </tr>
            ))}
          </Table>
          <Pagination meta={feedback.data.meta} onPage={setPage} />
        </>
      )}
    </>
  );
}
