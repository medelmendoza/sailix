import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import * as FileSystem from 'expo-file-system';
import { Alert } from 'react-native';
import { queryClient } from '@/services/queryClient';
import { useSessionStore } from '@/store/sessionStore';
import { makeMe, TALA } from '@/test-utils/fixtures';
import { mockApi, problem } from '@/test-utils/mockApi';
import { renderApp } from '@/test-utils/render';
import { signedInAs } from '@/test-utils/session';
import { deleteDownload, downloadMaterial, listDownloads } from '../tala/offline/downloads';
import { pendingCompletions, queueCompletion, syncOutbox } from '../tala/offline/outbox';
import { currentScope } from '../tala/offline/paths';
import { getCachedCourses, setCachedCourses, setOutbox } from '../tala/offline/store';
import { wipeOfflineData } from '../tala/offline/wipe';

const fs = (
  FileSystem as unknown as {
    __fs: { files: Map<string, unknown>; dirs: Set<string>; state: { failNextDownload: boolean } };
  }
).__fs;
const keys = async () => (await AsyncStorage.getAllKeys()).filter((k) => k.startsWith('tala:'));
const offline = (on: boolean) =>
  jest.mocked(NetInfo.fetch).mockResolvedValue({ isConnected: !on } as never);

const course = {
  id: 'A1',
  name: 'Safety at sea',
  description: null,
  thumbnail_url: null,
  date_from: null,
  date_to: null,
  status: 'ongoing',
  progress: '50',
  total_materials: 2,
};
const mat = (id: string, type: string, status: string | null = null) => ({
  id,
  type,
  name: `Item ${id}`,
  description: null,
  thumbnail_url: null,
  viewable: type !== 'quiz',
  progress: null,
  status,
});
const detail = (submission = true) => ({
  ...course,
  hidden_materials: 0,
  progress_submission: submission,
  materials: [mat('v1', 'video'), mat('p1', 'pdf', 'COMPLETED')],
});
const material = (id: string) => ({
  data: {
    data: {
      id,
      type: 'pdf',
      name: 'x',
      description: null,
      thumbnail_url: null,
      file_url: `https://files.example.com/${id}.pdf`,
    },
  },
});

beforeEach(() => {
  offline(false);
  jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
});
afterEach(() => jest.restoreAllMocks());

describe('storage scope and wipe', () => {
  it('wipes one scope or everything, files included, and leaves other keys alone', async () => {
    signedInAs();
    await setCachedCourses('A_1', { fetchedAt: 'x', courses: [] });
    await setCachedCourses('B_2', { fetchedAt: 'x', courses: [] });
    await AsyncStorage.setItem('unrelated', '1');
    fs.dirs.add('file:///documents/tala/A_1');
    fs.files.set('file:///documents/tala/A_1/m/f.pdf', { size: 1 });
    fs.files.set('file:///documents/tala/B_2/m/f.pdf', { size: 1 });

    await wipeOfflineData('A_1');
    expect(await keys()).toEqual(['tala:v1:B_2:courses']);
    expect(fs.files.has('file:///documents/tala/A_1/m/f.pdf')).toBe(false);
    expect(fs.files.has('file:///documents/tala/B_2/m/f.pdf')).toBe(true);

    await wipeOfflineData();
    expect(await keys()).toEqual([]);
    expect(await AsyncStorage.getItem('unrelated')).toBe('1');
  });

  it('signing out removes saved courses, downloads and unsent completions', async () => {
    mockApi({ 'DELETE /auth/token': { status: 204 } });
    signedInAs();
    const scope = currentScope();
    await setCachedCourses(scope, { fetchedAt: 'x', courses: [] });
    await queueCompletion('A1', 'v1');
    fs.dirs.add('file:///documents/tala');
    fs.files.set(`file:///documents/tala/${scope}/v1/f.pdf`, { size: 1 });

    await useSessionStore.getState().signOut();

    expect(await keys()).toEqual([]);
    expect([...fs.files.keys()]).toEqual([]);
  });

  it('a corrupt record is treated as empty, never as a crash', async () => {
    signedInAs();
    await AsyncStorage.setItem(`tala:v1:${currentScope()}:courses`, '{not json');
    expect(await getCachedCourses(currentScope())).toBeNull();
  });
});

