import { useEffect, useId, useState } from 'react';
import {
  Button,
  Card,
  ConfirmDialog,
  ErrorState,
  FormError,
  PageHeader,
  SaveBar,
  SelectField,
  Skeleton,
  SkeletonField,
  TextField,
  useToast,
} from '../../components/ui';
import { describeError } from '../../services/api/errors';
import type { PublicTenant } from '../../services/api/types';
import { AdminPreview } from './AdminPreview';
import { FONT_OPTIONS, LAYOUT_OPTIONS, loadFont, palette } from '../tenant-look/look';
import {
  OWN_SCOPE,
  useBranding,
  type BrandingImageKind,
  useRemoveBrandingImage,
  useResetBranding,
  useSaveBranding,
  useUploadBrandingImage,
  type TenantScope,
} from './api';

/** WCAG contrast of a #RRGGBB colour against white (the colour of the button text). */
export function contrastWithWhite(hex: string): number {
  return contrastBetween(hex, '#FFFFFF');
}

function luminance(hex: string): number {
  const lum = (v: number) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  return 0.2126 * lum(r!) + 0.7152 * lum(g!) + 0.0722 * lum(b!);
}

/** WCAG contrast ratio between two #RRGGBB colours. */
export function contrastBetween(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
}

// What the portal uses when an organization sets no page or text colour
const DEFAULT_PAGE = '#F4F7FB';
const DEFAULT_INK = '#12243D';

const HEX = /^#[0-9A-Fa-f]{6}$/;

/** `min` is the contrast against white the colour needs: 4.5 where white text sits on it, 3 where it only has to be seen. */
function colourProblem(value: string, min = 4.5): string | undefined {
  if (value === '') return undefined;
  if (!HEX.test(value)) return 'Use a colour like #355DAD.';
  if (contrastWithWhite(value) < min)
    return min === 4.5
      ? 'Too light for white button text. Choose a darker colour.'
      : 'Too light to see on white. Choose a darker colour.';
  return undefined;
}

/** Text must read on the page background; an unset side is the portal default. Blamed on the side the person set. */
function pairProblem(text: string, background: string): string | undefined {
  if (!HEX.test(text) && !HEX.test(background)) return undefined;
  const t = HEX.test(text) ? text : DEFAULT_INK;
  const b = HEX.test(background) ? background : DEFAULT_PAGE;
  const ratio = contrastBetween(t, b);
  return ratio < 4.5
    ? `Text on this background has only ${ratio.toFixed(1)}:1 contrast; at least 4.5:1 is needed.`
    : undefined;
}

const LIMITS = { short_name: 40, tagline: 120, login_welcome_message: 200 } as const;
const MARKUP = /[<>]/;

function textProblem(value: string, max: number): string | undefined {
  if (value.length > max) return `At most ${max} characters.`;
  if (MARKUP.test(value)) return 'The characters < and > are not allowed.';
  return undefined;
}

/** How the organization looks: names, colours, font style, pictures and the sign-in page, with a live preview. */
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
  if (branding.isPending) return <BrandingSkeleton />;
  if (branding.isError)
    return (
      <ErrorState message={describeError(branding.error)} onRetry={() => void branding.refetch()} />
    );
  return <BrandingForm key={branding.data.version} data={branding.data} scope={scope} />;
}

// The cards' explanations, shared with the loading placeholder so both read the same
const BRANDING_NOTE =
  'Names, tagline and pictures. Pictures are saved as soon as you add them; everything else applies when you press Save changes.';
const COLOURS_NOTE =
  'Leave a color empty to use the Sailix default. Buttons and highlights need enough contrast to stay readable.';
const TYPOGRAPHY_NOTE =
  'Pick the typeface for headings and text. Web fonts are fetched only for organizations that choose them; system fonts download nothing.';
const LAYOUT_NOTE = 'Presets that change spacing and size in the admin portal, never the content.';

/** Recommended picture sizes, from how each one is shown. */
const GUIDANCE: Record<BrandingImageKind, { label: string; hint: string }> = {
  logo: {
    label: 'Logo',
    hint: 'Square, 512 × 512 px (at least 256). Shown in the menu and on the sign-in page. JPEG or PNG.',
  },
  favicon: {
    label: 'Favicon',
    hint: 'Square, 128 × 128 px. The small icon in the browser tab, so keep the shape simple. JPEG or PNG.',
  },
  'login-logo': {
    label: 'Sign-in logo',
    hint: 'Optional, square, 512 × 512 px. Shown above the sign-in card; the logo is used when empty.',
  },
  'login-background': {
    label: 'Sign-in background',
    hint: 'Optional, landscape, 1920 × 1080 px. Sits behind a soft white layer, so calm photos with little detail work best.',
  },
};

