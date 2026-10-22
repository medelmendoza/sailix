import { useState } from 'react';
import {
  Button,
  Card,
  ConfirmDialog,
  ErrorState,
  PageHeader,
  StatusBadge,
  Skeleton,
} from '../../components/ui';
import { describeError } from '../../services/api/errors';
import type { TenantModule } from '../../services/api/types';
import { can, useMe } from '../authentication/session';
import { useSetModuleEnabled, useTenantModules } from './api';

/** The module cards while they load: a title with its status, a line or two, and the button. */
function ModulesSkeleton() {
  return (
    <div role="status" aria-label="Loading modules" className="flex flex-col gap-4">
      {Array.from({ length: 3 }, (_, i) => (
        <Card key={i}>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <Skeleton className="h-7 w-28" />
            <Skeleton className="h-5 w-24 rounded-full" />
          </div>
          <Skeleton className="mb-4 h-4 w-3/4" />
          <Skeleton className="h-10 w-36 rounded-full" />
        </Card>
      ))}
      <span className="sr-only">Loading…</span>
    </div>
  );
}

export function ModulesPage() {
  const me = useMe();
  const modules = useTenantModules();
  const setEnabled = useSetModuleEnabled();
  const [disabling, setDisabling] = useState<TenantModule | null>(null);

  return (
    <>
      <PageHeader
        loading={modules.isPending}
        title="Modules"
        description="Services your organization can offer to its members."
      />
      {modules.isPending ? (
        <ModulesSkeleton />
      ) : modules.isError ? (
        <ErrorState message={describeError(modules.error)} onRetry={() => void modules.refetch()} />
      ) : (
        <div className="flex flex-col gap-4">
          {modules.data.map((m) => {
            const manage = can(me, `module.${m.code}.manage`);
            return (
              <Card
                key={m.code}
                title={m.label}
                actions={
                  <StatusBadge
                    status={!m.entitled ? 'not provisioned' : m.enabled ? 'enabled' : 'disabled'}
                  />
                }
              >
                {!m.entitled ? (
                  <p className="text-sm text-muted">
                    This module has not been provisioned for your organization. Ask your platform
                    administrator to set it up.
                  </p>
                ) : (
                  <>
                    {m.built_in ? (
                      <p className="mb-4 text-sm text-muted">
                        Built into the app. Members find it under Services when it is enabled.
                      </p>
                    ) : (
                      <>
                        <dl className="mb-4 text-sm">
                          <dt className="text-muted">Linked external team</dt>
                          <dd className="font-mono">{m.external_team_id ?? '—'}</dd>
                        </dl>
                        <p className="mb-4 text-xs text-muted">
                          The team mapping is managed by the platform administrator and cannot be
                          changed here.
                        </p>
                      </>
                    )}
                    {manage &&
                      (m.enabled ? (
                        <Button
                          variant="secondary"
                          disabled={setEnabled.isPending}
                          onClick={() => setDisabling(m)}
                        >
                          Disable {m.label}
                        </Button>
                      ) : (
                        <Button
                          loading={setEnabled.isPending}
                          onClick={() => setEnabled.mutate({ code: m.code, enabled: true })}
                        >
                          Enable {m.label}
                        </Button>
                      ))}
                  </>
                )}
              </Card>
            );
          })}
        </div>
      )}
      <ConfirmDialog
        open={disabling !== null}
        title={`Disable ${disabling?.label ?? 'module'}?`}
        description="Members lose access to this module immediately. Their linked accounts are kept."
        confirmLabel="Disable"
        destructive
        loading={setEnabled.isPending}
        onConfirm={() =>
          disabling &&
          setEnabled.mutate(
            { code: disabling.code, enabled: false },
            { onSettled: () => setDisabling(null) },
          )
        }
        onCancel={() => setDisabling(null)}
      />
    </>
  );
}
