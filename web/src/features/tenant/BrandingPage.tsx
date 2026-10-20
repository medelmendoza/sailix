import { useState } from 'react';
import {
  Button,
  Card,
  ErrorState,
  FormError,
  PageHeader,
  Spinner,
  TextField,
  useToast,
} from '../../components/ui';
import { describeError } from '../../services/api/errors';
import type { PublicTenant } from '../../services/api/types';
import { palette } from '../tenant-look/look';
import {
  OWN_SCOPE,
  useBranding,
  useRemoveBrandingImage,
  useResetBranding,
  useSaveBranding,
  useUploadBrandingImage,
  type TenantScope,
} from './api';

/** WCAG contrast of a #RRGGBB colour against white (the colour of the button text). */
export function contrastWithWhite(hex: string): number {
  const lum = (v: number) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  return 1.05 / (0.2126 * lum(r!) + 0.7152 * lum(g!) + 0.0722 * lum(b!) + 0.05);
}

const HEX = /^#[0-9A-Fa-f]{6}$/;

function colourProblem(value: string): string | undefined {
  if (value === '') return undefined;
  if (!HEX.test(value)) return 'Use a colour like #355DAD.';
  if (contrastWithWhite(value) < 4.5)
    return 'Too light for white button text. Choose a darker colour.';
  return undefined;
}

/** How the organization looks: tagline, two colours, logo and favicon, with a live preview. */
export function BrandingPage() {
  return (
    <>
      <PageHeader
        title="Branding"
        description="How your organization looks on the sign-in page and across this portal. Leave a field empty to use the Sailix default."
      />
      <BrandingEditor scope={OWN_SCOPE} />
    </>
  );
}

/** The branding form for one organization: the signed-in one's own, or (superadmin) the one named by the scope. */
export function BrandingEditor({ scope }: { scope: TenantScope }) {
  const branding = useBranding(scope);
  if (branding.isPending) return <Spinner />;
  if (branding.isError)
    return (
      <ErrorState message={describeError(branding.error)} onRetry={() => void branding.refetch()} />
    );
  return <BrandingForm key={branding.data.version} data={branding.data} scope={scope} />;
}

