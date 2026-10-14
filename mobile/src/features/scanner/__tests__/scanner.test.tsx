import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { makeMe } from '@/test-utils/fixtures';
import { mockApi } from '@/test-utils/mockApi';
import { renderApp } from '@/test-utils/render';
import { signedInAs } from '@/test-utils/session';
import { useScanStore } from '../scanStore';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const camera = (
  require('expo-camera') as {
    __state: {
      grantOnRequest: boolean;
      canAskAgain: boolean;
      initialGranted: boolean;
      shots: number;
    };
  }
).__state;
// eslint-disable-next-line @typescript-eslint/no-require-imports
const picker = (
  require('expo-image-picker') as {
    __state: { next: { uri: string }[] | null; calls: Record<string, unknown>[] };
  }
).__state;
// eslint-disable-next-line @typescript-eslint/no-require-imports
const print = require('expo-print') as { printToFileAsync: jest.Mock };

beforeEach(() => {
  camera.initialGranted = true;
  camera.grantOnRequest = true;
  camera.canAskAgain = true;
  camera.shots = 0;
  picker.next = [{ uri: 'file:///library/1.jpg' }];
  picker.calls = [];
  print.printToFileAsync.mockClear();
  useScanStore.setState({ file: null });
});

async function openScanner() {
  mockApi({
    'GET /document-types': { data: { data: [{ id: 't1', name: 'Passport', short_name: null }] } },
  } as never);
  signedInAs(makeMe({ modules: [] }));
  await renderApp();
  await fireEvent.press(await screen.findByRole('button', { name: 'Upload documents' }));
  await fireEvent.press(await screen.findByRole('button', { name: 'Scan with the camera' }));
}

describe('scanner', () => {
  it('asks for the camera first, with a way to use the photo library instead', async () => {
    camera.initialGranted = false;
    await openScanner();
    expect(await screen.findByText('Scan with the camera')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Allow the camera' })).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Allow the camera' }));
    expect(await screen.findByRole('button', { name: 'Take a picture' })).toBeTruthy();
  });

  it('sends the person to Settings when the camera was refused for good, and still works from the library', async () => {
    camera.initialGranted = false;
    camera.canAskAgain = false;
    await openScanner();
    expect(await screen.findByRole('button', { name: 'Open Settings' })).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Use my photo library instead' }));
    expect(await screen.findByText(/Choose photos of your document from the library/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Take a picture' })).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'From my library' }));
    expect(await screen.findByLabelText('Page 1')).toBeTruthy();
  });

  it('takes pictures, counts the pages, and stops at five', async () => {
    await openScanner();
    for (let i = 1; i <= 5; i++) {
      await fireEvent.press(await screen.findByRole('button', { name: 'Take a picture' }));
      expect(await screen.findByText(`${i} of 5 pages`)).toBeTruthy();
    }
    expect(
      screen.getByRole('button', { name: 'Five pages is the most' }).props.accessibilityState
        .disabled,
    ).toBe(true);
    expect(
      screen.getByRole('button', { name: 'From my library' }).props.accessibilityState.disabled,
    ).toBe(true);
  });

  it('asks the library only for as many pages as there is room for', async () => {
    await openScanner();
    await fireEvent.press(await screen.findByRole('button', { name: 'Take a picture' }));
    await fireEvent.press(screen.getByRole('button', { name: 'From my library' }));
    await waitFor(() => expect(picker.calls).toHaveLength(1));
    expect(picker.calls[0]).toMatchObject({ allowsMultipleSelection: true, selectionLimit: 4 });
  });

  it('lets pages be reordered and removed', async () => {
    await openScanner();
    await fireEvent.press(await screen.findByRole('button', { name: 'Take a picture' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Take a picture' }));
    expect(await screen.findByText('2 of 5 pages')).toBeTruthy();
    expect(
      screen.getByRole('button', { name: 'Move page 1 earlier' }).props.accessibilityState.disabled,
    ).toBe(true);
    await fireEvent.press(screen.getByRole('button', { name: 'Remove page 2' }));
    expect(await screen.findByText('1 of 5 pages')).toBeTruthy();
  });

  it('makes a PDF of the pages, hands it back, and the form shows it as the chosen file', async () => {
    await openScanner();
    await fireEvent.press(await screen.findByRole('button', { name: 'Take a picture' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Take a picture' }));
    await fireEvent.press(await screen.findByRole('button', { name: /^Make a PDF of 2 pages/ }));

    await waitFor(() => expect(print.printToFileAsync).toHaveBeenCalledTimes(1));
    const html = print.printToFileAsync.mock.calls[0]![0].html as string;
    expect(html.match(/class="page"/g)).toHaveLength(2);
    expect(await screen.findByText(/^scan-\d{4}-\d{2}-\d{2}-\d{4}\.pdf$/)).toBeTruthy(); // back on the form, the PDF is the chosen file
    expect(useScanStore.getState().file).toBeNull(); // handed over once
  });

  it('cancel goes back and hands nothing over', async () => {
    await openScanner();
    await fireEvent.press(await screen.findByRole('button', { name: 'Take a picture' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Cancel' }));
    expect(await screen.findByRole('button', { name: 'Send for approval' })).toBeTruthy();
    expect(useScanStore.getState().file).toBeNull();
    void act;
  });

  it('offers no PDF until there is a page', async () => {
    await openScanner();
    expect(await screen.findByRole('button', { name: /^Make a PDF of the page/ })).toBeTruthy();
    expect(
      screen.getByRole('button', { name: /^Make a PDF of the page/ }).props.accessibilityState
        .disabled,
    ).toBe(true);
  });
});
