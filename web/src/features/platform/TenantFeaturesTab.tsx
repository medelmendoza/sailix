import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import {
  Button,
  Card,
  ErrorState,
  FormError,
  SelectField,
  StatusBadge,
  TextField,
  useToast,
} from '../../components/ui';
import { toApiError } from '../../services/api/errors';
import { applyServerErrors } from '../authentication/forms';
import {
  describeError,
  usePlatformFeatures,
  usePlatformModules,
  useProvisionModule,
  useUpdateFeatures,
} from './api';
import type { PlatformTenantModule, Tenant } from '../../services/api/types';
import { FEATURES_NOTE, FeatureRowsSkeleton, ModuleCardsSkeleton } from './TenantDetailSkeleton';

const TEAM_ID = /^[A-Za-z0-9_-]{1,64}$/;

const moduleSchema = z.object({
  external_team_id: z.string(),
  enabled: z.enum(['true', 'false']),
});
type ModuleValues = z.infer<typeof moduleSchema>;

function ModuleCard({ tenantId, module }: { tenantId: string; module: PlatformTenantModule }) {
  const provision = useProvisionModule(tenantId);
  const toast = useToast();
  const [error, setError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError: setField,
    formState,
  } = useForm<ModuleValues>({
    resolver: zodResolver(moduleSchema),
    defaultValues: {
      external_team_id: module.external_team_id ?? '',
      enabled: module.enabled ? 'true' : 'false',
    },
  });

  const builtIn = module.built_in; // built into the app: nothing to map to an external team

  function submit(v: ModuleValues) {
    setError(null);
    if (!builtIn && !TEAM_ID.test(v.external_team_id)) {
      setField('external_team_id', { message: 'Letters, digits, - and _ only (max 64).' });
      return;
    }
    provision.mutate(
      {
        code: module.code,
        ...(builtIn ? {} : { external_team_id: v.external_team_id }),
        enabled: v.enabled === 'true',
      },
      {
        onSuccess: () => toast.success(`${module.label} saved.`),
        onError: (e) =>
          setError(
            applyServerErrors(e, setField, ['external_team_id']) ??
              toApiError(e).field('external_team_id') ??
              null,
          ),
      },
    );
  }

  return (
    <Card
      title={module.label}
      actions={
        <StatusBadge
          status={!module.entitled ? 'not provisioned' : module.enabled ? 'enabled' : 'disabled'}
        />
      }
    >
      <form onSubmit={handleSubmit(submit)} noValidate className="flex max-w-lg flex-col gap-4">
        <FormError message={error} />
        {builtIn ? (
          <p className="text-sm text-muted">
            Built into the app: there is no external team to map. Switch it on for this organization
            and its members see it under Services.
          </p>
        ) : (
          <TextField
            label="External team ID"
            hint="The team of the external system this organization is bound to. Each team can belong to one organization only."
            error={formState.errors.external_team_id?.message}
            {...register('external_team_id')}
          />
        )}
        <SelectField
          label="Status"
          options={[
            { value: 'false', label: 'Disabled' },
            { value: 'true', label: 'Enabled' },
          ]}
          {...register('enabled')}
        />
        {module.entitled && !builtIn && (
          <p className="text-xs text-muted">{module.links_count} linked account(s).</p>
        )}
        <div>
          <Button type="submit" loading={provision.isPending}>
            {module.entitled ? 'Save' : 'Provision'}
          </Button>
        </div>
      </form>
    </Card>
  );
}

function FeatureSwitches({ tenantId }: { tenantId: string }) {
  const features = usePlatformFeatures(tenantId);
  const update = useUpdateFeatures(tenantId);
  const toast = useToast();

  return (
    <section aria-labelledby="features-h" className="flex flex-col gap-3">
      <div>
        <h2 id="features-h" className="text-base font-semibold">
          Feature access
        </h2>
        <p className="text-sm text-muted">{FEATURES_NOTE}</p>
      </div>
      {features.isPending ? (
        <FeatureRowsSkeleton />
      ) : features.isError ? (
        <ErrorState
          message={describeError(features.error)}
          onRetry={() => void features.refetch()}
        />
      ) : (
        <Card>
          <ul className="divide-y divide-line">
            {features.data.map((f) => (
              <li key={f.code} className="flex items-center justify-between gap-4 py-3">
                <div className="min-w-0">
                  <p className="font-medium">{f.label}</p>
                  <p className="text-sm text-muted">{f.description}</p>
                </div>
                <label className="flex shrink-0 items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    role="switch"
                    className="size-5 accent-[var(--color-accent-600)]"
                    aria-label={`${f.label} access`}
                    checked={f.enabled}
                    disabled={update.isPending}
                    onChange={(e) => {
                      const on = e.target.checked; // read now: the box has moved by the time the server answers
                      update.mutate(
                        { [f.code]: on },
                        {
                          onSuccess: () => toast.success(`${f.label} ${on ? 'on' : 'off'}.`),
                          onError: (err) => toast.error(describeError(err)),
                        },
                      );
                    }}
                  />
                  {f.enabled ? 'On' : 'Off'}
                </label>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </section>
  );
}

/** Feature access: the core feature switches, then the modules (Astra, Call-it, Tala) with their own settings. */
export function TenantFeaturesTab({ tenant }: { tenant: Tenant }) {
  const modules = usePlatformModules(tenant.id);
  return (
    <div className="flex flex-col gap-8">
      <FeatureSwitches tenantId={tenant.id} />
      <section aria-labelledby="modules-h">
        <h2 id="modules-h" className="mb-3 text-base font-semibold">
          Modules
        </h2>
        {modules.isPending ? (
          <ModuleCardsSkeleton />
        ) : modules.isError ? (
          <ErrorState
            message={describeError(modules.error)}
            onRetry={() => void modules.refetch()}
          />
        ) : (
          <div className="flex flex-col gap-4">
            {modules.data.map((m) => (
              <ModuleCard
                key={`${m.code}-${m.external_team_id}-${m.enabled}`}
                tenantId={tenant.id}
                module={m}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
