import type { BoxShadowValue } from 'react-native';

/**
 * Design tokens, "Harbor": a cool white ground, white cards lifted by a soft shadow and a hairline, navy ink, and the
 * colours of the Sailix logo: its blue (#1260D8) as the brand, its green (#52BB88) and the teal between them for gradients. Every text/background pair is checked against WCAG AA in the tokens test.
 */
export const colors = {
  background: '#F4F8FC', // cool white
  surface: '#FFFFFF', // cards and bars
  surfaceSunken: '#E6ECF5', // wells, progress tracks, image placeholders
  // text
  text: '#0F2036', // navy ink
  textMuted: '#4A5D78',
  onPrimary: '#FFFFFF',
  // brand
  primary: '#1260D8', // the blue of the Sailix logo
  primaryEnd: '#0E4FB5',
  accent: '#1260D8', // links
  // decorative fills (never the only carrier of text) and their text-safe counterparts
  seafoam: '#52BB88', // the green of the logo wordmark
  coral: '#F0A27F',
  coralText: '#A8391A',
  gold: '#B7791F',
  // flashcard rating buttons (Easy uses `success`, Hard uses `danger`); dark text sits on this amber
  ratingMedium: '#F2B93B',
  // boundaries of controls that must be identifiable without colour (inputs, option rows): >= 3:1 on sand and white
  border: '#7A8CA5',
  borderSoft: '#DCE4EF',
  // status (text colours >= 4.5:1 on sand, white and on their own tint)
  danger: '#B3362F',
  dangerBg: '#FBE9E7',
  warning: '#8F5200',
  warningBg: '#FDF0DC',
  success: '#1F6B4A',
  successBg: '#E3F3EA',
  info: '#1260D8',
  infoBg: '#E3ECFA',
  skeleton: '#E3EAF3',
  shadow: 'rgba(15, 32, 54, 0.10)',
} as const;

export const gradients = {
  primary: 'linear-gradient(135deg, #1260D8 0%, #0E4FB5 100%)',
  /** The Dashboard header: the logo's blue fading to a teal (white text stays readable on both ends, see the tokens test). */
  header: 'linear-gradient(180deg, #1260D8 0%, #1B7A8F 100%)',
  /** Decorative placeholder fill, the logo's run from blue through teal to green; never a background for text that matters. */
  soft: 'linear-gradient(135deg, #1260D8 0%, #3F9AA3 55%, #52BB88 100%)',
} as const;

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48 } as const;
export const radius = { sm: 10, md: 16, lg: 24, pill: 999 } as const;

/** Elevation: a card lifts off the sand with a soft shadow; an inset well is a quiet inner shadow. */
export const shadows = {
  raised: [{ offsetX: 0, offsetY: 2, blurRadius: 10, color: 'rgba(15, 32, 54, 0.06)' }],
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
  caption: { fontFamily: fonts.bodySemiBold, fontSize: 14, lineHeight: 20 },
  button: { fontFamily: fonts.bodyBold, fontSize: 16, lineHeight: 22 },
} as const;

/** Minimum touch target (iOS 44pt / Android 48dp). */
export const minTouchTarget = 48;
