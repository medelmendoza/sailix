import { fireEvent, render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';
import { setCrashReporter } from '@/services/crashReporter';
import { ErrorBoundary } from '../ErrorBoundary';

let shouldThrow = true;
function Flaky() {
  if (shouldThrow) throw new Error('secret internal detail');
  return <Text>All good</Text>;
}

beforeEach(() => {
  shouldThrow = true;
  jest.spyOn(console, 'error').mockImplementation(() => undefined);
});
afterEach(() => {
  jest.restoreAllMocks();
  setCrashReporter(() => undefined);
});

describe('ErrorBoundary', () => {
  it('shows a calm message instead of the error, and reports it', async () => {
    const reported: string[] = [];
    setCrashReporter((e, c) => reported.push(`${c.source}:${e.message}`));
    await render(
      <ErrorBoundary>
        <Flaky />
      </ErrorBoundary>,
    );
    expect(screen.getByText('Something went wrong')).toBeTruthy();
    expect(screen.queryByText(/secret internal detail/)).toBeNull(); // nothing technical on screen
    expect(reported).toEqual(['render:secret internal detail']);
  });

  it('lets the person try again', async () => {
    await render(
      <ErrorBoundary>
        <Flaky />
      </ErrorBoundary>,
    );
    shouldThrow = false;
    await fireEvent.press(screen.getByRole('button', { name: 'Try again' }));
    expect(screen.getByText('All good')).toBeTruthy();
  });

  it('renders its children untouched when nothing fails', async () => {
    shouldThrow = false;
    await render(
      <ErrorBoundary>
        <Flaky />
      </ErrorBoundary>,
    );
    expect(screen.getByText('All good')).toBeTruthy();
  });
});