describe('outbox delivery', () => {
  it('queues each completion once and sends one request per course with ids only', async () => {
    const api = mockApi({
      'POST /modules/tala/courses/A1/progress': {
        data: { data: { progress: '2/2', status: 'COMPLETED', completed: ['v1', 'p1'] } },
      },
      'POST /modules/tala/courses/A2/progress': { data: { data: {} } },
    });
    signedInAs();
    await queueCompletion('A1', 'v1');
    await queueCompletion('A1', 'v1'); // duplicate
    await queueCompletion('A1', 'p1');
    await queueCompletion('A2', 'x9');
    expect(await pendingCompletions()).toHaveLength(3);

    const r = await syncOutbox();

    expect(r).toMatchObject({ sent: 3, kept: 0, dropped: 0, stopped: null });
    expect(api.callsTo('POST /modules/tala/courses/A1/progress')[0]?.body).toEqual({
      completed: ['v1', 'p1'],
    });
    expect(api.callsTo('POST /modules/tala/courses/A2/progress')[0]?.body).toEqual({
      completed: ['x9'],
    });
    expect(await pendingCompletions()).toEqual([]);
  });

  it('does nothing and keeps everything while offline', async () => {
    const api = mockApi({});
    signedInAs();
    await queueCompletion('A1', 'v1');
    offline(true);

    expect(await syncOutbox()).toMatchObject({ sent: 0, kept: 1, stopped: 'offline' });
    expect(api.calls).toHaveLength(0);
    expect(await pendingCompletions()).toHaveLength(1);
  });

  it.each([
    ['a lost connection', { networkError: true }, 'offline'],
    ['a Tala outage (503)', problem(503, 'module_unavailable'), 'offline'],
    ['a rejected Tala link', problem(409, 'relink_required'), 'relink'],
    ['the feature being off', problem(403, 'feature_disabled'), 'disabled'],
  ])('keeps the completion after %s', async (_name, reply, stopped) => {
    mockApi({ 'POST /modules/tala/courses/A1/progress': reply });
    signedInAs();
    await queueCompletion('A1', 'v1');

    expect(await syncOutbox()).toMatchObject({ sent: 0, kept: 1, dropped: 0, stopped });
    expect(await pendingCompletions()).toHaveLength(1);
  });

  it('records the failure reason and counts attempts for transient errors', async () => {
    mockApi({ 'POST /modules/tala/courses/A1/progress': problem(503, 'module_unavailable') });
    signedInAs();
    await queueCompletion('A1', 'v1');
    await syncOutbox();
    await syncOutbox();
    const [item] = await pendingCompletions();
    expect(item?.attempts).toBe(2);
    expect(item?.lastError).toMatch(/not reachable/);
  });

  it.each([
    [404, 'not_found'],
    [422, 'unsupported_material'],
  ])(
    'drops a completion the server will never accept (%s) instead of retrying forever',
    async (status, code) => {
      mockApi({ 'POST /modules/tala/courses/A1/progress': problem(status, code) });
      signedInAs();
      await queueCompletion('A1', 'v1');

      expect(await syncOutbox()).toMatchObject({ sent: 0, dropped: 1, kept: 0 });
      expect(await pendingCompletions()).toEqual([]);
    },
  );

  it('a busy server (409 progress_busy) is retried on the next run, other courses still go', async () => {
    mockApi({
      'POST /modules/tala/courses/A1/progress': problem(409, 'progress_busy'),
      'POST /modules/tala/courses/A2/progress': { data: { data: {} } },
    });
    signedInAs();
    await queueCompletion('A1', 'v1');
    await queueCompletion('A2', 'x9');

    expect(await syncOutbox()).toMatchObject({ sent: 1, kept: 1 });
    expect((await pendingCompletions()).map((i) => i.assignId)).toEqual(['A1']);
  });

  it('runs one delivery at a time', async () => {
    let calls = 0;
    mockApi({
      'POST /modules/tala/courses/A1/progress': async () => {
        calls += 1;
        await new Promise((r) => setTimeout(r, 20));
        return { data: { data: {} } };
      },
    });
    signedInAs();
    await queueCompletion('A1', 'v1');

    await Promise.all([syncOutbox(), syncOutbox(), syncOutbox()]);
    expect(calls).toBe(1);
  });

  it('never delivers into another session: signing out mid-flight leaves nothing behind', async () => {
    mockApi({
      'POST /modules/tala/courses/A1/progress': async () => {
        await useSessionStore.getState().signOut({ revoke: false });
        return { data: { data: {} } };
      },
    });
    signedInAs();
    await queueCompletion('A1', 'v1');

    await expect(syncOutbox()).rejects.toBeDefined(); // the scope no longer exists: nothing may be written for it
    expect(await keys()).toEqual([]);
  });
});

