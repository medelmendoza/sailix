import { Eye } from 'lucide-react';
import { useState } from 'react';
import {
  Button,
  DateField,
  FileTile,
  FormDialog,
  IconButton,
  TextAreaField,
  TextField,
  fileSize,
  useToast,
} from '../../components/ui';
import { describeError } from '../../services/api/errors';
import type { CrewDocument } from '../../services/api/types';
import { openDocumentFile, useReviewDocument } from './api';

const COMMENT_MAX = 240; // the two comments together stay within the server's 500 characters for a reason

/** A read-only field: what the member entered, shown for the check. */
const Shown = ({ label, value }: { label: string; value?: string | null }) => (
  <TextField label={label} value={value ?? ''} readOnly placeholder="—" />
);

/**
 * The review of one document waiting for approval: who sent it, what they entered, the file, and the two comments that are
 * sent back with a rejection. Accept approves it; Reject needs both comments.
 */
export function DocumentApprovalDialog({
  doc,
  onClose,
}: {
  doc: CrewDocument;
  onClose: () => void;
}) {
  const review = useReviewDocument();
  const toast = useToast();
  const [onDetails, setOnDetails] = useState('');
  const [onFile, setOnFile] = useState('');
  const [errors, setErrors] = useState<{ details?: string; file?: string }>({});

  const profile = doc.owner?.profile;
  const who =
    [profile?.first_name, profile?.last_name].filter(Boolean).join(' ') ||
    doc.owner?.user?.username ||
    '';

  function accept() {
    review.mutate(
      { id: doc.id },
      {
        onSuccess: () => {
          toast.success('Document approved.');
          onClose();
        },
        onError: (e) => toast.error(describeError(e)),
      },
    );
  }

  function reject() {
    const next = {
      details: onDetails.trim() ? undefined : 'Tell the member what to fix in the details.',
      file: onFile.trim() ? undefined : 'Tell the member what is wrong with the uploaded file.',
    };
    setErrors(next);
    if (next.details || next.file) return;
    review.mutate(
      {
        id: doc.id,
        reason: `Document details: ${onDetails.trim()}\nUploaded document: ${onFile.trim()}`,
      },
      {
        onSuccess: () => {
          toast.success('Document sent back.');
          onClose();
        },
        onError: (e) => toast.error(describeError(e)),
      },
    );
  }

  return (
    <FormDialog open wide title="Document Approval" onClose={onClose}>
      <div className="flex flex-col gap-5">
        <div className="grid gap-4 sm:grid-cols-[1fr_8rem_8rem]">
          <Shown label="Name of requestor" value={who} />
          <Shown label="Crew No." value={profile?.crew_number} />
          <Shown label="Rank" value={profile?.rank} />
        </div>
        <Shown label="Document type" value={doc.type?.name} />

        <section aria-labelledby="doc-details" className="flex flex-col gap-3">
          <h3 id="doc-details" className="text-base font-semibold">
            Details
          </h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <Shown label="Document name" value={doc.type?.name} />
            <Shown label="Document short name" value={doc.type?.short_name} />
            <Shown label="Document number" value={doc.number} />
            <Shown label="Grade" value={doc.grade} />
            <Shown label="Location" value={doc.location} />
            <Shown label="School" value={doc.school} />
            <DateField
              label="Date issued"
              value={doc.issued_on ?? ''}
              onChange={() => {}}
              disabled
            />
            <DateField
              label="Date expired"
              value={doc.expires_on ?? ''}
              onChange={() => {}}
              disabled
            />
          </div>
        </section>

        <section aria-labelledby="doc-files" className="flex flex-col gap-2">
          <h3 id="doc-files" className="text-base font-semibold">
            Uploaded files
          </h3>
          <div className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-3">
            <FileTile contentType={doc.file.type} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold leading-5">{doc.file.name}</p>
              <p className="text-xs leading-4 text-muted">{fileSize(doc.file.size)}</p>
            </div>
            <IconButton
              icon={Eye}
              label={`View the file ${doc.file.name}`}
              tip="View file"
              onClick={() =>
                void openDocumentFile(doc.id).catch((e) => toast.error(describeError(e)))
              }
            />
          </div>
        </section>

        <section aria-labelledby="doc-reject" className="flex flex-col gap-3">
          <h3 id="doc-reject" className="text-lg font-bold">
            Rejection comment
          </h3>
          <TextAreaField
            label="Comment for document details *"
            maxLength={COMMENT_MAX}
            value={onDetails}
            error={errors.details}
            onChange={(e) => setOnDetails(e.target.value)}
          />
          <TextAreaField
            label="Comment for uploaded document *"
            maxLength={COMMENT_MAX}
            value={onFile}
            error={errors.file}
            onChange={(e) => setOnFile(e.target.value)}
          />
          <p className="text-xs text-muted">
            Both comments are needed only to reject. The member sees them with the document.
          </p>
        </section>

        <div className="flex justify-end gap-2">
          <Button
            variant="danger"
            onClick={reject}
            loading={review.isPending && review.variables?.reason !== undefined}
            disabled={review.isPending}
          >
            Reject
          </Button>
          <Button
            onClick={accept}
            loading={review.isPending && review.variables?.reason === undefined}
            disabled={review.isPending}
          >
            Accept
          </Button>
        </div>
      </div>
    </FormDialog>
  );
}
