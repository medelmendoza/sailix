import { act, render, screen } from '@testing-library/react-native';
import { Button } from '@/components';
import { colors, gradients } from '@/constants/theme';
import { makeMe } from '@/test-utils/fixtures';
import { mockApi } from '@/test-utils/mockApi';
import { renderApp } from '@/test-utils/render';
import { signedInAs } from '@/test-utils/session';
import { dashboardReady } from '@/test-utils/steps';
import { useSessionStore } from '@/store/sessionStore';
import { brandPalette, mix, useBrandStore, type Look } from '../brand';

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
