import { colors, radius, shadows, spacing, typography } from '../theme';

/** WCAG 2.x relative luminance and contrast ratio. */
function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255) as [
    number,
    number,
    number,
  ];
  const f = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}
const contrast = (a: string, b: string) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
};

describe('colour contrast (WCAG 2.1 AA)', () => {
  // [description, foreground, background, minimum ratio]
  const text: [string, string, string][] = [
    ['body text on the cool-white ground', colors.text, colors.background],
    ['muted text on the cool-white ground', colors.textMuted, colors.background],
    ['brand teal as text on the cool-white ground', colors.primary, colors.background],
    ['danger text on the cool-white ground', colors.danger, colors.background],
    ['warning text on the cool-white ground', colors.warning, colors.background],
    ['success text on the cool-white ground', colors.success, colors.background],
    ['dark text on the Medium rating button', colors.text, colors.ratingMedium],
    ['white on the Easy rating button', colors.onPrimary, colors.success],
    ['white on the Hard rating button', colors.onPrimary, colors.danger],
    ['white on the end of the Dashboard header gradient', colors.onPrimary, '#2A7F8F'],
    ['body text on the surface', colors.text, colors.surface],
    ['muted text on the surface', colors.textMuted, colors.surface],
    ['muted text on a sunken well', colors.textMuted, colors.surfaceSunken],
    ['text on a sunken well', colors.text, colors.surfaceSunken],
    ['brand blue as text on the surface', colors.primary, colors.surface],
    ['link blue as text on the surface', colors.accent, colors.surface],
    ['white on the primary button (start)', colors.onPrimary, colors.primary],
    ['white on the end of the teal launcher card', colors.onPrimary, '#2A7D60'],
    ['white on the start of the coral launcher card', colors.onPrimary, '#A8391A'],
    ['white on the end of the coral launcher card', colors.onPrimary, '#B5482A'],
    ['white on the primary button (end of gradient)', colors.onPrimary, colors.primaryEnd],
    ['coral text on the surface', colors.coralText, colors.surface],
    ['danger text on the surface', colors.danger, colors.surface],
    ['danger text on its tint', colors.danger, colors.dangerBg],
    ['warning text on the surface', colors.warning, colors.surface],
    ['warning text on its tint', colors.warning, colors.warningBg],
    ['success text on the surface', colors.success, colors.surface],
    ['success text on its tint', colors.success, colors.successBg],
    ['info text on its tint', colors.info, colors.infoBg],
  ];
  it.each(text)('%s is at least 4.5:1', (_name, fg, bg) => {
    expect(contrast(fg, bg)).toBeGreaterThanOrEqual(4.5);
  });

  it('the outline of inputs and option rows is also at least 3:1 against the cool-white ground', () => {
    expect(contrast(colors.border, colors.background)).toBeGreaterThanOrEqual(3);
  });

  it('the outline of inputs and option rows is at least 3:1 against the surface (identifiable without colour cues)', () => {
    expect(contrast(colors.border, colors.surface)).toBeGreaterThanOrEqual(3);
  });

  it('the soft fills used for decoration stay decoration: none is relied on for text', () => {
    // seafoam / coral are < 3:1 on the surface, so text must use coralText / success / warning instead
    for (const decorative of [colors.seafoam, colors.coral]) {
      expect(contrast(decorative, colors.surface)).toBeLessThan(3);
    }
  });
});

describe('tokens', () => {
  it('keeps touch-friendly rounded geometry and a readable type scale', () => {
    expect(radius.lg).toBeGreaterThan(radius.md);
    expect(spacing.xl).toBeGreaterThan(spacing.lg);
    expect(typography.body.fontSize).toBeGreaterThanOrEqual(16); // mobile body text never below 16
    expect(typography.caption.fontSize).toBeGreaterThanOrEqual(13);
    for (const t of Object.values(typography)) expect(t.lineHeight).toBeGreaterThan(t.fontSize);
  });

  it('raised shadows fall outward and inset shadows sit inside', () => {
    for (const s of [shadows.raised, shadows.raisedSm]) {
      for (const layer of s) expect('inset' in layer && layer.inset).toBeFalsy();
    }
    for (const s of [shadows.inset, shadows.insetSm]) {
      for (const layer of s) expect('inset' in layer && layer.inset).toBe(true);
    }
  });
});
