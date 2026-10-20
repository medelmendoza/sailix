import { useMemo } from 'react';
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

export type Brand = {
  /** Buttons, links, selected states, icons. White text on it is always readable (the server checks 4.5:1). */
  primary: string;
  /** Links and small accents. */
  accent: string;
  /** The page behind the cards. */
  background: string;
  /** The soft tint behind icons and the selected tab. */
  infoBg: string;
  gradients: { primary: string; header: string; soft: string };
};

/** The app's colours for an organization's look; without one, the Sailix tokens exactly. */
export function brandPalette(
  look: Partial<
    Pick<Look, 'primary_color' | 'secondary_color' | 'accent_color' | 'background_color'>
  > | null,
): Brand {
  const own = (v?: string | null) => (v && HEX.test(v) ? v : null);
  const background = own(look?.background_color) ?? colors.background;
  const accentChoice = own(look?.accent_color);
  const primary = look?.primary_color && HEX.test(look.primary_color) ? look.primary_color : null;
  const secondary =
    look?.secondary_color && HEX.test(look.secondary_color) ? look.secondary_color : null;
  if (!primary) {
    return {
      primary: colors.primary,
      accent: accentChoice ?? secondary ?? colors.accent,
      background,
      infoBg: colors.infoBg,
      gradients: { primary: gradients.primary, header: gradients.header, soft: gradients.soft },
    };
  }
  const end = mix(primary, '#000000', 0.12);
  return {
    primary,
    accent: accentChoice ?? primary,
    background,
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
