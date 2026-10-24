import { Printer } from 'lucide-react';
import { useState } from 'react';
import {
  Badge,
  Button,
  DateField,
  EmptyState,
  FormDialog,
  Table,
  TextField,
  useToast,
} from '../../components/ui';
import { searchCms, startingPassword, suggestUsername, type CmsCrew } from './crewAccountDemo';

const RESULT_HEADERS = [
  'Name',
  'Suffix',
  'Crew ID no.',
  'Rank',
  'Fleet',
  'Employment status',
  'Actions',
];

const fullName = (c: Pick<CmsCrew, 'lastName' | 'firstName'>) => `${c.lastName}, ${c.firstName}`;

/** A stand-in for a QR code: finder squares and a fixed scatter of cells. Not scannable. */
function PlaceholderQr() {
  const size = 21;
  const finder = (x: number, y: number) =>
    (x < 7 && y < 7) || (x >= size - 7 && y < 7) || (x < 7 && y >= size - 7);
  const cells: Array<[number, number]> = [];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (finder(x, y)) continue;
      if ((x * 7 + y * 13 + x * y) % 3 === 0) cells.push([x, y]);
    }
  }
  const eye = (ox: number, oy: number) => (
    <g key={`${ox}-${oy}`}>
      <rect x={ox} y={oy} width="7" height="7" fill="currentColor" />
      <rect x={ox + 1} y={oy + 1} width="5" height="5" fill="white" />
      <rect x={ox + 2} y={oy + 2} width="3" height="3" fill="currentColor" />
    </g>
  );
  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      className="size-full"
      aria-hidden="true"
      shapeRendering="crispEdges"
    >
      {eye(0, 0)}
      {eye(size - 7, 0)}
      {eye(0, size - 7)}
      {cells.map(([x, y]) => (
        <rect key={`${x}-${y}`} x={x} y={y} width="1" height="1" fill="currentColor" />
      ))}
    </svg>
  );
}

/** One of the two "SCAN ME" frames on the sheet. */
function ScanMe({ store }: { store: string }) {
  return (
    <figure className="flex flex-col items-center gap-2">
      <div className="relative flex size-32 flex-col items-center rounded-lg border-[3px] border-ink px-2 pb-2 pt-4 text-ink">
        <span className="absolute -top-2.5 bg-white px-1.5 text-sm font-extrabold tracking-wide">
          SCAN ME
        </span>
        <PlaceholderQr />
      </div>
      <figcaption className="text-sm">{store}</figcaption>
    </figure>
  );
}

/** The printable account sheet handed to the crew member. */
function AccountSheet({ account }: { account: CmsCrew & { username: string } }) {
  return (
    <div
      id="crew-account-sheet"
      className="rounded-xl border border-line bg-white p-6 text-ink print:border-0 print:p-0"
    >
      <div className="flex items-center justify-between gap-4 border-b border-ink/30 pb-3">
        <img src="/sailix-logo.png" alt="Sailix" className="h-10 w-auto" />
        <h3 className="text-lg font-bold">Crew Account Details</h3>
      </div>
      <dl className="mt-4 space-y-1 text-sm">
        <div className="flex gap-2">
          <dt className="font-bold">Name:</dt>
          <dd>{`${account.firstName} ${account.lastName}${account.suffix && account.suffix !== 'N/A' ? ` ${account.suffix}` : ''}`}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="font-bold">Rank:</dt>
          <dd>{account.rank}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="font-bold">Fleet:</dt>
          <dd>{account.fleet}</dd>
        </div>
      </dl>

      <h4 className="mt-5 text-base font-bold">Instructions</h4>
      <ul className="mt-2 list-disc space-y-3 pl-5 text-sm">
        <li>
          Please download the Sailix Crew Facing App through these QR codes. You may also opt to
          search the app through Google Playstore (Android) or Appstore (iOS).
          <div className="mt-3 flex justify-center gap-10">
            <ScanMe store="Appstore" />
            <ScanMe store="Playstore" />
          </div>
        </li>
        <li>
          Once downloaded, please login using these details.
          <table className="mt-3 w-full max-w-md border border-ink/40 text-xs">
            <tbody>
              <tr className="border-b border-ink/40">
                <th scope="row" className="w-1/3 border-r border-ink/40 px-3 py-2 text-left">
                  Username
                </th>
                <td className="px-3 py-2 font-mono">{account.username}</td>
              </tr>
              <tr>
                <th scope="row" className="border-r border-ink/40 px-3 py-2 text-left">
                  Password
                </th>
                <td className="px-3 py-2">
                  Password is your birthdate with the format of (yyyymmdd), i.e. 20010101 (January
                  1, 2001)
                </td>
              </tr>
            </tbody>
          </table>
        </li>
        <li>Once logged in, please change your password.</li>
      </ul>
    </div>
  );
}

type Step = 'search' | 'details' | 'sheet';

/**
 * Create a crew account for an applicant, in three screens: find the person in the CMS (dummy records for now), review the
 * account's details, and the printable sheet to hand them. Nothing is saved: Update only says so.
 */
