import type { BoxShadowValue } from 'react-native';

/**
 * Design tokens: a calm "soft UI" language (one soft grey-blue surface, raised and pressed-in shapes made of paired
 * light/dark shadows, rounded corners, dusty-blue primary with lavender, mint and peach accents). The look follows the
 * mental-health reference the product owner chose (uupm.cc/demo/mental-health); the COLOURS were darkened where the
 * reference fails WCAG AA (its white-on-#7C9EB2 button is 2.8:1, muted text 3.6:1), see tokens test.
 */
export const colors = {
  // surfaces: everything sits on one soft surface; depth comes from shadows, not from different fills
  background: '#F0F4F8',
  surface: '#F0F4F8',
  surfaceSunken: '#E4EAF1',
  // text
  text: '#2D3748',
  textMuted: '#556579',
  onPrimary: '#FFFFFF',
  // brand
  primary: '#3E6F8A',
  primaryEnd: '#4A7C98',
  accent: '#41738E',
  // soft accents (decorative fills) and their text-safe counterparts
  lavender: '#B8A9C9',
  lavenderText: '#6B5B8C',
  mint: '#A8D5BA',
  peach: '#F0B7A4',
  gold: '#C98A1B',
  // boundaries of controls that must be identifiable without colour (inputs, option rows): >= 3:1 on the surface
  border: '#74879D',
  borderSoft: '#D3DCE6',
  // status (text colours >= 4.5:1 on the surface and on their own tint)
  danger: '#B3362F',
  dangerBg: '#F8E3E1',
  warning: '#9A5B00',
  warningBg: '#FCEBDD',
  success: '#287250',
  successBg: '#E1F2E8',
  info: '#376682',
  infoBg: '#E3ECF3',
  skeleton: '#E1E8F0',
  shadowDark: 'rgba(163, 177, 198, 0.55)',
  shadowLight: 'rgba(255, 255, 255, 0.85)',
} as const;

export const gradients = {
  primary: 'linear-gradient(135deg, #3E6F8A 0%, #4A7C98 100%)',
  /** Decorative placeholder fill (lavender to mint); never a background for text that matters. */
  soft: 'linear-gradient(135deg, #B8A9C9 0%, #A8D5BA 100%)',
} as const;

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48 } as const;
export const radius = { sm: 10, md: 16, lg: 24, pill: 999 } as const;

/** Raised (standing out of the surface) and inset (pressed into it). Two shadows each: one light, one dark. */
const layer = (d: number, blur: number, inset = false): BoxShadowValue[] => [
  { offsetX: d, offsetY: d, blurRadius: blur, color: colors.shadowDark, inset },
  { offsetX: -d, offsetY: -d, blurRadius: blur, color: colors.shadowLight, inset },
];
export const shadows = {
  raised: layer(8, 20),
  raisedSm: layer(4, 10),
  inset: layer(4, 10, true),
  insetSm: layer(2, 6, true),
} as const;

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
