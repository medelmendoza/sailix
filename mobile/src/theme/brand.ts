import { useMemo } from 'react';
import { Platform, type TextStyle } from 'react-native';
import { create } from 'zustand';
import { colors, gradients } from '@/constants/theme';
import type { Me } from '@/services/api/types';
import { useSessionStore } from '@/store/sessionStore';

/** How the signed-in organization looks (colours, logo), as the server describes it in `/me`. */
export type Look = NonNullable<Me['tenant']['look']>;

const HEX = /^#[0-9A-Fa-f]{6}$/;

/** Mixes two #RRGGBB colours: t = 0 gives `a`, t = 1 gives `b`. */
export function mix(a: string, b: string, t: number): string {
  const ch = (hex: string, i: number) => parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16);
  const out = [0, 1, 2].map((i) => Math.round(ch(a, i) + (ch(b, i) - ch(a, i)) * t));
  return `#${out.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255) as [
    number,
    number,
    number,
  ];
  const f = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

/** WCAG contrast ratio between two #RRGGBB colours. */
export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

/** Quieter text from the organization's text colour: mixed toward the page as far as it still reads (4.5:1) on page and cards. */
function mutedFrom(text: string, background: string): string {
  for (const t of [0.3, 0.2, 0.1]) {
    const c = mix(text, background, t);
    if (contrast(c, background) >= 4.5 && contrast(c, '#FFFFFF') >= 4.5) return c;
  }
  return text;
}

type Role = 'regular' | 'semi' | 'bold';
/** Which weight a font the app names stands for, and whether it is the heading face. */
const ROLE: Record<string, Role> = {
  Nunito_400Regular: 'regular',
  Nunito_600SemiBold: 'semi',
  Nunito_700Bold: 'bold',
  Quicksand_600SemiBold: 'semi',
  Quicksand_700Bold: 'bold',
};
const WEIGHT: Record<Role, TextStyle['fontWeight']> = { regular: '400', semi: '600', bold: '700' };
const SERIF = Platform.select({ ios: 'Georgia', default: 'serif' });

/** The font styles an organization can choose, as what to draw each of the app's fonts with. Nothing is downloaded. */
function fontFor(preset: string | null | undefined, family: string | undefined) {
  const role = family ? ROLE[family] : undefined;
  if (!role || !preset || preset === 'default') return {};
  switch (preset) {
    case 'rounded': // the rounded Quicksand the app already carries, for body text too
      return { fontFamily: role === 'bold' ? 'Quicksand_700Bold' : 'Quicksand_600SemiBold' };
    case 'serif':
      return { fontFamily: SERIF, fontWeight: WEIGHT[role] };
    case 'system': // the phone's own interface font
      return { fontFamily: undefined, fontWeight: WEIGHT[role] };
    default:
      return {};
  }
}

export type Brand = {
  /** Buttons, links, selected states, icons. White text on it is always readable (the server checks 4.5:1). */
  primary: string;
  /** Links and small accents. */
  accent: string;
  /** The page behind the cards. */
  background: string;
  /** Text and quieter text. The organization's own text colour only when it reads on the page and on the white cards. */
  text: string;
  textMuted: string;
  /**
   * The font style of the organization applied to a font the app already names (`Nunito_700Bold`, `Quicksand_700Bold`...):
   * what to draw it with instead. Nothing (`{}`) for the Sailix default.
   */
  font: (family: string | undefined) => Pick<TextStyle, 'fontFamily' | 'fontWeight'>;
  /** The soft tint behind icons and the selected tab. */
  infoBg: string;
  gradients: { primary: string; header: string; soft: string };
};

/** The app's colours for an organization's look; without one, the Sailix tokens exactly. */
export function brandPalette(
  look: Partial<
    Pick<
      Look,
      | 'primary_color'
      | 'secondary_color'
      | 'accent_color'
      | 'background_color'
      | 'text_color'
      | 'font_preset'
    >
  > | null,
): Brand {
  const own = (v?: string | null) => (v && HEX.test(v) ? v : null);
  const background = own(look?.background_color) ?? colors.background;
  const accentChoice = own(look?.accent_color);
  // The organization's text colour is used only where it reads: on its page colour and on the white cards.
  const chosenText = own(look?.text_color);
  const textReads =
    chosenText !== null &&
    contrast(chosenText, background) >= 4.5 &&
    contrast(chosenText, '#FFFFFF') >= 4.5;
  const text = textReads ? chosenText : colors.text;
  const textMuted = textReads ? mutedFrom(chosenText, background) : colors.textMuted;
  const font = (family: string | undefined) => fontFor(look?.font_preset, family);
  const primary = look?.primary_color && HEX.test(look.primary_color) ? look.primary_color : null;
  const secondary =
    look?.secondary_color && HEX.test(look.secondary_color) ? look.secondary_color : null;
  if (!primary) {
    return {
      primary: colors.primary,
      accent: accentChoice ?? secondary ?? colors.accent,
      background,
      text,
      textMuted,
      font,
      infoBg: colors.infoBg,
      gradients: { primary: gradients.primary, header: gradients.header, soft: gradients.soft },
    };
  }
  const end = mix(primary, '#000000', 0.12);
  return {
    primary,
    accent: accentChoice ?? primary,
    background,
    text,
    textMuted,
    font,
    infoBg: mix(primary, '#ffffff', 0.88),
    gradients: {
      primary: `linear-gradient(135deg, ${primary} 0%, ${end} 100%)`,
      // primary into the secondary when there is one (both are checked for white text), else into a darker primary
      header: `linear-gradient(180deg, ${primary} 0%, ${secondary ?? mix(primary, '#000000', 0.25)} 100%)`,
      soft: `linear-gradient(135deg, ${primary} 0%, ${secondary ?? mix(primary, '#ffffff', 0.25)} 100%)`,
    },
  };
}

type BrandStore = { look: Look | null; setLook: (look: Look | null) => void };
export const useBrandStore = create<BrandStore>((set) => ({
  look: null,
  setLook: (look) => set({ look }),
}));

/** The colours to draw brand surfaces with. Re-renders when the signed-in organization (or its look) changes. */
export function useBrand(): Brand {
  const look = useBrandStore((s) => s.look);
  return useMemo(() => brandPalette(look), [look]);
}

/** The short form of the organization's name for tight spaces, falling back to the full name. */
export const useShortName = (fullName: string): string =>
  useBrandStore((s) => s.look?.short_name) || fullName;

/** The organization's logo address, or null. */
export const useLogoUrl = (): string | null => useBrandStore((s) => s.look?.logo_url ?? null);

// The look follows the signed-in organization: set from `/me`, forgotten on sign-out.
useSessionStore.subscribe((s) => {
  const look = s.me?.tenant.look ?? null;
  if (useBrandStore.getState().look !== look) useBrandStore.getState().setLook(look);
});
