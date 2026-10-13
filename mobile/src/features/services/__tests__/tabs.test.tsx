import { act, fireEvent, screen } from '@testing-library/react-native';
import { makeMe, TALA } from '@/test-utils/fixtures';
import { mockApi } from '@/test-utils/mockApi';
import { renderApp } from '@/test-utils/render';
import { signedInAs } from '@/test-utils/session';

const goTo = async (tab: RegExp) => fireEvent.press(await screen.findByLabelText(tab));

describe('the five tabs (as in the original Sailix, plus Services)', () => {
  it('shows Dashboard, Files, Announcements, Finance and Services, and an Account button in the header', async () => {
    signedInAs();
    await renderApp();
    await screen.findByText('Maria');
    for (const tab of [/^Dashboard/, /^Files/, /^Announcements/, /^Finance/, /^Services/]) {
      expect(screen.getByLabelText(tab)).toBeTruthy();
    }
    expect(screen.getByRole('button', { name: 'Account' })).toBeTruthy();
  });

  it('opens Account from the header button and goes back to the tab', async () => {
    signedInAs();
    await renderApp();
    await fireEvent.press(await screen.findByRole('button', { name: 'Account' }));
    expect(await screen.findByText('Maria Santos')).toBeTruthy();
  });

  it.each([
    ['Files', /^Files/],
    ['Finance', /^Finance/],
  ])('%s opens its own screen', async (title, tab) => {
    signedInAs();
    await renderApp();
    await goTo(tab);
    expect(await screen.findByRole('header', { name: title })).toBeTruthy();
    expect(screen.queryByText('Coming soon')).toBeNull();
  });
});

describe('services tab', () => {
  it('lists each service with its real status from the API', async () => {
    signedInAs(makeMe({ modules: [TALA('not_linked')] }));
    await renderApp();
    await goTo(/^Services/);
    expect(await screen.findByRole('button', { name: 'Tala, Not linked' })).toBeTruthy();
  });

  it('lists the planned services as coming soon and does not let them be opened', async () => {
    signedInAs(makeMe({ modules: [TALA('linked')] }));
    mockApi({ 'GET /modules/tala/courses': { data: { data: [] } } });
    await renderApp();
    await goTo(/^Services/);
    for (const name of ['SRT', 'Call-it', 'Astra']) {
      const card = await screen.findByLabelText(`${name}, coming soon`);
      expect(card.props.accessibilityState.disabled).toBe(true);
      expect(screen.queryByRole('button', { name: new RegExp(`^${name}`) })).toBeNull();
    }
  });

  it('says so plainly when the organization has turned on no service, but still shows what is planned', async () => {
    signedInAs(makeMe({ modules: [] }));
    await renderApp();
    await goTo(/^Services/);
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
    await goTo(/^Services/);
    await screen.findByText(/has not turned on any service yet/);

    const control = screen.getByTestId('services-scroll').props.refreshControl as {
      props: { onRefresh: () => void };
    };
    await act(async () => control.props.onRefresh());

    expect(await screen.findByRole('button', { name: 'Tala, Linked' })).toBeTruthy();
    expect(api.callsTo('GET /me')).toHaveLength(1);
  });

  it('keeps Tala out of the Dashboard list: services live on their own tab', async () => {
    signedInAs(makeMe({ modules: [TALA('linked')] }));
    mockApi({ 'GET /modules/tala/courses': { data: { data: [] } } });
    await renderApp();
    await screen.findByText('Maria');
    expect(screen.queryByRole('button', { name: 'Tala, Linked' })).toBeNull();
  });
});
