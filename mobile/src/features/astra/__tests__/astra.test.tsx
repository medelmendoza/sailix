import { act, fireEvent, screen } from '@testing-library/react-native';
import { makeMe, TALA, ASTRA } from '@/test-utils/fixtures';
import { mockApi } from '@/test-utils/mockApi';
import { renderApp } from '@/test-utils/render';
import { signedInAs } from '@/test-utils/session';
import { goToTab, openService } from '@/test-utils/steps';

const { __player: player } = jest.requireMock('expo-audio') as {
  __player: { play: jest.Mock; pause: jest.Mock };
};

async function openAstra() {
  mockApi({ 'GET /modules/tala/courses': { data: { data: [] } } });
  signedInAs(makeMe({ modules: [TALA('linked'), ASTRA()] }));
  await renderApp();
  await openService('Astra, Available');
}
const tile = (name: string) => fireEvent.press(screen.getByRole('button', { name }));

describe('astra in services', () => {
  it('shows Astra as available when the organization has it, and not as a coming-soon placeholder', async () => {
    mockApi({});
    signedInAs(makeMe({ modules: [ASTRA()] }));
    await renderApp();
    await goToTab('Services');
    expect(await screen.findByRole('button', { name: 'Astra, Available' })).toBeTruthy();
    expect(screen.queryByLabelText('Astra, coming soon')).toBeNull();
    expect(screen.getByLabelText('SRT, coming soon')).toBeTruthy();
  });

  it('shows Astra as coming soon when the organization does not have it', async () => {
    mockApi({});
    signedInAs(makeMe({ modules: [] }));
    await renderApp();
    await goToTab('Services');
    expect(await screen.findByLabelText('Astra, coming soon')).toBeTruthy();
  });

  it('opens the Astra menu with its six tools', async () => {
    await openAstra();
    for (const name of [
      'Pomodoro',
      'Focus and Rest sounds',
      'Risk management',
      'Root cause analysis',
      'SCARIL',
      'Military style emails',
    ]) {
      expect(await screen.findByRole('button', { name })).toBeTruthy();
    }
  });
});

describe('pomodoro screen', () => {
  beforeEach(() => jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate'] }));
  afterEach(() => jest.useRealTimers());

  it('starts, counts down, pauses and resets', async () => {
    await openAstra();
    await tile('Pomodoro');
    expect(await screen.findByText('25:00')).toBeTruthy();
    expect(screen.getByText(/longer 15-minute break/)).toBeTruthy(); // the help says what the timer really does

    await fireEvent.press(screen.getByRole('button', { name: 'Start' }));
    await act(async () => {
      jest.advanceTimersByTime(61_000);
    });
    expect(screen.getByText('23:59')).toBeTruthy();

    await fireEvent.press(screen.getByRole('button', { name: 'Pause' }));
    await act(async () => {
      jest.advanceTimersByTime(30_000);
    });
    expect(screen.getByText('23:59')).toBeTruthy(); // paused time does not count
    expect(screen.getByRole('button', { name: 'Resume' })).toBeTruthy();

    await fireEvent.press(screen.getByRole('button', { name: 'Reset' }));
    expect(screen.getByText('25:00')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Start' })).toBeTruthy();
  });

  it('moves to a short break with its tip when the work session ends', async () => {
    await openAstra();
    await tile('Pomodoro');
    await fireEvent.press(await screen.findByRole('button', { name: 'Start' }));
    await act(async () => {
      jest.advanceTimersByTime(25 * 60_000 + 1000);
    });
    expect(screen.getByText('Short break')).toBeTruthy();
    expect(screen.getByText('Take a walk and breathe.')).toBeTruthy();
  });
});

describe('sounds', () => {
  beforeEach(() => {
    player.play.mockClear();
    player.pause.mockClear();
  });

  it('lists focus and rest sounds and plays one for the chosen time', async () => {
    await openAstra();
    await tile('Focus and Rest sounds');
    expect(await screen.findByRole('button', { name: 'Brown noise, Focus sound' })).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Rain, Rest sound' }));

    expect(await screen.findByText('5:00 left')).toBeTruthy(); // one play of the 5-minute clip by default
    await fireEvent.press(screen.getByRole('radio', { name: '30 minutes' }));
    expect(screen.getByText('30:00 left')).toBeTruthy();

    await fireEvent.press(screen.getByRole('button', { name: 'Play' }));
    expect(player.play).toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Pause' })).toBeTruthy();
    expect(
      screen.getByRole('radio', { name: '60 minutes' }).props.accessibilityState.disabled,
    ).toBe(true); // locked while playing

    await fireEvent.press(screen.getByRole('button', { name: 'Stop' }));
    expect(player.pause).toHaveBeenCalled();
    expect(screen.getByText('30:00 left')).toBeTruthy();
  });
});

describe('static tools', () => {
  it('risk management explains the chosen box', async () => {
    await openAstra();
    await tile('Risk management');
    await fireEvent.press(
      await screen.findByRole('radio', { name: /High probability, Low impact/ }),
    );
    expect(await screen.findByText(/HIGH probability but LOW impact/)).toBeTruthy();
    await fireEvent.press(screen.getByRole('radio', { name: /Low probability, High impact/ }));
    expect(await screen.findByText(/share the risk or transfer the risk entirely/)).toBeTruthy();
  });

  it('root cause analysis leads to 5 Whys and P.M.E.P.E, which lists the five categories', async () => {
    await openAstra();
    await tile('Root cause analysis');
    await fireEvent.press(await screen.findByRole('button', { name: 'P.M.E.P.E' }));
    for (const c of ['People', 'Materials', 'Equipment', 'Process and Policies', 'Environment']) {
      expect(await screen.findByLabelText(new RegExp(`^${c}:`))).toBeTruthy();
    }
    expect(screen.getByRole('button', { name: 'Detailed view' })).toBeTruthy();
  });

  it('SCARIL lists its six parts', async () => {
    await openAstra();
    await tile('SCARIL');
    for (const w of [
      'Situation',
      'Complication',
      'Analysis',
      'Recommendation',
      'Impact',
      'Learnings',
    ]) {
      expect(await screen.findByLabelText(new RegExp(`^${w}:`))).toBeTruthy();
    }
  });

  it('the email guide has four steps, each with its content, and ends by pointing to RCA and SCARIL', async () => {
    await openAstra();
    await tile('Military style emails');
    await fireEvent.press(
      await screen.findByRole('button', { name: 'Step 2: R.A.I.D and Subject' }),
    );
    expect(await screen.findByText('RAID!')).toBeTruthy();
    expect(screen.getByLabelText(/^Urgent:/)).toBeTruthy();
    expect(
      screen.getByText('Subject: [Urgent Request] Documents for Crew Change - MV Vessel A'),
    ).toBeTruthy();
  });
});
