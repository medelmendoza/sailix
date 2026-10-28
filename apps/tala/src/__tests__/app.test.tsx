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
  await fireEvent.changeText(await screen.findByLabelText('Tala username or email'), 'ann');
  await fireEvent.changeText(screen.getByLabelText('Tala password'), 'pw');
  await fireEvent.press(await screen.findByRole('button', { name: 'Sign in' }));
}

describe('the standalone Tala app', () => {
  it('shows sign-in when there is no session', async () => {
    fakeTala();
    await render(<App />);
    expect(await screen.findByLabelText('Tala username or email')).toBeTruthy();
  });

  it('shows the course list after sign-in, with Tala\'s own tabs', async () => {
    fakeTala();
    await render(<App />);
    await signIn();
    expect(await screen.findByRole('button', { name: /Safety at sea/ })).toBeTruthy();
    for (const tab of ['My Courses', 'Stats', 'Join a course']) {
      expect(screen.getByLabelText(new RegExp(`^${tab}`))).toBeTruthy();
    }
  });

  it('signs out from the account menu, wiping tokens, and has no way "back" to a host', async () => {
    fakeTala();
    await render(<App />);
    await signIn();
    await screen.findByRole('button', { name: /Safety at sea/ });
    await fireEvent.press(await screen.findByRole('button', { name: 'Account menu' }));
    const buttons = jest.mocked(Alert.alert).mock.calls.at(-1)![2]!;
    expect(buttons.map((b) => b.text)).toEqual(['Sign out', 'Cancel']);
    await act(async () => buttons.find((b) => b.text === 'Sign out')!.onPress!());
    expect(await screen.findByLabelText('Tala password')).toBeTruthy();
    expect(store().size).toBe(0);
    void paths;
  });

  it('refuses an address that is not https', async () => {
    extra().talaBaseUrl = 'http://tala.example.test';
    await render(<App />);
    expect(await screen.findByText('Tala is not available')).toBeTruthy();
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
