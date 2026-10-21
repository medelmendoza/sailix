import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import {
  Button,
  Card,
  ErrorState,
  FormError,
  SaveBar,
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
import type { PlatformTenantFeature, PlatformTenantModule, Tenant } from '../../services/api/types';
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
  return (
    <section aria-label="Feature access" className="flex flex-col gap-4">
      <p className="text-sm text-muted">{FEATURES_NOTE}</p>
      {features.isPending ? (
        <FeatureRowsSkeleton />
      ) : features.isError ? (
        <ErrorState
          message={describeError(features.error)}
          onRetry={() => void features.refetch()}
        />
      ) : (
        <FeatureEditor tenantId={tenantId} features={features.data} />
      )}
    </section>
  );
}

/**
 * The switches as a draft: pressing one changes only what you see, the bar at the bottom says how many changes are waiting,
 * and one Save sends them together. Discard throws the draft away.
 */
function FeatureEditor({
  tenantId,
  features,
}: {
  tenantId: string;
  features: PlatformTenantFeature[];
}) {
  const update = useUpdateFeatures(tenantId);
  const toast = useToast();
  const [draft, setDraft] = useState<Record<string, boolean>>({}); // feature code => the value pressed, only where it differs
  const isOn = (f: PlatformTenantFeature) => draft[f.code] ?? f.enabled;
  const changed = features.filter((f) => isOn(f) !== f.enabled);

  function toggle(f: PlatformTenantFeature) {
    const next = !isOn(f);
    setDraft((d) => {
      const rest = { ...d };
      delete rest[f.code];
      return next === f.enabled ? rest : { ...rest, [f.code]: next };
    });
  }

  function save() {
    update.mutate(Object.fromEntries(changed.map((f) => [f.code, isOn(f)])), {
      onSuccess: () => {
        setDraft({});
        toast.success('Feature access saved.');
      },
      onError: (err) => toast.error(describeError(err)),
    });
  }

  return (
    <>
      <ul className="divide-y divide-line rounded-[var(--radius-card)] border border-line bg-surface shadow-[var(--shadow-soft)]">
        {features.map((f) => {
          const on = isOn(f);
          return (
            <li key={f.code} className="flex items-center justify-between gap-4 px-4 py-3.5">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium">{f.label}</span>
                  <code className="rounded bg-brand-50 px-1.5 py-0.5 text-[11px] text-brand-800">
                    {f.code}
                  </code>
                </div>
                <p className="mt-0.5 text-sm text-muted">{f.description}</p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={on}
                aria-label={`${f.label} access`}
                title={`${on ? 'Turn off' : 'Turn on'} ${f.label}`}
                disabled={update.isPending}
                onClick={() => toggle(f)}
                className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:opacity-50 ${
                  on ? 'bg-brand-700' : 'bg-muted/40'
                }`}
              >
                <span
                  aria-hidden="true"
                  className={`inline-block size-5 rounded-full bg-white shadow transition-transform ${
                    on ? 'translate-x-5' : 'translate-x-0.5'
                  }`}
                />
              </button>
            </li>
          );
        })}
      </ul>
      <SaveBar
        dirty={changed.length > 0}
        saving={update.isPending}
        onDiscard={() => setDraft({})}
        onSave={save}
      />
    </>
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
