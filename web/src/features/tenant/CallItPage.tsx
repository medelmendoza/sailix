import { useState } from 'react';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  FormDialog,
  PageHeader,
  Pagination,
  SelectField,
  Spinner,
  Table,
  useToast,
} from '../../components/ui';
import { describeError } from '../../services/api/errors';
import type { CallItReport } from '../../services/api/types';
import { formatDateTime } from '../shared/AuditTable';
import { openCallItFile, useCallItReports, useReviewCallItReport } from './api';

const CLASSIFICATION: Record<string, string> = {
  unsafe_acts: 'Unsafe acts',
  unsafe_conditions: 'Unsafe conditions',
  unsafe_behaviour: 'Unsafe behaviour',
};
const SUB: Record<string, string> = {
  people: 'People',
  materials: 'Materials',
  processes: 'Processes',
  equipment: 'Equipment',
  environment: 'Environment',
};
const LOCATION: Record<string, string> = {
  accommodation: 'Accommodation',
  main_deck: 'Main deck',
  poop_deck: 'Poop deck',
  cargo_space: 'Cargo space',
  ballast_space: 'Ballast space',
  hold_space: 'Hold space',
  machinery_space: 'Machinery space',
  others: 'Others',
};

const label = (map: Record<string, string>, v: string | null | undefined) =>
  v ? (map[v] ?? v) : '—';
const where = (r: CallItReport) =>
  r.location === 'others' && r.location_other
    ? `Others: ${r.location_other}`
    : label(LOCATION, r.location);

export function CallItPage() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('submitted');
  const list = useCallItReports({ page, per_page: 20, ...(status ? { status } : {}) });
  const [open, setOpen] = useState<CallItReport | null>(null);

  return (
    <>
      <PageHeader
        title="Call-it reports"
        description="Safety observations and incidents your members sent. Drafts stay private to the member."
      />
      <div className="mb-4 max-w-xs">
        <SelectField
          label="Show"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
          options={[
            { value: 'submitted', label: 'Waiting for review' },
            { value: 'reviewed', label: 'Reviewed' },
            { value: '', label: 'All' },
          ]}
        />
      </div>
      {list.isPending ? (
        <Spinner />
      ) : list.isError ? (
        <ErrorState message={describeError(list.error)} onRetry={() => void list.refetch()} />
      ) : list.data.data.length === 0 ? (
        <EmptyState title="No reports here" />
      ) : (
        <>
          <Table
            caption="Call-it reports"
            headers={['Reporter', 'What', 'Where', 'Sent', 'Status', '']}
          >
            {list.data.data.map((r) => (
              <tr key={r.id}>
                <td className="px-4 py-3">
                  <p className="font-medium">{r.reporter?.user?.username}</p>
                  <p className="text-xs text-muted">{r.reporter?.user?.email}</p>
                </td>
                <td className="px-4 py-3">
                  <p>{label(CLASSIFICATION, r.classification)}</p>
                  <p className="text-xs text-muted">{label(SUB, r.sub_classification)}</p>
                  {r.official_report ? <Badge tone="warning">Official report</Badge> : null}
                </td>
                <td className="px-4 py-3">
                  <p>{where(r)}</p>
                  <p className="text-xs text-muted">{r.vessel ?? '—'}</p>
                </td>
                <td className="whitespace-nowrap px-4 py-3">
                  {r.submitted_at ? formatDateTime(r.submitted_at) : '—'}
                </td>
                <td className="px-4 py-3">
                  <Badge tone={r.status === 'reviewed' ? 'success' : 'warning'}>
                    {r.status === 'reviewed' ? 'Reviewed' : 'Waiting for review'}
                  </Badge>
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-right">
                  <Button
                    variant="ghost"
                    onClick={() => setOpen(r)}
                    aria-label={`Open the report from ${r.reporter?.user?.username}`}
                  >
                    Open
                  </Button>
                </td>
              </tr>
            ))}
          </Table>
          <Pagination meta={list.data.meta} onPage={setPage} />
        </>
      )}
      {open ? <ReportDialog report={open} onClose={() => setOpen(null)} /> : null}
    </>
  );
}

function ReportDialog({ report, onClose }: { report: CallItReport; onClose: () => void }) {
  const review = useReviewCallItReport();
  const toast = useToast();

  async function file() {
    try {
      await openCallItFile(report.id);
    } catch (e) {
      toast.error(describeError(e));
    }
  }

  return (
    <FormDialog
      open
      title="Call-it report"
      description={`From ${report.reporter?.user?.username ?? 'a member'}`}
      onClose={onClose}
    >
      <div className="flex flex-col gap-3 text-sm">
        <Card className="flex flex-col gap-1">
          <p>
            <span className="text-muted">Classification: </span>
            {label(CLASSIFICATION, report.classification)} · {label(SUB, report.sub_classification)}
          </p>
          <p>
            <span className="text-muted">Where: </span>
            {where(report)} · {report.vessel ?? '—'}
          </p>
          <p>
            <span className="text-muted">Official report needed: </span>
            {report.official_report ? 'Yes' : 'No'}
          </p>
        </Card>
        <div>
          <p className="font-medium">Details of the incident</p>
          {/* member-written text: rendered as text, never as HTML */}
          <p className="whitespace-pre-wrap">{report.details}</p>
        </div>
        <div>
          <p className="font-medium">Did the member intervene?</p>
          <p className="whitespace-pre-wrap">
            {report.intervened ? (report.intervention_details ?? 'Yes') : 'No'}
          </p>
        </div>
        {report.file ? (
          <div>
            <Button variant="secondary" onClick={() => void file()}>
              View the attached file ({report.file.name})
            </Button>
          </div>
        ) : null}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
          {report.status === 'submitted' ? (
            <Button
              loading={review.isPending}
              onClick={() =>
                review.mutate(report.id, {
                  onSuccess: () => {
                    toast.success('Marked as reviewed.');
                    onClose();
                  },
                  onError: (e) => toast.error(describeError(e)),
                })
              }
            >
              Mark as reviewed
            </Button>
          ) : null}
        </div>
      </div>
    </FormDialog>
  );
}
