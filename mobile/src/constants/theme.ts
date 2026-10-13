/** Design tokens. Brand colours come from the Flutter reference (docs/12-UX-IMPROVEMENTS.md). */
export const colors = {
  primary: '#002352',
  accent: '#2364AA',
  background: '#F5F7FA',
  surface: '#FFFFFF',
  text: '#16202E',
  textMuted: '#5B6778',
  border: '#D5DBE3',
  onPrimary: '#FFFFFF',
  danger: '#C62828',
  dangerBg: '#FDECEA',
  warning: '#E65100',
  warningBg: '#FFF3E0',
  success: '#2E7D32',
  successBg: '#E8F5E9',
  skeleton: '#E3E8EF',
  // ASTRA (dark) scheme — used only when Services ships
  astraBar: '#192D3B',
  astraBackground: '#1F232F',
} as const;

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
export const radius = { sm: 6, md: 10, lg: 16, pill: 30 } as const;

export const fonts = {
  regular: 'Poppins_400Regular',
  semiBold: 'Poppins_600SemiBold',
  bold: 'Poppins_700Bold',
} as const;

export const typography = {
  title: { fontFamily: fonts.bold, fontSize: 22, lineHeight: 30 },
  heading: { fontFamily: fonts.semiBold, fontSize: 17, lineHeight: 24 },
  body: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 22 },
  caption: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 17 },
  button: { fontFamily: fonts.semiBold, fontSize: 15, lineHeight: 20 },
} as const;

/** Minimum touch target (iOS 44pt / Android 48dp). */
export const minTouchTarget = 48;
