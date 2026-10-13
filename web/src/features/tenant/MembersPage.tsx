import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Button,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  PageHeader,
  Pagination,
  SelectField,
  Spinner,
  StatusBadge,
  Table,
  TextField,
} from '../../components/ui';
import { describeError } from '../../services/api/errors';
import type { Membership } from '../../services/api/types';
import { formatDateTime } from '../shared/AuditTable';
import { useMe } from '../authentication/session';
import { useMembers, useUpdateMember } from './api';

type Patch = { status?: 'active' | 'suspended'; role?: 'tenant_admin' | 'crew' };
interface Action {
  key: string;
  label: string;
  patch: Patch;
  confirm?: { title: string; body: string; destructive?: boolean };
}

export function displayName(m: Membership): string {
  if (m.profile) return [m.profile.first_name, m.profile.last_name].filter(Boolean).join(' ');
  return m.user?.display_name ?? m.user?.username ?? 'Unknown';
}

function actionsFor(m: Membership): Action[] {
  const name = displayName(m);
  switch (m.status) {
    case 'pending':
      return [
        { key: 'approve', label: 'Approve', patch: { status: 'active' } },
        {
          key: 'reject',
          label: 'Reject',
          patch: { status: 'suspended' },
          confirm: {
            title: `Reject ${name}?`,
            body: 'They will not be able to sign in. You can reactivate them later.',
            destructive: true,
          },
        },
      ];
    case 'active':
      return [
        m.role === 'crew'
          ? {
              key: 'promote',
              label: 'Make administrator',
              patch: { role: 'tenant_admin' },
              confirm: {
                title: `Make ${name} an administrator?`,
                body: 'Administrators can manage members, settings and modules for this organization.',
              },
            }
          : {
              key: 'demote',
              label: 'Make crew',
              patch: { role: 'crew' },
              confirm: {
                title: `Remove administrator rights from ${name}?`,
                body: 'They will lose access to this portal.',
                destructive: true,
              },
            },
        {
          key: 'suspend',
          label: 'Suspend',
          patch: { status: 'suspended' },
          confirm: {
            title: `Suspend ${name}?`,
            body: 'They are signed out everywhere and cannot sign in until reactivated.',
            destructive: true,
          },
        },
      ];
    case 'suspended':
      return [{ key: 'reactivate', label: 'Reactivate', patch: { status: 'active' } }];
    default:
      return []; // invited members activate through their invitation
  }
}

const STATUS_OPTIONS = [
  { value: '', label: 'All statuses' },
  { value: 'pending', label: 'Pending' },
  { value: 'active', label: 'Active' },
  { value: 'suspended', label: 'Suspended' },
  { value: 'invited', label: 'Invited' },
];
const ROLE_OPTIONS = [
  { value: '', label: 'All roles' },
  { value: 'crew', label: 'Crew' },
  { value: 'tenant_admin', label: 'Administrator' },
];

export function MembersPage() {
  const me = useMe();
  const [params, setParams] = useSearchParams();
  const status = params.get('status') ?? '';
  const role = params.get('role') ?? '';
  const q = params.get('q') ?? '';
  const page = Number(params.get('page') ?? 1);
  const [search, setSearch] = useState(q);
  const [pending, setPending] = useState<{ member: Membership; action: Action } | null>(null);
  const update = useUpdateMember();

  useEffect(() => {
    const t = setTimeout(
      () => search !== q && setParams(merge(params, { q: search, page: '' }), { replace: true }),
      300,
    );
    return () => clearTimeout(t);
  }, [search, q, params, setParams]);

  const members = useMembers({
    page,
    per_page: 20,
    'filter[status]': status || undefined,
    'filter[role]': role || undefined,
    'filter[q]': q || undefined,
  });

  function run(member: Membership, action: Action) {
    update.mutate({ id: member.id, patch: action.patch }, { onSettled: () => setPending(null) });
  }

  return (
    <>
      <PageHeader
        title="Members"
        description="Approve registrations and manage who can use your organization's account."
      />
      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <SelectField
          label="Status"
          options={STATUS_OPTIONS}
          value={status}
          onChange={(e) => setParams(merge(params, { status: e.target.value, page: '' }))}
        />
        <SelectField
          label="Role"
          options={ROLE_OPTIONS}
          value={role}
          onChange={(e) => setParams(merge(params, { role: e.target.value, page: '' }))}
        />
        <TextField
          label="Search by username"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {members.isPending ? (
        <Spinner label="Loading members" />
      ) : members.isError ? (
        <ErrorState message={describeError(members.error)} onRetry={() => void members.refetch()} />
      ) : members.data.data.length === 0 ? (
        <EmptyState
          title="No members match"
          description={
            status === 'pending'
              ? 'There are no registrations waiting for approval.'
              : 'Try changing the filters.'
          }
        />
      ) : (
        <>
          <Table
            caption="Members"
            headers={['Name', 'Account', 'Role', 'Status', 'Joined', 'Actions']}
          >
            {members.data.data.map((m) => {
              const name = displayName(m);
              const isMe = m.id === me.membership.id;
              return (
                <tr key={m.id}>
                  <td className="px-4 py-3">
                    <p className="font-medium">{name}</p>
                    {m.profile?.mobile && <p className="text-xs text-muted">{m.profile.mobile}</p>}
                  </td>
                  <td className="px-4 py-3">
                    <p>{m.user?.username}</p>
                    <p className="text-xs text-muted">{m.user?.email}</p>
                  </td>
                  <td className="px-4 py-3">
                    {m.role === 'tenant_admin' ? 'Administrator' : 'Crew'}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={m.status} />
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">{formatDateTime(m.created_at)}</td>
                  <td className="px-4 py-3">
                    {isMe ? (
                      <span className="text-xs text-muted">You</span>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {actionsFor(m).map((a) => (
                          <Button
                            key={a.key}
                            variant={a.key === 'approve' ? 'primary' : 'secondary'}
                            className="min-h-8 px-3"
                            aria-label={`${a.label} ${name}`}
                            disabled={update.isPending}
                            onClick={() =>
                              a.confirm ? setPending({ member: m, action: a }) : run(m, a)
                            }
                          >
                            {a.label}
                          </Button>
                        ))}
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </Table>
          <Pagination
            meta={members.data.meta}
            onPage={(p) => setParams(merge(params, { page: String(p) }))}
          />
        </>
      )}

      <ConfirmDialog
        open={pending !== null}
        title={pending?.action.confirm?.title ?? ''}
        description={pending?.action.confirm?.body ?? ''}
        confirmLabel={pending?.action.label ?? 'Confirm'}
        destructive={pending?.action.confirm?.destructive}
        loading={update.isPending}
        onConfirm={() => pending && run(pending.member, pending.action)}
        onCancel={() => setPending(null)}
      />
    </>
  );
}

function merge(current: URLSearchParams, changes: Record<string, string>): URLSearchParams {
  const next = new URLSearchParams(current);
  for (const [k, v] of Object.entries(changes)) {
    if (v) next.set(k, v);
    else next.delete(k);
  }
  return next;
}