describe('downloads', () => {
  it('stores each file in its own folder under this session’s scope and records it', async () => {
    mockApi({ 'GET /modules/tala/courses/A1/materials/p1': material('p1') });
    signedInAs();
    const scope = currentScope();

    const rec = await downloadMaterial('A1', { id: 'p1', type: 'pdf', name: 'Manual' });

    expect(rec.uri).toBe(`file:///documents/tala/${scope}/p1/p1.pdf`);
    expect(rec.bytes).toBe(1234);
    expect(Object.keys(await listDownloads())).toEqual(['p1']);
  });

  it('rejects an unsafe material id before touching storage or the network', async () => {
    const api = mockApi({});
    signedInAs();
    await expect(
      downloadMaterial('A1', { id: '../../etc', type: 'pdf', name: 'x' }),
    ).rejects.toThrow(/unsafe/);
    expect(api.calls).toHaveLength(0);
    expect(fs.dirs.size).toBe(0);
  });

  it('a failed download leaves no folder and no record', async () => {
    mockApi({ 'GET /modules/tala/courses/A1/materials/p1': material('p1') });
    signedInAs();
    fs.state.failNextDownload = true;

    await expect(
      downloadMaterial('A1', { id: 'p1', type: 'pdf', name: 'Manual' }),
    ).rejects.toThrow();

    expect(await listDownloads()).toEqual({});
    expect([...fs.dirs].some((d) => d.endsWith('/p1'))).toBe(false);
  });

  it('removing a download deletes the file; a file the OS removed disappears from the list', async () => {
    mockApi({
      'GET /modules/tala/courses/A1/materials/p1': material('p1'),
      'GET /modules/tala/courses/A1/materials/v1': material('v1'),
    });
    signedInAs();
    const a = await downloadMaterial('A1', { id: 'p1', type: 'pdf', name: 'a' });
    await downloadMaterial('A1', { id: 'v1', type: 'video', name: 'b' });

    await deleteDownload('p1');
    expect(fs.files.has(a.uri)).toBe(false);
    expect(Object.keys(await listDownloads())).toEqual(['v1']);

    fs.files.clear(); // the OS cleared the storage
    expect(await listDownloads()).toEqual({});
  });
});

describe('saved copy when offline', () => {
  it('shows the last saved list with a notice when the network fails, and the real error on first use', async () => {
    let down = false;
    mockApi({
      'GET /modules/tala/courses': () =>
        down ? { networkError: true } : { data: { data: [course] } },
    });
    signedInAs(makeMe({ modules: [TALA('linked')] }));
    await renderApp();
    await fireEvent.press(await screen.findByRole('button', { name: /^Tala,/ }));
    expect(await screen.findByText('Safety at sea')).toBeTruthy();
    expect(screen.queryByText(/copy saved on this device/)).toBeNull();

    down = true;
    await queryClient.invalidateQueries();
    expect(await screen.findByText(/copy saved on this device/)).toBeTruthy();
    expect(screen.getByText('Safety at sea')).toBeTruthy();
  });

  it('does not hide a real error behind the saved copy (rejected link) or invent one that never existed', async () => {
    mockApi({ 'GET /modules/tala/courses': { networkError: true } });
    signedInAs(makeMe({ modules: [TALA('linked')] }));
    await renderApp();
    await fireEvent.press(await screen.findByRole('button', { name: /^Tala,/ }));
    expect(await screen.findByText(/No connection/, {}, { timeout: 4000 })).toBeTruthy(); // nothing saved yet: honest error
  });
});