function BrandingForm({ data, scope }: { data: PublicTenant; scope: TenantScope }) {
  const save = useSaveBranding(scope);
  const upload = useUploadBrandingImage(scope);
  const remove = useRemoveBrandingImage(scope);
  const reset = useResetBranding(scope);
  const toast = useToast();
  const [shortName, setShortName] = useState(data.short_name ?? '');
  const [tagline, setTagline] = useState(data.tagline ?? '');
  const [welcome, setWelcome] = useState(data.login_welcome_message ?? '');
  const [primary, setPrimary] = useState(data.primary_color ?? '');
  const [secondary, setSecondary] = useState(data.secondary_color ?? '');
  const [accent, setAccent] = useState(data.accent_color ?? '');
  const [background, setBackground] = useState(data.background_color ?? '');
  const [text, setText] = useState(data.text_color ?? '');
  const [font, setFont] = useState<NonNullable<PublicTenant['font_preset']>>(
    data.font_preset ?? 'default',
  );
  const [layout, setLayout] = useState<NonNullable<PublicTenant['dashboard_layout']>>(
    data.dashboard_layout ?? 'comfortable',
  );
  const [error, setError] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);

  // what is saved, to tell whether anything has changed since
  const saved = {
    shortName: data.short_name ?? '',
    tagline: data.tagline ?? '',
    welcome: data.login_welcome_message ?? '',
    primary: data.primary_color ?? '',
    secondary: data.secondary_color ?? '',
    accent: data.accent_color ?? '',
    background: data.background_color ?? '',
    text: data.text_color ?? '',
    font: data.font_preset ?? 'default',
    layout: data.dashboard_layout ?? 'comfortable',
  };
  const dirty =
    shortName !== saved.shortName ||
    tagline !== saved.tagline ||
    welcome !== saved.welcome ||
    primary !== saved.primary ||
    secondary !== saved.secondary ||
    accent !== saved.accent ||
    background !== saved.background ||
    text !== saved.text ||
    font !== saved.font ||
    layout !== saved.layout;
  function discard() {
    setShortName(saved.shortName);
    setTagline(saved.tagline);
    setWelcome(saved.welcome);
    setPrimary(saved.primary);
    setSecondary(saved.secondary);
    setAccent(saved.accent);
    setBackground(saved.background);
    setText(saved.text);
    setFont(saved.font);
    setLayout(saved.layout);
    setError(null);
  }

  const problems = {
    primary: colourProblem(primary),
    secondary: colourProblem(secondary),
    accent: colourProblem(accent, 3),
    background: background ? pairProblem(text, background) : undefined,
    text: text ? pairProblem(text, background) : undefined,
    shortName: textProblem(shortName, LIMITS.short_name),
    tagline: textProblem(tagline, LIMITS.tagline),
    welcome: textProblem(welcome, LIMITS.login_welcome_message),
  };
  const blocked = Object.values(problems).some(Boolean);

  const ok = (v: string, problem?: string) => (v && !problem ? v : null);
  const live = {
    primary_color: ok(primary, problems.primary),
    secondary_color: ok(secondary, problems.secondary),
    accent_color: ok(accent, problems.accent),
    background_color: ok(background, problems.background),
    text_color: ok(text, problems.text),
    font_preset: font === 'default' ? null : font,
  };
  const preview = palette(live);
  useEffect(() => loadFont(font), [font]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (blocked) return setError('Fix the highlighted fields first.');
    try {
      await save.mutateAsync({
        short_name: shortName.trim() || null,
        tagline: tagline.trim() || null,
        login_welcome_message: welcome.trim() || null,
        primary_color: primary || null,
        secondary_color: secondary || null,
        accent_color: accent || null,
        background_color: background || null,
        text_color: text || null,
        font_preset: font === 'default' ? null : font,
        dashboard_layout: layout === 'comfortable' ? null : layout,
      });
      toast.success('Appearance saved.');
    } catch (err) {
      setError(describeError(err));
    }
  }

  const busy = upload.isPending || remove.isPending;
  async function pick(kind: BrandingImageKind, files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    try {
      await upload.mutateAsync({ kind, file });
      toast.success(`${GUIDANCE[kind].label} updated.`);
    } catch (err) {
      toast.error(describeError(err));
    }
  }
  async function drop(kind: BrandingImageKind) {
    try {
      await remove.mutateAsync(kind);
      toast.success(`${GUIDANCE[kind].label} removed.`);
    } catch (err) {
      toast.error(describeError(err));
    }
  }

  const urls: Record<BrandingImageKind, string | null> = {
    logo: data.logo_url,
    favicon: data.favicon_url,
    'login-logo': data.login_logo_url ?? null,
    'login-background': data.login_background_url ?? null,
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_26rem]">
        <form
          id="appearance-form"
          onSubmit={submit}
          noValidate
          className="order-2 flex min-w-0 flex-col gap-6 xl:order-1"
        >
          <FormError message={error} />

          <Card title="Branding" description={BRANDING_NOTE}>
            <div className="flex flex-col gap-4">
              <TextField
                label="Organization name"
                value={data.name}
                disabled
                readOnly
                hint={
                  scope.own
                    ? 'The full name is set by the platform administrator.'
                    : 'Edit the full name on the Overview tab.'
                }
              />
              <TextField
                label="Short name"
                maxLength={LIMITS.short_name}
                value={shortName}
                onChange={(e) => setShortName(e.target.value)}
                error={problems.shortName}
                hint="A short form of the name for tight spaces, such as the mobile app header."
              />
              <TextField
                label="Tagline"
                maxLength={LIMITS.tagline}
                value={tagline}
                onChange={(e) => setTagline(e.target.value)}
                error={problems.tagline}
                hint="Shown under your name on the sign-in page. Plain text."
              />
            </div>
            <h3 className="mb-3 mt-6 border-t border-line pt-5 text-sm font-semibold">Pictures</h3>
            <div className="flex flex-col divide-y divide-line">
              {(Object.keys(GUIDANCE) as BrandingImageKind[]).map((kind) => (
                <div key={kind} className="py-4 first:pt-0 last:pb-0">
                  <ImageSlot
                    kind={kind}
                    label={GUIDANCE[kind].label}
                    url={urls[kind]}
                    hint={GUIDANCE[kind].hint}
                    wide={kind === 'login-background'}
                    busy={busy}
                    onPick={pick}
                    onRemove={drop}
                  />
                </div>
              ))}
            </div>
          </Card>

          <Card title="Colors" description={COLOURS_NOTE}>
            <div className="flex flex-col gap-5">
              <ColourField
                label="Primary color"
                fallback="#1260D8"
                value={primary}
                onChange={setPrimary}
                problem={problems.primary}
                hint="Buttons, the menu and highlights (white text on top)."
              />
              <ColourField
                label="Secondary color"
                fallback="#52BB88"
                value={secondary}
                onChange={setSecondary}
                problem={problems.secondary}
                hint="Supporting accents (white text on top)."
              />
              <ColourField
                label="Accent color"
                fallback="#1260D8"
                value={accent}
                onChange={setAccent}
                problem={problems.accent}
                hint="Links and focus rings. Follows the primary colour when empty."
              />
              <ColourField
                label="Background color"
                fallback="#F4F8FC"
                value={background}
                onChange={setBackground}
                problem={problems.background}
                hint="The page behind the cards."
              />
              <ColourField
                label="Text color"
                fallback="#0F2036"
                value={text}
                onChange={setText}
                problem={problems.text}
                hint="Default text and headings. Cards stay white."
              />
            </div>
          </Card>

          <Card title="Typography" description={TYPOGRAPHY_NOTE}>
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1">
                <SelectField
                  label="Font style"
                  value={font}
                  onChange={(e) => setFont(e.target.value as typeof font)}
                  options={FONT_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
                />
                <p className="text-xs text-muted">
                  {FONT_OPTIONS.find((o) => o.value === font)?.hint}
                </p>
              </div>
              <div
                aria-hidden="true"
                className="rounded-xl border border-line bg-page p-4"
                style={preview as React.CSSProperties}
              >
                <p
                  className="font-heading text-xl font-bold"
                  style={{ fontFamily: 'var(--font-heading)' }}
                >
                  Welcome aboard
                </p>
                <p className="mt-1 text-sm text-muted" style={{ fontFamily: 'var(--font-sans)' }}>
                  Every crew member finds what they need here. The quick brown fox jumps over the
                  lazy dog 0123456789
                </p>
              </div>
            </div>
          </Card>

          <Card title="Layout" description={LAYOUT_NOTE}>
            <div className="flex flex-col gap-1">
              <SelectField
                label="Dashboard layout"
                value={layout}
                onChange={(e) => setLayout(e.target.value as typeof layout)}
                options={LAYOUT_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
              />
              <p className="text-xs text-muted">
                {LAYOUT_OPTIONS.find((o) => o.value === layout)?.hint}
              </p>
            </div>
          </Card>

          <Card title="Login page">
            <TextField
              label="Welcome message"
              maxLength={LIMITS.login_welcome_message}
              value={welcome}
              onChange={(e) => setWelcome(e.target.value)}
              error={problems.welcome}
              hint="Shown above the sign-in form. Leave empty for none."
            />
          </Card>
        </form>

        <aside aria-label="Preview" className="order-1 min-w-0 xl:sticky xl:top-20 xl:order-2">
          <Card title="Preview">
            <AdminPreview
              vars={preview as React.CSSProperties}
              name={shortName.trim() || data.name}
              logoUrl={urls.logo}
              compact={layout === 'compact'}
            />
          </Card>
        </aside>
      </div>

      <SaveBar
        dirty={dirty}
        saving={save.isPending}
        canSave={!blocked}
        formId="appearance-form"
        onDiscard={discard}
        extra={
          scope.own ? null : (
            <Button variant="secondary" onClick={() => setConfirmReset(true)}>
              Reset to the Sailix look
            </Button>
          )
        }
      />

      <ConfirmDialog
        open={confirmReset}
        title="Reset to the Sailix look"
        description={`Reset ${data.name}'s appearance to the Sailix default? Its people, data and features are not affected.`}
        confirmLabel="Reset"
        loading={reset.isPending}
        onCancel={() => setConfirmReset(false)}
        onConfirm={() =>
          reset.mutate(undefined, {
            onSuccess: () => {
              setConfirmReset(false);
              toast.success('Back to the Sailix look.');
            },
            onError: (e) => {
              setConfirmReset(false);
              toast.error(describeError(e));
            },
          })
        }
      />
    </div>
  );
}