export function CreateCrewAccountDialog({
  applicant,
  onClose,
}: {
  applicant: { firstName: string; lastName: string };
  onClose: () => void;
}) {
  const toast = useToast();
  const [step, setStep] = useState<Step>('search');
  const [typed, setTyped] = useState({
    last: applicant.lastName,
    first: applicant.firstName,
    id: '',
  });
  const [query, setQuery] = useState(typed);
  const [form, setForm] = useState<(CmsCrew & { username: string; password: string }) | null>(null);

  const results = searchCms(query);

  function link(c: CmsCrew) {
    setForm({ ...c, username: suggestUsername(c), password: startingPassword(c.birthday) });
    setStep('details');
  }

  const set = <K extends keyof CmsCrew | 'username' | 'password'>(key: K, value: string) =>
    setForm((f) => (f ? { ...f, [key]: value } : f));

  if (step === 'search' || !form) {
    return (
      <FormDialog
        open
        wide
        title="Create Crew Account"
        description="Search the crew in the CMS, then link the person to the account. Demo records: nothing is read from the CMS yet."
        onClose={onClose}
      >
        <h3 className="mb-3 text-base font-semibold">Search Crew in CMS</h3>
        <form
          role="search"
          aria-label="Search crew in CMS"
          className="mb-4 flex flex-wrap items-end gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            setQuery(typed);
          }}
        >
          <div className="w-full sm:w-44">
            <TextField
              label="Enter last name"
              value={typed.last}
              onChange={(e) => setTyped({ ...typed, last: e.target.value })}
            />
          </div>
          <div className="w-full sm:w-44">
            <TextField
              label="Enter first name"
              value={typed.first}
              onChange={(e) => setTyped({ ...typed, first: e.target.value })}
            />
          </div>
          <div className="w-full sm:w-32">
            <TextField
              label="Crew ID no."
              value={typed.id}
              onChange={(e) => setTyped({ ...typed, id: e.target.value })}
            />
          </div>
          <Button type="submit">Search</Button>
          <Button
            variant="secondary"
            onClick={() => {
              const empty = { last: '', first: '', id: '' };
              setTyped(empty);
              setQuery(empty);
            }}
          >
            Clear
          </Button>
        </form>

        {results.length === 0 ? (
          <EmptyState title="No one in the CMS matches" />
        ) : (
          <Table compact caption="Crew found in the CMS" headers={RESULT_HEADERS}>
            {results.map((c) => (
              <tr key={c.id}>
                <td className="whitespace-nowrap px-4 py-3 font-medium">{fullName(c)}</td>
                <td className="px-4 py-3">{c.suffix}</td>
                <td className="px-4 py-3">{c.crewNumber}</td>
                <td className="px-4 py-3">{c.rank}</td>
                <td className="whitespace-nowrap px-4 py-3">{c.fleet}</td>
                <td className="whitespace-nowrap px-4 py-3">{c.employmentStatus}</td>
                <td className="px-4 py-3">
                  <Button aria-label={`Link account of ${fullName(c)}`} onClick={() => link(c)}>
                    Link Account
                  </Button>
                </td>
              </tr>
            ))}
          </Table>
        )}
      </FormDialog>
    );
  }

  if (step === 'sheet') {
    return (
      <FormDialog open wide title="Crew Account Details" onClose={onClose}>
        <AccountSheet account={form} />
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setStep('details')}>
            Back
          </Button>
          <Button onClick={() => window.print()}>
            <Printer className="size-4" aria-hidden="true" />
            Print
          </Button>
        </div>
      </FormDialog>
    );
  }

  return (
    <FormDialog
      open
      wide
      title="Account Details"
      onClose={onClose}
      actions={
        <button
          type="button"
          title="Print the account sheet"
          aria-label="Print the account sheet"
          onClick={() => setStep('sheet')}
          className="rounded-full p-2 text-muted transition-colors hover:bg-brand-50 hover:text-brand-800"
        >
          <Printer className="size-5" aria-hidden="true" />
        </button>
      }
    >
      <form
        noValidate
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          toast.success(`Account of ${fullName(form)} updated (demo: nothing was saved).`);
          onClose();
        }}
      >
        <Badge tone="warning">Demo data</Badge>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            label="Username"
            value={form.username}
            onChange={(e) => set('username', e.target.value)}
          />
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <TextField label="Password" value={form.password} readOnly />
            </div>
            <Button
              variant="danger"
              onClick={() => set('password', startingPassword(form.birthday))}
            >
              Reset
            </Button>
          </div>
        </div>
        <hr className="border-line" />
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            label="Last name"
            value={form.lastName}
            onChange={(e) => set('lastName', e.target.value)}
          />
          <TextField
            label="First name"
            value={form.firstName}
            onChange={(e) => set('firstName', e.target.value)}
          />
          <TextField
            label="Middle name"
            value={form.middleName}
            onChange={(e) => set('middleName', e.target.value)}
          />
          <TextField
            label="Suffix"
            value={form.suffix}
            onChange={(e) => set('suffix', e.target.value)}
          />
          <DateField
            label="Birthday"
            value={form.birthday}
            onChange={(v) => setForm({ ...form, birthday: v, password: startingPassword(v) })}
          />
          <TextField
            label="Email"
            type="email"
            value={form.email}
            onChange={(e) => set('email', e.target.value)}
          />
          <TextField
            label="Crew ID no."
            value={form.crewNumber}
            onChange={(e) => set('crewNumber', e.target.value)}
          />
          <TextField label="Rank" value={form.rank} onChange={(e) => set('rank', e.target.value)} />
          <TextField
            label="Fleet"
            value={form.fleet}
            onChange={(e) => set('fleet', e.target.value)}
          />
          <TextField
            label="Employment status"
            value={form.employmentStatus}
            onChange={(e) => set('employmentStatus', e.target.value)}
          />
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit">Update</Button>
        </div>
      </form>
    </FormDialog>
  );
}