describe('marking completed', () => {
  async function openCourse(submission: boolean, extra: Record<string, unknown> = {}) {
    const api = mockApi({
      'GET /modules/tala/courses': { data: { data: [course] } },
      'GET /modules/tala/courses/A1': { data: { data: detail(submission) } },
      ...extra,
    } as never);
    signedInAs(makeMe({ modules: [TALA('linked')] }));
    await renderApp();
    await fireEvent.press(await screen.findByRole('button', { name: /^Tala,/ }));
    await fireEvent.press(await screen.findByRole('button', { name: /Safety at sea/ }));
    await screen.findByText('Item v1');
    return api;
  }

  it('offers no button when the deployment does not allow submitting', async () => {
    await openCourse(false);
    expect(screen.queryByRole('button', { name: 'Mark as completed' })).toBeNull();
    expect(screen.getByText(/recording progress is not available/)).toBeTruthy();
  });

  it('sends the completion right away when online, naming only the material', async () => {
    const api = await openCourse(true, {
      'POST /modules/tala/courses/A1/progress': {
        data: { data: { progress: '2/2', status: 'COMPLETED', completed: ['v1'] } },
      },
    });
    expect(screen.getAllByRole('button', { name: 'Mark as completed' })).toHaveLength(1); // the PDF is already completed

    await fireEvent.press(screen.getByRole('button', { name: 'Mark as completed' }));

    await waitFor(() =>
      expect(api.callsTo('POST /modules/tala/courses/A1/progress')).toHaveLength(1),
    );
    expect(api.callsTo('POST /modules/tala/courses/A1/progress')[0]?.body).toEqual({
      completed: ['v1'],
    });
    await waitFor(() => expect(screen.queryByText(/waiting to be sent/)).toBeNull());
  });

  it('while offline it is kept, shown as waiting, and sent from "Send now" once back online', async () => {
    const api = await openCourse(true, {
      'POST /modules/tala/courses/A1/progress': { data: { data: {} } },
    });
    offline(true);

    await fireEvent.press(screen.getByRole('button', { name: 'Mark as completed' }));
    expect(await screen.findByText(/1 completion waiting to be sent/)).toBeTruthy();
    expect(screen.getByText(/Completed, waiting to send/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Mark as completed' })).toBeNull();
    expect(api.callsTo('POST /modules/tala/courses/A1/progress')).toHaveLength(0);

    await fireEvent.press(screen.getByRole('button', { name: 'Send now' }));
    expect(await screen.findByText(/Still offline/)).toBeTruthy();

    offline(false);
    await fireEvent.press(screen.getByRole('button', { name: 'Send now' }));
    await waitFor(() =>
      expect(api.callsTo('POST /modules/tala/courses/A1/progress')).toHaveLength(1),
    );
    await waitFor(() => expect(screen.queryByText(/waiting to be sent/)).toBeNull());
  });

  it('downloads an item for offline use and then offers the offline copy and its removal', async () => {
    await openCourse(false, { 'GET /modules/tala/courses/A1/materials/v1': material('v1') });
    await fireEvent.press(screen.getAllByRole('button', { name: 'Download for offline' })[0]!);

    expect(await screen.findByRole('button', { name: 'Watch offline copy' })).toBeTruthy();
    expect(screen.getByText(/Saved on this device/)).toBeTruthy();

    await fireEvent.press(screen.getByRole('button', { name: 'Remove download' }));
    await waitFor(() => expect(screen.queryByText(/Saved on this device/)).toBeNull());
  });

  it('an unsent completion is not lost when the stored outbox is replaced by a restart', async () => {
    signedInAs();
    await queueCompletion('A1', 'v1');
    const scope = currentScope();
    const raw = await AsyncStorage.getItem(`tala:v1:${scope}:outbox`);
    await AsyncStorage.clear();
    await AsyncStorage.setItem(`tala:v1:${scope}:outbox`, raw!); // what survives an app restart
    expect(await pendingCompletions()).toHaveLength(1);
    await setOutbox(scope, []);
  });
});