function ColourField({
  label,
  value,
  onChange,
  fallback,
  problem,
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  /** What the colour is when left empty. */
  fallback: string;
  problem?: string;
  hint?: string;
}) {
  const id = useId();
  const bad = value !== '' && !HEX.test(value);
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-medium">
        {label}
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="color"
          aria-label={`Pick ${label.toLowerCase()}`}
          value={HEX.test(value) ? value : fallback}
          onChange={(e) => onChange(e.target.value.toUpperCase())}
          className="h-10 w-12 cursor-pointer rounded-lg border border-line bg-surface p-0.5"
        />
        <input
          id={id}
          type="text"
          value={value}
          placeholder={fallback.toLowerCase()}
          maxLength={7}
          aria-invalid={bad || problem ? true : undefined}
          aria-describedby={`${id}-note`}
          onChange={(e) => onChange(e.target.value.trim())}
          className={`min-h-10 w-32 rounded-xl border bg-surface px-3.5 font-mono text-sm placeholder:text-muted hover:border-brand-600/60 focus:border-brand-600 ${
            bad || problem ? 'border-bad-fg' : 'border-line'
          }`}
        />
        {value !== '' ? (
          <button
            type="button"
            onClick={() => onChange('')}
            className="text-xs text-muted hover:underline"
          >
            Reset to default
          </button>
        ) : (
          <span className="text-xs text-muted">Sailix default</span>
        )}
      </div>
      <p
        id={`${id}-note`}
        role={bad || problem ? 'alert' : undefined}
        className={`mt-1 text-xs ${bad || problem ? 'text-bad-fg' : 'text-muted'}`}
      >
        {problem ?? (bad ? 'Use a 6-digit hex colour like #1260D8.' : hint)}
      </p>
    </div>
  );
}

