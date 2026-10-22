import type { PublicTenant } from '../../services/api/types';

const LOOK_CACHE = 'sailix.look:';

/** Mixes two #RRGGBB colours: t = 0 gives `a`, t = 1 gives `b`. */
export function mix(a: string, b: string, t: number): string {
  const ch = (hex: string, i: number) => parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16);
  const out = [0, 1, 2].map((i) => Math.round(ch(a, i) + (ch(b, i) - ch(a, i)) * t));
  return `#${out.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

const HEX = /^#[0-9A-Fa-f]{6}$/;

/** The colour variables the whole portal is drawn with, derived from the organization's two colours. */
export function palette(
  look: Partial<
    Pick<
      PublicTenant,
      | 'primary_color'
      | 'secondary_color'
      | 'accent_color'
      | 'background_color'
      | 'text_color'
      | 'font_preset'
    >
  >,
): Record<string, string> {
  const primary = look.primary_color && HEX.test(look.primary_color) ? look.primary_color : null;
  const secondary =
    look.secondary_color && HEX.test(look.secondary_color) ? look.secondary_color : null;
  const vars: Record<string, string> = {};
  if (primary) {
    vars['--color-brand-50'] = mix(primary, '#ffffff', 0.94);
    vars['--color-brand-100'] = mix(primary, '#ffffff', 0.84);
    vars['--color-brand-600'] = mix(primary, '#ffffff', 0.12);
    vars['--color-brand-700'] = primary;
    vars['--color-brand-800'] = mix(primary, '#000000', 0.25);
    vars['--color-brand-900'] = mix(primary, '#000000', 0.5);
    vars['--color-accent-600'] = primary;
    vars['--color-accent-50'] = mix(primary, '#ffffff', 0.94);
    vars['--color-accent-100'] = mix(primary, '#ffffff', 0.88);
    vars['--color-accent-500'] = secondary ?? mix(primary, '#ffffff', 0.15);
  } else if (secondary) {
    vars['--color-accent-500'] = secondary;
  }
  // focus rings and links: the accent when there is one, else they follow the primary colour
  if (look.accent_color && HEX.test(look.accent_color))
    vars['--color-accent-600'] = look.accent_color;
  if (look.background_color && HEX.test(look.background_color))
    vars['--color-page'] = look.background_color;
  if (look.text_color && HEX.test(look.text_color)) vars['--color-ink'] = look.text_color;
  const font = look.font_preset ? FONT_STACKS[look.font_preset] : undefined;
  if (font) {
    vars['--font-sans'] = font;
    vars['--font-heading'] = look.font_preset ? (HEADING_STACKS[look.font_preset] ?? font) : font; // a chosen font style applies to the headings too
  }
  return vars;
}

const SANS = "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";
const SERIF = "ui-serif, Georgia, Cambria, 'Times New Roman', serif";

/** Body font of each style. The first three are fonts every device has; the rest are web fonts fetched when chosen. */
export const FONT_STACKS: Record<string, string> = {
  rounded:
    "ui-rounded, 'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Quicksand, system-ui, sans-serif",
  serif: SERIF,
  system: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
  modern: `Inter, ${SANS}`,
  friendly: `Nunito, ${SANS}`,
  geometric: `Poppins, ${SANS}`,
  playful: `Nunito, ${SANS}`,
  elegant: `Lora, ${SERIF}`,
  classic: `Merriweather, ${SERIF}`,
};

/** A style whose headings differ from its body text. */
const HEADING_STACKS: Record<string, string> = {
  playful: `Fredoka, Nunito, ${SANS}`,
  elegant: `'Playfair Display', Lora, ${SERIF}`,
};

export const FONT_OPTIONS = [
  { value: 'default', label: 'Default', hint: 'The standard friendly look used by the platform.' },
  {
    value: 'rounded',
    label: 'Rounded',
    hint: 'Soft, rounded system fonts. No fonts are downloaded.',
  },
  { value: 'serif', label: 'Serif', hint: 'Traditional serif system fonts for a formal tone.' },
  {
    value: 'system',
    label: 'System',
    hint: "Each device's own interface font. Fastest, nothing is downloaded.",
  },
  {
    value: 'modern',
    label: 'Modern (Inter)',
    hint: 'Clean, highly readable sans-serif for a contemporary look.',
  },
  {
    value: 'friendly',
    label: 'Friendly (Nunito)',
    hint: 'Soft rounded sans-serif that feels warm and approachable.',
  },
  {
    value: 'geometric',
    label: 'Geometric (Poppins)',
    hint: 'Round, confident letterforms with a bold, modern feel.',
  },
  {
    value: 'playful',
    label: 'Playful (Fredoka + Nunito)',
    hint: 'Chunky, cheerful headings with friendly body text.',
  },
  {
    value: 'elegant',
    label: 'Elegant (Playfair Display + Lora)',
    hint: 'Refined serif headings with a graceful serif body, for a premium feel.',
  },
  {
    value: 'classic',
    label: 'Classic (Merriweather)',
    hint: 'Sturdy, traditional serif designed to read well on screens.',
  },
] as const;

export const LAYOUT_OPTIONS = [
  { value: 'comfortable', label: 'Comfortable', hint: 'Roomy cards and spacing.' },
  {
    value: 'compact',
    label: 'Compact',
    hint: 'Denser cards, smaller gaps and type: more on screen at once.',
  },
] as const;

const loaded = new Set<string>();

/** Fetches the web font files of a style, once, and only when somebody chose it. System styles download nothing. */
export function loadFont(preset: string | null | undefined): void {
  if (!preset || loaded.has(preset)) return;
  const files: Record<string, Array<() => Promise<unknown>>> = {
    modern: [
      () => import('@fontsource/inter/latin-400.css'),
      () => import('@fontsource/inter/latin-600.css'),
      () => import('@fontsource/inter/latin-700.css'),
    ],
    friendly: [
      () => import('@fontsource/nunito/latin-400.css'),
      () => import('@fontsource/nunito/latin-600.css'),
      () => import('@fontsource/nunito/latin-700.css'),
    ],
    geometric: [
      () => import('@fontsource/poppins/latin-400.css'),
      () => import('@fontsource/poppins/latin-600.css'),
      () => import('@fontsource/poppins/latin-700.css'),
    ],
    playful: [
      () => import('@fontsource/fredoka/latin-500.css'),
      () => import('@fontsource/fredoka/latin-600.css'),
      () => import('@fontsource/fredoka/latin-700.css'),
      () => import('@fontsource/nunito/latin-400.css'),
      () => import('@fontsource/nunito/latin-600.css'),
    ],
    elegant: [
      () => import('@fontsource/playfair-display/latin-600.css'),
      () => import('@fontsource/playfair-display/latin-700.css'),
      () => import('@fontsource/lora/latin-400.css'),
      () => import('@fontsource/lora/latin-600.css'),
    ],
    classic: [
      () => import('@fontsource/merriweather/latin-400.css'),
      () => import('@fontsource/merriweather/latin-700.css'),
    ],
  };
  const list = files[preset];
  if (!list) return;
  loaded.add(preset);
  list.forEach((load) => void load().catch(() => loaded.delete(preset)));
}

const VARS = [
  '--color-brand-50',
  '--color-brand-100',
  '--color-brand-600',
  '--color-accent-50',
  '--color-brand-700',
  '--color-brand-800',
  '--color-brand-900',
  '--color-accent-600',
  '--color-accent-500',
  '--color-accent-100',
  '--color-page',
  '--color-ink',
  '--font-sans',
  '--font-heading',
];

/** Puts the look on the page: colours, tab title and icon. With no look it puts the platform look back. */
/** The tab icon when an organization has none of its own: the Sailix sail. */
const DEFAULT_ICON = '/favicon.png';

function setTabIcon(href: string): void {
  let link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
  if (!link) {
    link = document.createElement('link');
    link.rel = 'icon';
    document.head.appendChild(link);
  }
  link.href = href;
}

export function applyLook(look: PublicTenant | null): void {
  const root = document.documentElement;
  VARS.forEach((v) => root.style.removeProperty(v));
  delete root.dataset.density;
  if (!look) {
    document.title = 'Sailix Portal';
    setTabIcon(DEFAULT_ICON); // leaving an organization puts the Sailix icon back
    return;
  }
  Object.entries(palette(look)).forEach(([k, v]) => root.style.setProperty(k, v));
  loadFont(look.font_preset);
  if (look.dashboard_layout === 'compact') root.dataset.density = 'compact';
  document.title = `${look.name} · Sailix Portal`;
  setTabIcon(look.favicon_url ?? DEFAULT_ICON);
}

const cacheKey = (slug: string | null) => `${LOOK_CACHE}${window.location.hostname}:${slug ?? ''}`;

/** The last look seen on this address, only to avoid a flash of the wrong colours on the next load. Never trusted for anything else. */
export function cachedLook(slug: string | null): PublicTenant | null {
  try {
    const raw = localStorage.getItem(cacheKey(slug));
    const parsed = raw ? (JSON.parse(raw) as PublicTenant) : null;
    return parsed && typeof parsed.name === 'string' ? parsed : null;
  } catch {
    return null;
  }
}

export function cacheLook(slug: string | null, look: PublicTenant | null): void {
  try {
    if (look) localStorage.setItem(cacheKey(slug), JSON.stringify(look));
    else localStorage.removeItem(cacheKey(slug));
  } catch {
    /* storage blocked: nothing lost */
  }
}