function BrandingForm({ data, scope }: { data: PublicTenant; scope: TenantScope }) {
  const save = useSaveBranding(scope);
  const upload = useUploadBrandingImage(scope);
  const remove = useRemoveBrandingImage(scope);
  const reset = useResetBranding(scope);
  const toast = useToast();
  const [tagline, setTagline] = useState(data.tagline ?? '');
  const [primary, setPrimary] = useState(data.primary_color ?? '');
  const [secondary, setSecondary] = useState(data.secondary_color ?? '');
  const [error, setError] = useState<string | null>(null);

  const primaryProblem = colourProblem(primary);
  const secondaryProblem = colourProblem(secondary);
  const preview = palette({
    primary_color: primary && !primaryProblem ? primary : null,
    secondary_color: secondary && !secondaryProblem ? secondary : null,
  });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (primaryProblem || secondaryProblem) return setError('Fix the colours first.');
    try {
      await save.mutateAsync({
        tagline: tagline.trim() || null,
        primary_color: primary || null,
        secondary_color: secondary || null,
      });
      toast.success('Branding saved.');
    } catch (err) {
      setError(describeError(err));
    }
  }

  async function pick(kind: 'logo' | 'favicon', files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    try {
      await upload.mutateAsync({ kind, file });
      toast.success(kind === 'logo' ? 'Logo updated.' : 'Favicon updated.');
    } catch (err) {
      toast.error(describeError(err));
    }
  }

  async function drop(kind: 'logo' | 'favicon') {
    try {
      await remove.mutateAsync(kind);
      toast.success(kind === 'logo' ? 'Logo removed.' : 'Favicon removed.');
    } catch (err) {
      toast.error(describeError(err));
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card title="Look">
        <form onSubmit={submit} noValidate className="flex flex-col gap-4">
          <FormError message={error} />
          <TextField
            label="Tagline"
            maxLength={120}
            value={tagline}
            onChange={(e) => setTagline(e.target.value)}
            hint="Shown under your name on the sign-in page. Plain text."
          />
          <ColourField
            label="Primary colour"
            value={primary}
            onChange={setPrimary}
            problem={primaryProblem}
          />
          <ColourField
            label="Secondary colour"
            value={secondary}
            onChange={setSecondary}
            problem={secondaryProblem}
          />
          <div>
            <Button type="submit" loading={save.isPending}>
              Save branding
            </Button>
            {scope.own ? null : (
              <Button
                variant="secondary"
                className="ml-2"
                loading={reset.isPending}
                onClick={() =>
                  reset.mutate(undefined, {
                    onSuccess: () => toast.success('Back to the Sailix look.'),
                    onError: (e) => toast.error(describeError(e)),
                  })
                }
              >
                Reset to the Sailix look
              </Button>
            )}
          </div>
        </form>
      </Card>

      <div className="flex flex-col gap-6">
        <Card title="Logo and favicon">
          <ImageSlot
            kind="logo"
            label="Logo"
            url={data.logo_url}
            hint="A JPEG or PNG. It is shrunk to 512 pixels."
            busy={upload.isPending || remove.isPending}
            onPick={pick}
            onRemove={drop}
          />
          <div className="mt-4 border-t border-line pt-4">
            <ImageSlot
              kind="favicon"
              label="Favicon"
              url={data.favicon_url}
              hint="The small icon in the browser tab. A square JPEG or PNG; shrunk to 128 pixels."
              busy={upload.isPending || remove.isPending}
              onPick={pick}
              onRemove={drop}
            />
          </div>
        </Card>

        <Card title="Preview">
          <div style={preview as React.CSSProperties} className="rounded-md border border-line p-4">
            <p
              className="text-sm font-semibold uppercase tracking-widest"
              style={{ color: 'var(--color-accent-600)' }}
            >
              {data.name}
            </p>
            <p className="mt-1 text-sm text-muted">{tagline || 'Your tagline appears here.'}</p>
            <button
              type="button"
              className="mt-3 rounded-md px-4 py-2 text-sm font-medium text-white"
              style={{ backgroundColor: 'var(--color-brand-700, #355dad)' }}
            >
              Sign in
            </button>
          </div>
        </Card>
      </div>
    </div>
  );
}

function ColourField({
  label,
  value,
  onChange,
  problem,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  problem?: string;
}) {
  return (
    <div className="flex items-end gap-3">
      <div className="flex-1">
        <TextField
          label={label}
          value={value}
          onChange={(e) => onChange(e.target.value.trim())}
          placeholder="#355DAD"
          maxLength={7}
          error={problem}
        />
      </div>
      <input
        type="color"
        aria-label={`Pick ${label.toLowerCase()}`}
        value={HEX.test(value) ? value : '#355dad'}
        onChange={(e) => onChange(e.target.value.toUpperCase())}
        className="mb-1 h-10 w-12 cursor-pointer rounded-md border border-line bg-surface"
      />
    </div>
  );
}

function ImageSlot({
  kind,
  label,
  url,
  hint,
  busy,
  onPick,
  onRemove,
}: {
  kind: 'logo' | 'favicon';
  label: string;
  url: string | null;
  hint: string;
  busy: boolean;
  onPick: (kind: 'logo' | 'favicon', files: FileList | null) => void;
  onRemove: (kind: 'logo' | 'favicon') => void;
}) {
  return (
    <div className="flex items-start gap-4">
      <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-md border border-line bg-page">
        {url ? (
          <img
            src={url}
            alt={`${label} preview`}
            className="max-h-full max-w-full object-contain"
          />
        ) : (
          <span className="text-xs text-muted">None</span>
        )}
      </div>
      <div className="flex min-w-0 flex-col gap-1">
        <label htmlFor={`brand-${kind}`} className="text-sm font-medium">
          {label}
        </label>
        <input
          id={`brand-${kind}`}
          type="file"
          accept="image/png,image/jpeg"
          disabled={busy}
          className="text-sm"
          onChange={(e) => onPick(kind, e.target.files)}
        />
        <p className="text-xs text-muted">{hint}</p>
        {url ? (
          <button
            type="button"
            className="self-start text-xs text-accent-600 underline"
            disabled={busy}
            onClick={() => onRemove(kind)}
          >
            Remove {label.toLowerCase()}
          </button>
        ) : null}
      </div>
    </div>
  );
}
