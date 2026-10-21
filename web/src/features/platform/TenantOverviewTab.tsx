import { useState } from 'react';
import { Button, Card, FormError, StatusBadge, TextField, useToast } from '../../components/ui';
import type { Tenant } from '../../services/api/types';
import { describeError, useUpdateTenant } from './api';
import { ACTIONS, LifecycleDialog, type LifecycleAction } from './TenantLifecycleUi';

/** What each state means for the people of the organization, said before the buttons that change it. */
const STATE_NOTE: Record<Tenant['status'], string> = {
  provisioning:
    'Being set up. Nobody can sign in yet. Invite an administrator, then activate it once they have accepted.',
  active: 'Live. Suspending blocks everyone in the organization at once; nothing is deleted.',
  suspended: 'Blocked. Everyone is signed out and cannot sign in until it is reactivated.',
  deactivated: 'Closed, but it can be reopened. Nothing is deleted.',
  archived: 'Kept for the record. It cannot be changed.',
};

/** The first tab: who the organization is (its name, the one thing a platform admin edits here), where to change its look, and its state. */
export function TenantOverviewTab({
  tenant,
  onOpenAppearance,
}: {
  tenant: Tenant;
  onOpenAppearance: () => void;
}) {
  const toast = useToast();
  const update = useUpdateTenant(tenant.id);
  const [name, setName] = useState(tenant.name);
  const [error, setError] = useState<string | null>(null);
  const [action, setAction] = useState<LifecycleAction | null>(null);
  const locked = tenant.status === 'archived';
  const invalid = name.trim() === '';
  const dirty = name.trim() !== tenant.name;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (invalid || locked) return;
    try {
      await update.mutateAsync({ name: name.trim() });
      toast.success('Organization updated.');
    } catch (err) {
      setError(describeError(err));
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <form onSubmit={save} noValidate className="grid gap-6 lg:grid-cols-2">
          <div className="flex flex-col gap-4">
            <FormError message={error} />
            <TextField
              label="Name"
              value={name}
              disabled={locked}
              onChange={(e) => setName(e.target.value)}
              error={invalid ? 'Enter a name.' : undefined}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField
                label="Agency code"
                value={tenant.code}
                disabled
                className="font-mono"
                readOnly
              />
              <TextField
                label="Address name"
                value={tenant.slug ?? ''}
                disabled
                className="font-mono"
                readOnly
              />
            </div>
            <TextField
              label="Default address"
              value={tenant.default_address ?? ''}
              disabled
              className="font-mono"
              readOnly
              hint="The address name cannot be changed. Own domains are set under Domains."
            />
          </div>
          <div className="flex flex-col gap-3 rounded-xl bg-brand-50 p-4">
            <h3 className="text-sm font-semibold">Branding &amp; appearance</h3>
            <p className="text-sm text-muted">
              Colours, logos, font style and the sign-in page live in one place: the Appearance tab.
            </p>
            <div>
              <Button type="button" variant="secondary" onClick={onOpenAppearance}>
                Open Appearance
              </Button>
            </div>
          </div>
          <div className="lg:col-span-2">
            <Button type="submit" loading={update.isPending} disabled={invalid || !dirty || locked}>
              Save changes
            </Button>
          </div>
        </form>
      </Card>

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="min-w-0">
            <h3 className="flex items-center gap-2 text-sm font-semibold">
              Status <StatusBadge status={tenant.status} />
            </h3>
            <p className="mt-1 text-sm text-muted">{STATE_NOTE[tenant.status]}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {ACTIONS[tenant.status].map((a) => (
              <Button
                key={a.action}
                variant={a.destructive ? 'secondary' : 'primary'}
                onClick={() => setAction(a)}
              >
                {a.label}
              </Button>
            ))}
          </div>
        </div>
      </Card>

      <LifecycleDialog tenant={tenant} action={action} onClose={() => setAction(null)} />
    </div>
  );
}
