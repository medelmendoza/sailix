import type { BoxShadowValue } from 'react-native';

/**
 * Design tokens, "Harbor": warm sand ground, white cards lifted by a soft shadow and a hairline, deep-teal brand,
 * navy ink and a little coral for warmth. Every text/background pair is checked against WCAG AA in the tokens test.
 */
export const colors = {
  background: '#F4F1EA', // sand
  surface: '#FFFFFF', // cards and bars
  surfaceSunken: '#EAE5DA', // wells, progress tracks, image placeholders
  // text
  text: '#13293D', // navy ink
  textMuted: '#4F5F6E',
  onPrimary: '#FFFFFF',
  // brand
  primary: '#0A5C6E', // deep teal
  primaryEnd: '#0F7186',
  accent: '#0A5C6E', // links
  // decorative fills (never the only carrier of text) and their text-safe counterparts
  seafoam: '#8CC5C9',
  coral: '#F0A27F',
  coralText: '#A8391A',
  gold: '#B7791F',
  // boundaries of controls that must be identifiable without colour (inputs, option rows): >= 3:1 on sand and white
  border: '#7B8794',
  borderSoft: '#E3DDD0',
  // status (text colours >= 4.5:1 on sand, white and on their own tint)
  danger: '#B3362F',
  dangerBg: '#FBE9E7',
  warning: '#8F5200',
  warningBg: '#FDF0DC',
  success: '#1F6B4A',
  successBg: '#E3F3EA',
  info: '#0A5C6E',
  infoBg: '#E1F0F2',
  skeleton: '#E6E1D5',
  shadow: 'rgba(19, 41, 61, 0.10)',
} as const;

export const gradients = {
  primary: 'linear-gradient(135deg, #0A5C6E 0%, #0F7186 100%)',
  /** Decorative placeholder fill (teal to seafoam); never a background for text that matters. */
  soft: 'linear-gradient(135deg, #0A5C6E 0%, #5FB0B5 100%)',
} as const;

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48 } as const;
export const radius = { sm: 8, md: 12, lg: 18, pill: 999 } as const;

/** Elevation: a card lifts off the sand with a soft shadow; an inset well is a quiet inner shadow. */
export const shadows = {
  raised: [
    { offsetX: 0, offsetY: 4, blurRadius: 16, color: colors.shadow },
    { offsetX: 0, offsetY: 1, blurRadius: 2, color: colors.shadow },
  ],
  raisedSm: [{ offsetX: 0, offsetY: 1, blurRadius: 4, color: colors.shadow }],
  inset: [{ offsetX: 0, offsetY: 1, blurRadius: 4, color: colors.shadow, inset: true as const }],
  insetSm: [{ offsetX: 0, offsetY: 1, blurRadius: 3, color: colors.shadow, inset: true as const }],
} satisfies Record<string, BoxShadowValue[]>;

export const fonts = {
  body: 'Nunito_400Regular',
  bodySemiBold: 'Nunito_600SemiBold',
  bodyBold: 'Nunito_700Bold',
  heading: 'Quicksand_700Bold',
  headingSemiBold: 'Quicksand_600SemiBold',
} as const;

export const typography = {
  title: { fontFamily: fonts.heading, fontSize: 28, lineHeight: 36 },
  heading: { fontFamily: fonts.heading, fontSize: 19, lineHeight: 26 },
  body: { fontFamily: fonts.body, fontSize: 16, lineHeight: 24 },
  caption: { fontFamily: fonts.bodySemiBold, fontSize: 13, lineHeight: 18 },
  button: { fontFamily: fonts.bodyBold, fontSize: 16, lineHeight: 22 },
} as const;

/** Minimum touch target (iOS 44pt / Android 48dp). */
export const minTouchTarget = 48;
