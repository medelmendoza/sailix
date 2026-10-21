import { act, render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { AppText } from '@/components/AppText';
import { BrandTextInput } from '@/components/BrandTextInput';
import { Button } from '@/components';
import { colors, gradients } from '@/constants/theme';
import { makeMe } from '@/test-utils/fixtures';
import { mockApi } from '@/test-utils/mockApi';
import { renderApp } from '@/test-utils/render';
import { signedInAs } from '@/test-utils/session';
import { dashboardReady } from '@/test-utils/steps';
import { useSessionStore } from '@/store/sessionStore';
import { baseLook } from '@/test-utils/look';
import { brandPalette, contrast, mix, useBrandStore, type Look } from '../brand';

const look = (over: Partial<Look> = {}): Look => ({
  slug: 'sfai',
  name: 'Southfield Agencies',
  tagline: null,
  logo_url: null,
  favicon_url: null,
  primary_color: '#1F6B4A',
  secondary_color: null,
  version: 1,
  ...over,
});
const meWith = (l: Look | null) =>
  makeMe({
    tenant: { id: 't1', code: 'SFAI', name: 'Southfield Agencies', ...(l ? { look: l } : {}) },
  });

afterEach(async () => {
  await act(async () => useBrandStore.getState().setLook(null));
});

describe('brand palette', () => {
  it('mixes colours', () => {
    expect(mix('#000000', '#ffffff', 0.5)).toBe('#808080');
    expect(mix('#355dad', '#000000', 0)).toBe('#355dad');
  });

  it('is exactly the Sailix tokens when the organization has no colours', () => {
    for (const l of [null, { primary_color: null, secondary_color: null }]) {
      const b = brandPalette(l);
      expect(b.primary).toBe(colors.primary);
      expect(b.infoBg).toBe(colors.infoBg);
      expect(b.gradients).toEqual({
        primary: gradients.primary,
        header: gradients.header,
        soft: gradients.soft,
      });
    }
  });

  it('is built from the primary colour, using the secondary as the end of the header', () => {
    const b = brandPalette({ primary_color: '#1F6B4A', secondary_color: '#355DAD' });
    expect(b.primary).toBe('#1F6B4A');
    expect(b.accent).toBe('#1F6B4A');
    expect(b.infoBg).toMatch(/^#[0-9a-f]{6}$/);
    expect(b.gradients.header).toBe('linear-gradient(180deg, #1F6B4A 0%, #355DAD 100%)');
    expect(b.gradients.primary).toContain('#1F6B4A');
  });

  it('without a secondary the header deepens the primary instead', () => {
    const b = brandPalette({ primary_color: '#1F6B4A', secondary_color: null });
    expect(b.gradients.header).toBe(
      `linear-gradient(180deg, #1F6B4A 0%, ${mix('#1F6B4A', '#000000', 0.25)} 100%)`,
    );
  });

  it('never trusts a value that is not a colour', () => {
    const b = brandPalette({ primary_color: 'url(x)', secondary_color: 'red; x' });
    expect(b.primary).toBe(colors.primary);
    expect(b.accent).toBe(colors.accent);
  });
});

describe('the look follows the signed-in organization', () => {
  it('is set from /me and forgotten on sign-out', async () => {
    await act(async () => useSessionStore.setState({ me: meWith(look()) }));
    expect(useBrandStore.getState().look?.primary_color).toBe('#1F6B4A');

    await act(async () => useSessionStore.setState({ me: null }));
    expect(useBrandStore.getState().look).toBeNull();
  });

  it('is empty for a server that sends no look', async () => {
    await act(async () => useSessionStore.setState({ me: meWith(null) }));
    expect(useBrandStore.getState().look).toBeNull();
  });
});

describe("screens wear the organization's colours", () => {
  it('a primary button uses the primary colour, and the Sailix blue without a look', async () => {
    const { rerender } = await render(<Button title="Go" onPress={() => undefined} />);
    expect(screen.getByRole('button', { name: 'Go' })).toHaveStyle({
      backgroundColor: colors.primary,
    });

    await act(async () => useBrandStore.getState().setLook(look()));
    await rerender(<Button title="Go" onPress={() => undefined} />);
    expect(screen.getByRole('button', { name: 'Go' })).toHaveStyle({ backgroundColor: '#1F6B4A' });
  });

  it("the Dashboard header shows the logo and carries the organization's gradient", async () => {
    mockApi({});
    signedInAs(meWith(look({ logo_url: 'http://x/api/v1/public/tenants/sfai/logo?v=1' })));
    await renderApp();
    await dashboardReady();

    const logo = screen.getByLabelText('Southfield Agencies logo');
    expect(logo.props.source).toEqual({ uri: 'http://x/api/v1/public/tenants/sfai/logo?v=1' });
    expect(screen.getByRole('header', { name: 'Maria' }).parent).toBeTruthy();
  });

  it('shows no logo when the organization has none', async () => {
    mockApi({});
    signedInAs(meWith(look({ logo_url: null })));
    await renderApp();
    await dashboardReady();

    expect(screen.queryByLabelText('Southfield Agencies logo')).toBeNull();
  });
});

describe('the rest of the look', () => {
  it('shows the short name on the dashboard when there is one, else the full name', async () => {
    mockApi({});
    signedInAs(meWith(look({ short_name: 'SFAI Crew' })));
    await renderApp();
    await dashboardReady();
    expect(screen.getByText('SFAI Crew')).toBeTruthy();
    expect(screen.queryByText('Southfield Agencies')).toBeNull();
  });

  it('takes the accent and page colours from the look, and ignores what is not a colour', () => {
    const b = brandPalette({
      primary_color: '#1F6B4A',
      secondary_color: null,
      accent_color: '#0B6E99',
      background_color: '#FFFFFF',
    });
    expect(b.accent).toBe('#0B6E99');
    expect(b.background).toBe('#FFFFFF');
    expect(b.primary).toBe('#1F6B4A');

    const bad = brandPalette({ accent_color: 'red', background_color: 'url(x)' });
    expect(bad.accent).toBe(brandPalette(null).accent);
    expect(bad.background).toBe(brandPalette(null).background);
  });
});

describe('the organization’s text colour and font style', () => {
  it('uses its text colour only where it reads: on its page colour and on the white cards', () => {
    expect(brandPalette({ text_color: '#0F2036' }).text).toBe('#0F2036');
    // light text on the light page: refused
    expect(brandPalette({ text_color: '#F0F0F0' }).text).toBe(colors.text);
    // reads on a dark page it chose, but the cards stay white and it would vanish on them: refused
    expect(brandPalette({ text_color: '#FFFFFF', background_color: '#12243D' }).text).toBe(
      colors.text,
    );
    // not a colour at all
    expect(brandPalette({ text_color: 'red; background: x' }).text).toBe(colors.text);
    expect(brandPalette(null).text).toBe(colors.text);
    expect(brandPalette(null).textMuted).toBe(colors.textMuted);
  });

  it('derives quieter text from it that still reads on the page and on the cards', () => {
    for (const text of ['#0F2036', '#222222', '#1B3A2F']) {
      const b = brandPalette({ text_color: text });
      expect(b.text).toBe(text);
      expect(b.textMuted).not.toBe(colors.textMuted);
      expect(contrast(b.textMuted, b.background)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(b.textMuted, '#FFFFFF')).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('maps the fonts the app names to the chosen style, and leaves the default alone', () => {
    expect(brandPalette(null).font('Nunito_700Bold')).toEqual({});
    expect(brandPalette({ font_preset: 'default' }).font('Quicksand_700Bold')).toEqual({});
    const rounded = brandPalette({ font_preset: 'rounded' });
    expect(rounded.font('Nunito_400Regular')).toEqual({ fontFamily: 'Quicksand_600SemiBold' });
    expect(rounded.font('Nunito_700Bold')).toEqual({ fontFamily: 'Quicksand_700Bold' });
    const serif = brandPalette({ font_preset: 'serif' }).font('Nunito_700Bold');
    expect(serif.fontWeight).toBe('700');
    expect(['Georgia', 'serif']).toContain(serif.fontFamily);
    const system = brandPalette({ font_preset: 'system' }).font('Nunito_600SemiBold');
    expect(system).toEqual({ fontFamily: undefined, fontWeight: '600' });
    // a font the app does not name (a system one, a custom one) is never touched
    expect(brandPalette({ font_preset: 'serif' }).font('Courier')).toEqual({});
    expect(brandPalette({ font_preset: 'serif' }).font(undefined)).toEqual({});
    // not a preset
    expect(brandPalette({ font_preset: 'comic' as never }).font('Nunito_700Bold')).toEqual({});
  });
});

describe('text drawn with the organization’s look', () => {
  const draw = async (look: Partial<Look> | null, node: React.ReactElement) => {
    await act(async () =>
      useBrandStore.getState().setLook(look ? ({ ...baseLook, ...look } as Look) : null),
    );
    return render(node);
  };

  it('AppText wears the text colour and font style; a colour that is not the Sailix ink is left alone', async () => {
    await draw(
      { text_color: '#1B3A2F', font_preset: 'serif' },
      <>
        <AppText>Body</AppText>
        <AppText muted>Quiet</AppText>
        <AppText variant="heading">Heading</AppText>
        <AppText style={{ color: '#FFFFFF' }}>On a button</AppText>
        <AppText style={{ color: colors.textMuted }}>Named quiet</AppText>
        <AppText style={{ fontFamily: 'Quicksand_700Bold' }}>Fixed font</AppText>
      </>,
    );
    const style = (t: string) =>
      StyleSheet.flatten(screen.getByText(t).props.style) as Record<string, unknown>;

    expect(style('Body').color).toBe('#1B3A2F');
    expect(['Georgia', 'serif']).toContain(style('Body').fontFamily);
    expect(style('Quiet').color).not.toBe(colors.textMuted);
    expect(style('Quiet').color).not.toBe('#1B3A2F');
    expect(style('Named quiet').color).toBe(style('Quiet').color); // a screen naming the Sailix quiet ink gets the organization's
    expect(style('On a button').color).toBe('#FFFFFF');
    expect(style('Heading').fontWeight).toBe('700'); // the heading face becomes the bold of the chosen family
    expect(['Georgia', 'serif']).toContain(style('Fixed font').fontFamily);
  });

  it('without a look it draws exactly as before', async () => {
    await draw(null, <AppText variant="heading">Plain</AppText>);
    const style = StyleSheet.flatten(screen.getByText('Plain').props.style) as Record<
      string,
      unknown
    >;
    expect(style.color).toBe(colors.text);
    expect(style.fontFamily).toBe('Quicksand_700Bold');
  });

  it('a text input follows it too, with the quiet colour for its placeholder', async () => {
    await draw(
      { text_color: '#1B3A2F', font_preset: 'system' },
      <BrandTextInput placeholder="Name" />,
    );
    const input = screen.getByPlaceholderText('Name');
    const style = StyleSheet.flatten(input.props.style) as Record<string, unknown>;
    expect(style.color).toBe('#1B3A2F');
    expect(style.fontFamily).toBeUndefined();
    expect(input.props.placeholderTextColor).not.toBe(colors.textMuted);
  });
});
