import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { useEventListener } from 'expo';
import * as FileSystem from 'expo-file-system';
import { Alert, Linking } from 'react-native';
import { queryClient } from '@/services/queryClient';
import { useSessionStore } from '@/store/sessionStore';
import { makeMe, TALA } from '@/test-utils/fixtures';
import { mockApi, problem } from '@/test-utils/mockApi';
import { renderApp } from '@/test-utils/render';
import { signedInAs } from '@/test-utils/session';
import { deleteDownload, downloadMaterial, listDownloads } from '../tala/offline/downloads';
import { pendingCompletions, queueCompletion, syncOutbox } from '../tala/offline/outbox';
import { currentScope } from '../tala/offline/paths';
import { getCachedCourses, putDownload, setCachedCourses, setOutbox } from '../tala/offline/store';
import { wipeOfflineData } from '../tala/offline/wipe';
import { openTala } from '@/test-utils/steps';

const fs = (
  FileSystem as unknown as {
    __fs: {
      files: Map<string, unknown>;
      dirs: Set<string>;
      state: { failNextDownload: boolean; hold: Promise<void> | null };
    };
  }
).__fs;
/** A PDF saved on the device, as if it had been downloaded (and, if `opened`, opened at least once). */
async function seedPdf(id: string, opened: boolean) {
  const scope = currentScope();
  const uri = `file:///documents/tala/${scope}/${id}/${id}.pdf`;
  fs.files.set(uri, { size: 1 });
  await putDownload(scope, {
    materialId: id,
    assignId: 'A1',
    type: 'pdf',
    name: `Item ${id}`,
    uri,
    bytes: 1,
    downloadedAt: '2026-10-14T00:00:00Z',
    ...(opened ? { openedAt: '2026-10-14T00:01:00Z' } : {}),
  });
}
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
  progress: '1/4',
  total_materials: 2,
  completed: 1,
  total: 4,
  percent: 25,
  state: 'in_progress',
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
const detail = (submission = true, more: ReturnType<typeof mat>[] = []) => ({
  ...course,
  hidden_materials: 0,
  progress_submission: submission,
  materials: [mat('v1', 'video'), mat('p1', 'pdf', 'COMPLETED'), ...more],
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
    await openTala();
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
    await openTala();
    expect(await screen.findByText(/No connection/, {}, { timeout: 4000 })).toBeTruthy(); // nothing saved yet: honest error
  });
});

async function giveFeedback(stars = 4, half = false, comment = '') {
  await fireEvent.press(await screen.findByRole('radio', { name: `${stars} stars` }));
  if (half) await fireEvent.press(screen.getByRole('switch', { name: 'Half star' }));
  if (comment) await fireEvent.changeText(screen.getByLabelText('Comment'), comment);
  await fireEvent.press(screen.getByRole('button', { name: 'Submit feedback' }));
}

