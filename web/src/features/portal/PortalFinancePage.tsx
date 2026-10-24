import { Eye, Lock } from 'lucide-react';
import { useState } from 'react';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  FormDialog,
  FormError,
  IconButton,
  PageHeader,
  SkeletonDataTable,
  StatusTabs,
  Table,
  TextField,
  type CellKind,
} from '../../components/ui';
import { describeError } from '../../services/api/errors';
import type { PayslipSummary } from '../../services/api/types';
import { needsUnlock, useMyLoans, useMyPayslip, useMyPayslips, useUnlockFinance } from './api';
import { money, showDay } from './format';

const PAYSLIP_HEADERS = ['Pay date', 'Period', 'Vessel', 'Net pay', ''];
const PAYSLIP_CELLS: CellKind[] = ['date', 'text', 'text', 'text', 'actions1'];
const LOAN_HEADERS = ['Code', 'Description', 'Loan', 'Deduction', 'Paid', 'Balance', 'Status'];
const LOAN_CELLS: CellKind[] = ['mono', 'strong', 'text', 'text', 'text', 'text', 'pill'];

/** Payslips and cash advances show only after the password is typed again; it is checked on the server and never kept here. */
function UnlockCard() {
  const unlock = useUnlockFinance();
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!password) return setError('Type your password.');
    try {
      await unlock.mutateAsync(password);
      setPassword('');
    } catch (err) {
      setError(describeError(err));
    }
  }

  return (
    <Card className="mx-auto max-w-md">
      <div className="mb-3 flex items-center gap-3">
        <span
          aria-hidden="true"
          className="flex size-10 items-center justify-center rounded-full bg-brand-50 text-brand-800"
        >
          <Lock className="size-5" />
        </span>
        <div>
          <h2 className="text-lg font-bold">Type your password</h2>
          <p className="text-sm text-muted">
            Your pay is private. This keeps it open for a few minutes.
          </p>
        </div>
      </div>
      <form onSubmit={submit} noValidate className="flex flex-col gap-3">
        <FormError message={error} />
        <TextField
          label="Password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <Button type="submit" loading={unlock.isPending}>
          Unlock
        </Button>
      </form>
    </Card>
  );
}

function Fact({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div>
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="text-sm font-medium">{value}</dd>
    </div>
  );
}

function PayslipDialog({ id, onClose }: { id: string; onClose: () => void }) {
  const slip = useMyPayslip(id);
  const d = slip.data;
  return (
    <FormDialog
      open
      wide
      title="Payslip"
      description={d ? `${d.period_label} · ${showDay(d.pay_date)}` : undefined}
      onClose={onClose}
    >
      {slip.isPending ? (
        <SkeletonDataTable
          caption="Payslip"
          headers={['Deduction', 'Amount']}
          cells={['text', 'text']}
          rows={4}
          label="Loading the payslip"
          compact
        />
      ) : slip.isError ? (
        <ErrorState message={describeError(slip.error)} onRetry={() => void slip.refetch()} />
      ) : (
        <div className="flex flex-col gap-4">
          <dl className="grid gap-3 sm:grid-cols-3">
            <Fact label="Vessel" value={d!.full_vessel_name ?? d!.vessel_name} />
            <Fact label="Position" value={d!.position} />
            <Fact label="Payee" value={d!.payee_name} />
            <Fact label="Account" value={d!.account_number} />
            <Fact label="Exchange rate" value={d!.exchange_rate} />
            <Fact label="Pay (USD)" value={d!.pay_usd ? money(d!.pay_usd, true) : null} />
            <Fact label="Pay (PHP)" value={d!.pay_peso ? money(d!.pay_peso, false) : null} />
            <Fact
              label="Adjustment"
              value={d!.adjustment ? money(d!.adjustment, d!.is_dollar) : null}
            />
          </dl>
          {d!.deductions.length > 0 && (
            <Table caption="Deductions" headers={['Deduction', 'Amount']} compact>
              {d!.deductions.map((x, i) => (
                <tr key={`${x.description}-${i}`}>
                  <td className="px-4 py-3">{x.description}</td>
                  <td className="px-4 py-3">{money(x.amount, d!.is_dollar)}</td>
                </tr>
              ))}
            </Table>
          )}
          <div className="flex items-baseline justify-between rounded-2xl bg-brand-50 px-4 py-3">
            <span className="text-sm font-medium text-brand-800">Net pay</span>
            <span className="font-heading text-2xl font-bold text-brand-800">
              {money(d!.net_amount, d!.is_dollar)}
            </span>
          </div>
        </div>
      )}
      <div className="mt-4 flex justify-end">
        <Button variant="secondary" onClick={onClose}>
          Close
        </Button>
      </div>
    </FormDialog>
  );
}

