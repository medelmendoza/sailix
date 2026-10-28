import { act, fireEvent, screen } from '@testing-library/react-native';
import { makeMe, TALA } from '@/test-utils/fixtures';
import { mockApi } from '@/test-utils/mockApi';
import { renderApp } from '@/test-utils/render';
import { signedInAs } from '@/test-utils/session';
import { dashboardReady } from '@/test-utils/steps';

const goTo = async (tab: RegExp) => fireEvent.press(await screen.findByLabelText(tab));

describe('the five tabs (as in the original Sailix, plus Services)', () => {
  it('shows Dashboard, Files, Announcements, Finance and Services, and an Account button in the header', async () => {
    signedInAs();
    await renderApp();
    await dashboardReady();
    for (const tab of [/^Dashboard/, /^Files/, /^Announcements/, /^Finance/, /^Services, tab/]) {
      expect(screen.getByLabelText(tab)).toBeTruthy();
    }
    expect(screen.getByRole('button', { name: 'Account' })).toBeTruthy();
  });
});

describe('services tab', () => {
  it('lists each service with its real status from the API', async () => {
    signedInAs(makeMe({ modules: [TALA('not_linked')] }));
    await renderApp();
    await goTo(/^Services, tab/);
    expect(await screen.findByRole('button', { name: 'Lodestar, Not linked' })).toBeTruthy();
  });

  it('lists the planned services as coming soon and does not let them be opened', async () => {
    signedInAs(makeMe({ modules: [TALA('linked')] }));
    mockApi({ 'GET /modules/tala/courses': { data: { data: [] } } });
    await renderApp();
    await goTo(/^Services, tab/);
    for (const name of ['SRT', 'Call-it', 'Astra']) {
      const card = await screen.findByLabelText(`${name}, coming soon`);
      expect(card.props.accessibilityState.disabled).toBe(true);
      expect(screen.queryByRole('button', { name: new RegExp(`^${name}`) })).toBeNull();
    }
  });

  it('says so plainly when the organization has turned on no service, but still shows what is planned', async () => {
    signedInAs(makeMe({ modules: [] }));
    await renderApp();
    await goTo(/^Services, tab/);
    expect(await screen.findByText(/has not turned on any service yet/)).toBeTruthy();
    expect(screen.getByLabelText('SRT, coming soon')).toBeTruthy();
  });

  it('pull-to-refresh reloads /me and shows module changes', async () => {
    signedInAs(makeMe({ modules: [] }));
    const api = mockApi({
      'GET /me': { data: { data: makeMe({ modules: [TALA('linked')] }) } },
      'GET /modules/tala/courses': { data: { data: [] } },
    });
    await renderApp();
    await goTo(/^Services, tab/);
    await screen.findByText(/has not turned on any service yet/);

    const control = screen.getByTestId('services-scroll').props.refreshControl as {
      props: { onRefresh: () => void };
    };
    await act(async () => control.props.onRefresh());

    expect(await screen.findByRole('button', { name: 'Lodestar, Linked' })).toBeTruthy();
    expect(api.callsTo('GET /me')).toHaveLength(1);
  });
});