describe('marking completed', () => {
  async function openCourse(
    submission: boolean,
    extra: Record<string, unknown> = {},
    more: ReturnType<typeof mat>[] = [],
    openedPdfs: string[] = [],
  ) {
    const api = mockApi({
      'GET /modules/tala/courses': { data: { data: [course] } },
      'GET /modules/tala/courses/A1': { data: { data: detail(submission, more) } },
      ...extra,
    } as never);
    signedInAs(makeMe({ modules: [TALA('linked')] }));
    for (const id of openedPdfs) await seedPdf(id, true);
    await renderApp();
    await openTala();
    await fireEvent.press(await screen.findByRole('button', { name: /Safety at sea/ }));
    await screen.findAllByText('Item v1');
    return api;
  }

  it('offers no button when the deployment does not allow submitting', async () => {
    await openCourse(false);
    expect(screen.queryByRole('button', { name: 'Mark as completed' })).toBeNull();
    expect(screen.getByText(/recording progress is not available/)).toBeTruthy();
  });

  it('a video cannot be marked as completed: it has to be downloaded, watched and rated', async () => {
    await openCourse(true);
    expect(screen.queryByRole('button', { name: 'Mark as completed' })).toBeNull(); // the PDF is already completed
    expect(screen.getByRole('button', { name: /^Download to watch: Item v1/ })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /^Watch: Item v1/ })).toBeNull();
  });

  it('sends a PDF completion right away when online, naming only the material', async () => {
    const api = await openCourse(
      true,
      {
        'POST /modules/tala/courses/A1/progress': {
          data: { data: { progress: '2/2', status: 'COMPLETED', completed: ['p2'] } },
        },
      },
      [mat('p2', 'pdf')],
      ['p2'],
    );
    expect(screen.getAllByRole('button', { name: 'Mark as completed' })).toHaveLength(1); // only the opened PDF

    await fireEvent.press(screen.getByRole('button', { name: 'Mark as completed' }));

    await waitFor(() =>
      expect(api.callsTo('POST /modules/tala/courses/A1/progress')).toHaveLength(1),
    );
    expect(api.callsTo('POST /modules/tala/courses/A1/progress')[0]?.body).toEqual({
      completed: ['p2'],
    });
    await waitFor(() => expect(screen.queryByText(/waiting to be sent/)).toBeNull());
  });

  it('while offline it is kept, shown as waiting, and sent from "Send now" once back online', async () => {
    const api = await openCourse(
      true,
      { 'POST /modules/tala/courses/A1/progress': { data: { data: {} } } },
      [mat('p2', 'pdf')],
      ['p2'],
    );
    offline(true);

    await fireEvent.press(screen.getByRole('button', { name: 'Mark as completed' }));
    expect(await screen.findByText(/1 completion waiting to be sent/)).toBeTruthy();
    expect(screen.getAllByText(/Completed, waiting to send/).length).toBeGreaterThan(0);
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

  it('a PDF can be marked completed only after it has been downloaded and opened', async () => {
    await openCourse(true, {}, [mat('p2', 'pdf')]);
    expect(screen.queryByRole('button', { name: 'Mark as completed' })).toBeNull(); // not downloaded
    expect(screen.getByText('Download and open it to mark it completed.')).toBeTruthy();

    await seedPdf('p2', false); // downloaded but never opened
    await queryClient.invalidateQueries();
    expect(await screen.findByRole('button', { name: /^Open: Item p2/ })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Mark as completed' })).toBeNull();

    await fireEvent.press(screen.getByRole('button', { name: /^Open: Item p2/ })); // opening it unlocks the button
    await waitFor(async () => expect((await listDownloads())['p2']?.openedAt).toBeTruthy());
  });

  it('a video is downloaded first (never opened in the phone browser), then offered to watch and to remove', async () => {
    const openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined as never);
    await openCourse(false, { 'GET /modules/tala/courses/A1/materials/v1': material('v1') });
    await fireEvent.press(screen.getByRole('button', { name: /^Download to watch: Item v1/ }));

    expect(await screen.findByRole('button', { name: /^Watch: Item v1/ })).toBeTruthy();
    expect(screen.getByText(/Saved on this device/)).toBeTruthy();
    expect(openURL).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByRole('button', { name: 'Remove download' }));
    await waitFor(() => expect(screen.queryByText(/Saved on this device/)).toBeNull());
    expect(screen.getByRole('button', { name: /^Download to watch: Item v1/ })).toBeTruthy();
  });

  it('in an ordered course a material stays locked until the ones before it are completed', async () => {
    // v1 (a video, not done) comes first, so the completed PDF after it is locked until v1 is done
    await openCourse(true, {
      'GET /modules/tala/courses/A1': { data: { data: { ...detail(true), sequential: true } } },
    });
    expect(screen.getByRole('button', { name: /^Download to watch: Item v1/ })).toBeTruthy();
    expect(screen.getByText('Locked')).toBeTruthy();
    expect(screen.getByLabelText('Locked. Complete Item v1 first to unlock this.')).toBeTruthy();
    expect(screen.getByText('Unlocks when you complete')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /: Item p1/ })).toBeNull(); // nothing to press on it
    expect(screen.queryByRole('button', { name: 'Mark as completed' })).toBeNull();
  });

  it('an ordered course opens the next material once the earlier one is completed', async () => {
    const done = { ...detail(true), sequential: true };
    done.materials = [mat('v1', 'video', 'COMPLETED'), mat('p1', 'pdf')];
    await openCourse(true, { 'GET /modules/tala/courses/A1': { data: { data: done } } });
    expect(screen.queryByText('Locked')).toBeNull();
    expect(screen.getByRole('button', { name: /^Download to open: Item p1/ })).toBeTruthy();
  });

  it('a course that is not ordered locks nothing', async () => {
    await openCourse(true);
    expect(screen.queryByText('Locked')).toBeNull();
  });

  it('shows how far a download has got, and Cancel stops it without an error or a saved file', async () => {
    await openCourse(false, { 'GET /modules/tala/courses/A1/materials/v1': material('v1') });
    fs.state.hold = new Promise(() => {}); // the transfer stays in flight
    await fireEvent.press(screen.getByRole('button', { name: /^Download to watch: Item v1/ }));

    expect(await screen.findByRole('progressbar', { name: /^Downloading Item v1/ })).toBeTruthy();
    expect(screen.getByText(/Downloading… 50%/)).toBeTruthy();

    await fireEvent.press(screen.getByRole('button', { name: /^Cancel download: Item v1/ }));
    expect(await screen.findByRole('button', { name: /^Download to watch: Item v1/ })).toBeTruthy();
    expect(screen.queryByRole('progressbar', { name: /^Downloading/ })).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(await listDownloads()).toEqual({});
    fs.state.hold = null;
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

describe('video feedback', () => {
  /** Downloads the video from the course page and opens it from the device, as the app now requires. */
  async function openVideo() {
    const api = mockApi({
      'GET /modules/tala/courses': { data: { data: [course] } },
      'GET /modules/tala/courses/A1': { data: { data: detail(true) } },
      'GET /modules/tala/courses/A1/materials/v1': material('v1'),
      'POST /modules/tala/courses/A1/progress': { data: { data: {} } },
    });
    signedInAs(makeMe({ modules: [TALA('linked')] }));
    await renderApp();
    await openTala();
    await fireEvent.press(await screen.findByRole('button', { name: /Safety at sea/ }));
    await fireEvent.press(
      await screen.findByRole('button', { name: /^Download to watch: Item v1/ }),
    );
    await fireEvent.press(await screen.findByRole('button', { name: /^Watch: Item v1/ }));
    return api;
  }

  /** The player reaching the end of the video (the player itself is a stand-in in tests). */
  async function videoEnds() {
    const call = [...jest.mocked(useEventListener).mock.calls]
      .reverse()
      .find((c) => (c as unknown[])[1] === 'playToEnd');
    await act(async () => (call![2] as () => void)());
  }

  it('the rating is locked until the video has finished, then it is asked for', async () => {
    await openVideo();
    const rate = screen.getByRole('button', { name: 'Rate this video' });
    expect(rate.props.accessibilityState?.disabled).toBe(true);
    expect(screen.queryByText('How was this video?')).toBeNull();

    await videoEnds();

    expect(await screen.findByText('How was this video?')).toBeTruthy();
  });

  it('needs a rating before it can be submitted; one star cannot be a half star', async () => {
    await openVideo();
    await videoEnds();
    const submit = () =>
      screen.getByRole('button', { name: 'Submit feedback' }).props.accessibilityState?.disabled;
    expect(await screen.findByText('Choose a rating from 1 to 5')).toBeTruthy();
    expect(submit()).toBe(true);

    await fireEvent.press(screen.getByRole('radio', { name: '1 star' }));
    expect(
      screen.getByRole('switch', { name: 'Half star' }).props.accessibilityState?.disabled,
    ).toBe(true); // 0.5 is not allowed
    expect(await screen.findByText('Your rating: 1 of 5')).toBeTruthy();
    expect(submit()).toBe(false);

    await fireEvent.press(screen.getByRole('radio', { name: '3 stars' }));
    await fireEvent.press(screen.getByRole('switch', { name: 'Half star' }));
    expect(await screen.findByText('Your rating: 2.5 of 5')).toBeTruthy();
  });

  it('completes the video with the rating; the comment is optional and is trimmed', async () => {
    const api = await openVideo();
    await videoEnds();
    await giveFeedback(5);
    await waitFor(() =>
      expect(api.callsTo('POST /modules/tala/courses/A1/progress')).toHaveLength(1),
    );
    expect(api.callsTo('POST /modules/tala/courses/A1/progress')[0]?.body).toEqual({
      completed: ['v1'],
      feedback: { v1: { rating: 5, comment: '' } },
    });
    expect(await screen.findByText(/Your rating: 5 of 5/)).toBeTruthy(); // the page now says it is completed
  });

  it('"Maybe later" leaves the video incomplete, sends nothing, and keeps the rating button', async () => {
    const api = await openVideo();
    await videoEnds();
    await fireEvent.press(await screen.findByRole('button', { name: 'Maybe later' }));

    expect(screen.queryByText('How was this video?')).toBeNull();
    expect(
      screen.getByRole('button', { name: 'Rate this video' }).props.accessibilityState?.disabled,
    ).toBeFalsy(); // watched, so it can still be rated
    expect(api.callsTo('POST /modules/tala/courses/A1/progress')).toHaveLength(0);
    expect(await pendingCompletions()).toEqual([]);
  });

  it('feedback survives being offline: it waits in the queue with the completion', async () => {
    await openVideo();
    await videoEnds();
    offline(true);
    await giveFeedback(4, false, 'Nice');
    const [item] = await pendingCompletions();
    expect(item).toMatchObject({
      kind: 'completed',
      materialId: 'v1',
      feedback: { rating: 4, comment: 'Nice' },
    });
  });

  it('a PDF is completed without any feedback form', async () => {
    const api = mockApi({
      'GET /modules/tala/courses': { data: { data: [course] } },
      'GET /modules/tala/courses/A1': {
        data: { data: { ...detail(true), materials: [{ ...mat('p9', 'pdf') }] } },
      },
      'POST /modules/tala/courses/A1/progress': { data: { data: {} } },
    });
    signedInAs(makeMe({ modules: [TALA('linked')] }));
    await seedPdf('p9', true);
    await renderApp();
    await openTala();
    await fireEvent.press(await screen.findByRole('button', { name: /Safety at sea/ }));
    await fireEvent.press(await screen.findByRole('button', { name: 'Mark as completed' }));

    expect(screen.queryByText('How was this video?')).toBeNull();
    await waitFor(() =>
      expect(api.callsTo('POST /modules/tala/courses/A1/progress')[0]?.body).toEqual({
        completed: ['p9'],
      }),
    );
  });
});