function Payslips() {
  const [kind, setKind] = useState<'allotment' | 'final'>('allotment');
  const list = useMyPayslips(kind);
  const [open, setOpen] = useState<PayslipSummary | null>(null);

  if (list.isError && needsUnlock(list.error)) return <UnlockCard />;
  return (
    <>
      <div className="mb-4">
        <StatusTabs
          label="Payslip kind"
          value={kind}
          onChange={(k) => setKind(k as 'allotment' | 'final')}
          tabs={[
            { key: 'allotment', label: 'Allotment' },
            { key: 'final', label: 'Final pay' },
          ]}
        />
      </div>
      {list.isPending ? (
        <SkeletonDataTable
          caption="Payslips"
          headers={PAYSLIP_HEADERS}
          cells={PAYSLIP_CELLS}
          rows={4}
          label="Loading payslips"
        />
      ) : list.isError ? (
        <ErrorState message={describeError(list.error)} onRetry={() => void list.refetch()} />
      ) : list.data.length === 0 ? (
        <EmptyState
          title="No payslips yet"
          description="Payslips your organization loads show up here."
        />
      ) : (
        <Table caption="Payslips" headers={PAYSLIP_HEADERS}>
          {list.data.map((p) => (
            <tr key={p.id}>
              <td className="whitespace-nowrap px-4 py-3">{showDay(p.pay_date)}</td>
              <td className="px-4 py-3">{p.period_label}</td>
              <td className="px-4 py-3">{p.vessel_name}</td>
              <td className="whitespace-nowrap px-4 py-3 font-medium">
                {money(p.net_amount, p.is_dollar)}
              </td>
              <td className="px-4 py-3 text-right">
                <IconButton
                  icon={Eye}
                  label={`Open the payslip of ${p.period_label}`}
                  tip="Open"
                  onClick={() => setOpen(p)}
                />
              </td>
            </tr>
          ))}
        </Table>
      )}
      {open ? <PayslipDialog id={open.id} onClose={() => setOpen(null)} /> : null}
    </>
  );
}

function CashAdvance() {
  const loans = useMyLoans();
  if (loans.isError && needsUnlock(loans.error)) return <UnlockCard />;
  if (loans.isPending)
    return (
      <SkeletonDataTable
        caption="Cash advances"
        headers={LOAN_HEADERS}
        cells={LOAN_CELLS}
        rows={3}
        label="Loading cash advances"
      />
    );
  if (loans.isError)
    return <ErrorState message={describeError(loans.error)} onRetry={() => void loans.refetch()} />;
  if (loans.data.data.length === 0)
    return (
      <EmptyState
        title="No cash advances"
        description="Loans your organization records show up here."
      />
    );
  return (
    <>
      <Table caption="Cash advances" headers={LOAN_HEADERS}>
        {loans.data.data.map((l) => (
          <tr key={l.id}>
            <td className="px-4 py-3 font-mono text-xs">{l.code}</td>
            <td className="px-4 py-3 font-medium">{l.description}</td>
            <td className="whitespace-nowrap px-4 py-3">{money(l.loan_amount, l.is_dollar)}</td>
            <td className="whitespace-nowrap px-4 py-3">{money(l.deduct_amount, l.is_dollar)}</td>
            <td className="whitespace-nowrap px-4 py-3">{money(l.paid_amount, l.is_dollar)}</td>
            <td className="whitespace-nowrap px-4 py-3 font-medium">
              {money(l.balance, l.is_dollar)}
            </td>
            <td className="px-4 py-3">
              <Badge tone={l.is_stopped ? 'neutral' : 'success'}>
                {l.is_stopped ? 'Stopped' : 'Deducting'}
              </Badge>
            </td>
          </tr>
        ))}
      </Table>
      <p className="mt-3 text-sm text-muted">
        Balance owed:{' '}
        <span className="font-medium text-ink">{money(loans.data.totals.php, false)}</span> ·{' '}
        <span className="font-medium text-ink">{money(loans.data.totals.usd, true)}</span>
      </p>
    </>
  );
}

/** Pay: the payslips (allotment and final) and the cash advances, behind the password check. */
export function PortalFinancePage() {
  const [tab, setTab] = useState<'payslips' | 'loans'>('payslips');
  return (
    <>
      <PageHeader title="Finance" description="Your payslips and cash advances." />
      <div className="mb-4">
        <StatusTabs
          label="Finance sections"
          value={tab}
          onChange={(k) => setTab(k as 'payslips' | 'loans')}
          tabs={[
            { key: 'payslips', label: 'Payslips' },
            { key: 'loans', label: 'Cash advance' },
          ]}
        />
      </div>
      {tab === 'payslips' ? <Payslips /> : <CashAdvance />}
    </>
  );
}