function ImageSlot({
  kind,
  label,
  url,
  hint,
  wide = false,
  busy,
  onPick,
  onRemove,
}: {
  kind: BrandingImageKind;
  label: string;
  url: string | null;
  hint: string;
  wide?: boolean;
  busy: boolean;
  onPick: (kind: BrandingImageKind, files: FileList | null) => void;
  onRemove: (kind: BrandingImageKind) => void;
}) {
  return (
    <div className="flex items-start gap-4">
      <div
        className={`flex shrink-0 items-center justify-center overflow-hidden rounded-md border border-line bg-page ${
          wide ? 'h-16 w-28' : 'h-16 w-16'
        }`}
      >
        {url ? (
          <img
            src={url}
            alt={`${label} preview`}
            className={wide ? 'h-full w-full object-cover' : 'max-h-full max-w-full object-contain'}
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

/**
 * The Appearance editor while it loads: the same two columns, the same cards with their real titles, descriptions and field
 * labels, the preview beside them and the save bar; only the controls and pictures shimmer.
 */
export function BrandingSkeleton() {
  const colour = (label: string) => (
    <div key={label} className="flex items-end gap-3">
      <div className="flex-1">
        <SkeletonField label={label} />
      </div>
      <Skeleton className="mb-1 h-10 w-12 rounded-md" />
    </div>
  );
  return (
    <div role="status" aria-label="Loading appearance" className="flex flex-col gap-6">
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_26rem]">
        <div className="order-2 flex min-w-0 flex-col gap-6 xl:order-1">
          <Card title="Branding" description={BRANDING_NOTE}>
            <div className="flex flex-col gap-4">
              <SkeletonField label="Organization name" />
              <SkeletonField label="Short name" />
              <SkeletonField label="Tagline" />
            </div>
            <h3 className="mb-3 mt-6 border-t border-line pt-5 text-sm font-semibold">Pictures</h3>
            <div className="flex flex-col divide-y divide-line">
              {(Object.keys(GUIDANCE) as BrandingImageKind[]).map((kind) => (
                <div key={kind} className="flex items-start gap-4 py-4 first:pt-0 last:pb-0">
                  <Skeleton
                    className={`shrink-0 rounded-md ${kind === 'login-background' ? 'h-16 w-28' : 'size-16'}`}
                  />
                  <div className="min-w-0 flex-1 space-y-2">
                    <span className="text-sm font-medium">{GUIDANCE[kind].label}</span>
                    <Skeleton className="h-4 w-48 max-w-full" />
                    <Skeleton className="h-3 w-full" />
                  </div>
                </div>
              ))}
            </div>
          </Card>
          <Card title="Colors" description={COLOURS_NOTE}>
            <div className="flex flex-col gap-5">
              {[
                'Primary color',
                'Secondary color',
                'Accent color',
                'Background color',
                'Text color',
              ].map(colour)}
            </div>
          </Card>
          <Card title="Typography" description={TYPOGRAPHY_NOTE}>
            <div className="flex flex-col gap-4">
              <SkeletonField label="Font style" />
              <Skeleton className="h-24 w-full rounded-xl" />
            </div>
          </Card>
          <Card title="Layout" description={LAYOUT_NOTE}>
            <SkeletonField label="Dashboard layout" />
          </Card>
          <Card title="Login page">
            <SkeletonField label="Welcome message" />
          </Card>
        </div>
        <aside aria-hidden="true" className="order-1 min-w-0 xl:order-2">
          <Card title="Preview">
            <div className="rounded-xl border border-line p-4">
              <div className="flex flex-col items-center gap-2">
                <Skeleton className="h-12 w-24" />
                <Skeleton className="h-3 w-32" />
                <Skeleton className="h-3 w-40" />
              </div>
              <div className="mt-3 rounded-xl border border-line bg-white p-3 shadow-sm">
                <Skeleton className="mb-2 h-3 w-16" />
                <Skeleton className="mb-3 h-7 w-full rounded" />
                <Skeleton className="h-9 w-full rounded-full" />
              </div>
            </div>
          </Card>
        </aside>
      </div>
      <div className="flex items-center justify-between gap-3 rounded-2xl border border-line bg-surface p-3 shadow-[var(--shadow-soft)]">
        <span className="text-sm text-muted">All changes saved</span>
        <Skeleton className="h-10 w-36 rounded-full" />
      </div>
      <span className="sr-only">Loading…</span>
    </div>
  );
}
