import { useState } from 'react';
import {
  Badge,
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  FormError,
  PageHeader,
  Skeleton,
  SkeletonField,
  TextField,
  useToast,
} from '../../components/ui';
import { describeError } from '../../services/api/errors';
import type { TenantDomain } from '../../services/api/types';
import {
  OWN_SCOPE,
  useAddDomain,
  useDomains,
  useRemoveDomain,
  useVerifyDomain,
  type TenantScope,
} from './api';

/** The addresses the organization is reached on: its default one, and its own domains once the DNS proves they are its own. */
export function DomainsPage() {
  const list = useDomains(OWN_SCOPE); // the same request the editor below makes, so the header can wait for it too
  return (
    <>
      <PageHeader
        loading={list.isPending}
        title="Domains"
        description="The addresses your organization is reached on."
      />
      <DomainsEditor scope={OWN_SCOPE} />
    </>
  );
}

/** The default address and custom domains of one organization: the signed-in one's own, or (superadmin) the one in the scope. */
export function DomainsEditor({ scope }: { scope: TenantScope }) {
  const list = useDomains(scope);
  const add = useAddDomain(scope);
  const verify = useVerifyDomain(scope);
  const remove = useRemoveDomain(scope);
  const toast = useToast();
  const [domain, setDomain] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [removing, setRemoving] = useState<TenantDomain | null>(null);
  const [verifyError, setVerifyError] = useState<{ id: string; message: string } | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!domain.trim()) return setError('Enter a domain.');
    try {
      await add.mutateAsync(domain.trim());
      setDomain('');
      toast.success('Domain added. Publish the DNS record below to start using it.');
    } catch (err) {
      setError(describeError(err));
    }
  }

  async function check(d: TenantDomain) {
    setVerifyError(null);
    try {
      await verify.mutateAsync(d.id);
      toast.success(`${d.domain} is verified.`);
    } catch (err) {
      setVerifyError({ id: d.id, message: describeError(err) });
    }
  }

  return (
    <>
      {list.isPending ? (
        <DomainsSkeleton />
      ) : list.isError ? (
        <ErrorState message={describeError(list.error)} onRetry={() => void list.refetch()} />
      ) : (
        <div className="flex flex-col gap-6">
          <Card title="Default address">
            <p className="text-sm">
              <span className="font-medium">{list.data.default_address}</span> always works. It
              cannot be changed.
            </p>
          </Card>

          <Card title="Your own domains">
            <form onSubmit={submit} noValidate className="mb-4 flex flex-wrap items-end gap-3">
              <div className="w-full sm:w-80">
                <TextField
                  label="Domain"
                  placeholder="school.example.com"
                  value={domain}
                  onChange={(e) => setDomain(e.target.value)}
                  maxLength={253}
                />
              </div>
              <Button type="submit" loading={add.isPending}>
                Add domain
              </Button>
            </form>
            <FormError message={error} />
            {list.data.domains.length === 0 ? (
              <EmptyState
                title="No domains yet"
                description="Add a domain you own, then publish a DNS record to prove it."
              />
            ) : (
              <ul className="flex flex-col gap-4">
                {list.data.domains.map((d) => (
                  <li key={d.id} className="rounded-md border border-line p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-medium">{d.domain}</p>
                      <div className="flex items-center gap-2">
                        <Badge tone={d.verified ? 'success' : 'warning'}>
                          {d.verified ? 'Verified' : 'Waiting for DNS'}
                        </Badge>
                        {!d.verified ? (
                          <Button
                            variant="secondary"
                            loading={verify.isPending && verify.variables === d.id}
                            onClick={() => void check(d)}
                            aria-label={`Verify ${d.domain}`}
                          >
                            Verify
                          </Button>
                        ) : null}
                        <Button
                          variant="dangerSoft"
                          onClick={() => setRemoving(d)}
                          aria-label={`Remove ${d.domain}`}
                        >
                          Remove
                        </Button>
                      </div>
                    </div>
                    {!d.verified ? (
                      <div className="mt-3 text-sm">
                        <p>
                          To prove you own it, add this TXT record at your DNS provider, wait a few
                          minutes, then press Verify:
                        </p>
                        <dl className="mt-2 grid grid-cols-[5rem_1fr] gap-x-3 gap-y-1">
                          <dt className="text-muted">Name</dt>
                          <dd className="break-all font-mono text-xs">{d.txt_name}</dd>
                          <dt className="text-muted">Value</dt>
                          <dd className="break-all font-mono text-xs">{d.txt_value}</dd>
                        </dl>
                        {verifyError?.id === d.id ? (
                          <p role="alert" className="mt-2 text-xs text-bad-fg">
                            {verifyError.message}
                          </p>
                        ) : null}
                      </div>
                    ) : (
                      <p className="mt-3 text-sm text-muted">
                        Point it at <span className="font-mono text-xs">{d.cname_target}</span> (a
                        CNAME record) so visitors reach your portal.
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      )}
      <ConfirmDialog
        open={removing !== null}
        title="Remove this domain?"
        description="Visitors will no longer reach your organization on it. Your default address keeps working."
        confirmLabel="Remove"
        destructive
        loading={remove.isPending}
        onConfirm={() =>
          removing &&
          remove.mutate(removing.id, {
            onSuccess: () => setRemoving(null),
            onError: (e) => toast.error(describeError(e)),
          })
        }
        onCancel={() => setRemoving(null)}
      />
    </>
  );
}

/** The domains page while it loads: its real cards and labels, with the address, the field and the list shimmering. */
export function DomainsSkeleton() {
  return (
    <div role="status" aria-label="Loading domains" className="flex flex-col gap-6">
      <Card title="Default address">
        <Skeleton className="h-5 w-80 max-w-full" />
      </Card>
      <Card title="Your own domains">
        <div className="mb-4 flex flex-wrap items-end gap-3">
          <div className="w-full sm:w-80">
            <SkeletonField label="Domain" />
          </div>
          <Skeleton className="h-10 w-28 rounded-full" />
        </div>
        <div className="rounded-[var(--radius-card)] border border-dashed border-line px-6 py-10">
          <Skeleton className="mx-auto h-4 w-40" />
          <Skeleton className="mx-auto mt-2 h-3.5 w-64 max-w-full" />
        </div>
      </Card>
      <span className="sr-only">Loading…</span>
    </div>
  );
}
