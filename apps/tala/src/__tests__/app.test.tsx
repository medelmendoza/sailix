import { act, fireEvent, render, screen } from '@testing-library/react-native';
import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';
import { Alert } from 'react-native';
import { fakeTala, paths, stopFakeTala } from '../../../../packages/tala/src/testing/render';
import { App } from '../App';
import { readTalaConfig } from '../config';

// the fonts load from the network in a real build; the tests have none to wait for
jest.mock('@expo-google-fonts/quicksand', () => ({
  ...jest.requireActual('@expo-google-fonts/quicksand'),
  useFonts: () => [true, null],
}));

// the safe-area provider draws nothing until the device reports its size
jest.mock('react-native-safe-area-context', () =>
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- the library's own jest mock, loaded lazily
  require('react-native-safe-area-context/jest/mock').default,
);

const extra = () => Constants.expoConfig!.extra as Record<string, unknown>;
const store = () => (SecureStore as unknown as { __store: Map<string, string> }).__store;

let alert: jest.SpyInstance;
beforeEach(() => {
  store().clear();
  extra().talaBaseUrl = 'https://tala.example.test';
  alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
});
afterEach(() => {
  stopFakeTala();
  alert.mockRestore();
  delete extra().talaBaseUrl;
});

async function signIn() {
  await fireEvent.changeText(await screen.findByLabelText('Lodestar username or email'), 'ann');
  await fireEvent.changeText(screen.getByLabelText('Lodestar password'), 'pw');
  await fireEvent.press(await screen.findByRole('button', { name: 'Sign in' }));
}

describe('the standalone Tala app', () => {
  it('shows sign-in when there is no session', async () => {
    fakeTala();
    await render(<App />);
    expect(await screen.findByLabelText('Lodestar username or email')).toBeTruthy();
  });

  it('shows the course list after sign-in, with Tala\'s own tabs', async () => {
    fakeTala();
    await render(<App />);
    await signIn();
    expect(await screen.findByText('Courses by state')).toBeTruthy(); // the app opens on the dashboard
    await fireEvent.press(screen.getByLabelText(/^My Courses/));
    expect(await screen.findByRole('button', { name: /Safety at sea/ })).toBeTruthy();
    for (const tab of ['Dashboard', 'My Courses', 'Stats']) {
      expect(screen.getByLabelText(new RegExp(`^${tab}`))).toBeTruthy();
    }
  });

  it('signs out from the account screen, wiping tokens, and has no way "back" to a host', async () => {
    fakeTala();
    await render(<App />);
    await signIn();
    await screen.findByText('Courses by state');
    await fireEvent.press(await screen.findByRole('button', { name: 'Account' }));
    expect(screen.queryByRole('button', { name: /^Back to/ })).toBeNull();
    await act(async () => fireEvent.press(await screen.findByRole('button', { name: 'Sign out' })));
    expect(await screen.findByLabelText('Lodestar password')).toBeTruthy();
    expect(store().size).toBe(0);
    void paths;
  });

  it('refuses an address that is not https', async () => {
    extra().talaBaseUrl = 'http://tala.example.test';
    await render(<App />);
    expect(await screen.findByText('Lodestar is not available')).toBeTruthy();
  });
});

describe('the build settings', () => {
  it('reads the Tala address and whether progress writes are on', () => {
    expect(readTalaConfig({ talaBaseUrl: 'https://t.example.test', talaProgressWrites: true })).toEqual({
      talaBaseUrl: 'https://t.example.test',
      progressWrites: true,
    });
  });

  it('leaves progress writes off and the address empty when the build sets neither', () => {
    expect(readTalaConfig(undefined)).toEqual({ talaBaseUrl: '', progressWrites: false });
  });
});
