import { useState } from 'react';
import { Button, Card, FormError, PageHeader, Table, useToast } from '../../components/ui';
import { describeError } from '../../services/api/errors';
import type { FinanceImportResult } from '../../services/api/types';
import { downloadImportTemplate, useFinanceImport, type ImportKind } from './api';

export function PayrollImportPage() {
  return (
    <>
      <PageHeader
        title="Payroll import"
        description="Load payslips and cash advances from your payroll system, so your members see them in the app."
      />
      <Card className="mb-4 text-sm text-muted">
        Members are named by their username and must belong to your organization. The file is
        checked first, and nothing is loaded unless every row is correct. Loading the same file
        again updates the same records. Amounts are stored exactly as the file gives them: Sailix
        does not work out pay.
      </Card>
      <div className="flex flex-col gap-6">
        <ImportSection
          kind="payslips"
          title="Payslips"
          note="One row per payslip. The same member, kind (regular, special or final), pay date and period label is the same payslip. Deductions go in one column as Description=amount, separated by |."
        />
        <ImportSection
          kind="loans"
          title="Cash advances"
          note="One row per loan. The same member and loan code is the same loan. Paid amount and balance come from your payroll system."
        />
      </div>
    </>
  );
}

function ImportSection({ kind, title, note }: { kind: ImportKind; title: string; note: string }) {
  const check = useFinanceImport(kind);
  const load = useFinanceImport(kind);
  const toast = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<FinanceImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [input, setInput] = useState(0); // changing the key empties the file field

  function choose(f: File | null) {
    setFile(f);
    setResult(null);
    setError(null);
  }

  async function runCheck() {
    if (!file) return setError('Choose a CSV file first.');
    setError(null);
    try {
      setResult(await check.mutateAsync({ file, commit: false }));
    } catch (e) {
      setResult(null);
      setError(describeError(e));
    }
  }

  async function runLoad() {
    if (!file) return;
    setError(null);
    try {
      const done = await load.mutateAsync({ file, commit: true });
      if (done.imported) {
        toast.success(`Loaded ${done.rows} row(s): ${done.created} new, ${done.updated} updated.`);
        choose(null);
        setInput((n) => n + 1);
      } else {
        setResult(done); // something changed since the check
      }
    } catch (e) {
      setError(describeError(e));
    }
  }

  const ok = result !== null && result.errors.length === 0 && result.rows > 0;

  return (
    <Card title={title}>
      <p className="mb-3 text-sm text-muted">{note}</p>
      <div className="flex flex-col gap-3">
        <FormError message={error} />
        <div className="flex flex-wrap items-center gap-3">
          <Button
            variant="secondary"
            onClick={() =>
              void downloadImportTemplate(kind).catch((e) => setError(describeError(e)))
            }
          >
            Download the template
          </Button>
          <label className="text-sm font-medium">
            {title} CSV file
            <input
              key={input}
              type="file"
              accept=".csv,.txt,text/csv"
              className="mt-1 block text-sm"
              onChange={(e) => choose(e.target.files?.[0] ?? null)}
            />
          </label>
          <Button loading={check.isPending} onClick={() => void runCheck()}>
            Check the file
          </Button>
        </div>

        {result ? (
          <div role="status" className="flex flex-col gap-2">
            {result.errors.length === 0 ? (
              result.rows === 0 ? (
                <p className="text-sm">The file has no rows.</p>
              ) : (
                <p className="text-sm text-ok-fg">
                  The file is correct: {result.rows} row(s), {result.created} new and{' '}
                  {result.updated} to update.
                </p>
              )
            ) : (
              <>
                <p className="text-sm text-bad-fg">
                  {result.errors.length} problem(s) found. Nothing was loaded. Fix the file and
                  check it again.
                </p>
                <Table caption="Problems in the file" headers={['Line', 'Problem']}>
                  {result.errors.map((e, i) => (
                    <tr key={`${e.line}-${i}`}>
                      <td className="whitespace-nowrap px-4 py-2">{e.line}</td>
                      <td className="px-4 py-2">{e.message}</td>
                    </tr>
                  ))}
                </Table>
              </>
            )}
            {ok ? (
              <div>
                <Button loading={load.isPending} onClick={() => void runLoad()}>
                  Load {result.rows} row(s)
                </Button>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </Card>
  );
}
