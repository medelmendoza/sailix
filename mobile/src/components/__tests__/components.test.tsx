import { fireEvent, render, screen } from '@testing-library/react-native';
import { AppText } from '../AppText';
import { Button } from '../Button';
import { EmptyState } from '../EmptyState';
import { ErrorState } from '../ErrorState';

describe('Button', () => {
  it('calls onPress', async () => {
    const onPress = jest.fn();
    await render(<Button title="Save" onPress={onPress} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('does not fire while loading and exposes busy state', async () => {
    const onPress = jest.fn();
    await render(<Button title="Save" onPress={onPress} loading />);
    const button = screen.getByRole('button', { name: 'Save' });
    await fireEvent.press(button);
    expect(onPress).not.toHaveBeenCalled();
    expect(button.props.accessibilityState).toMatchObject({ busy: true, disabled: true });
  });
});

describe('ErrorState / EmptyState', () => {
  it('offers Retry and calls back', async () => {
    const onRetry = jest.fn();
    await render(<ErrorState message="Boom" onRetry={onRetry} />);
    expect(screen.getByText('Boom')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Retry' }));
    expect(onRetry).toHaveBeenCalled();
  });

  it('empty state is distinct from error (no retry)', async () => {
    await render(<EmptyState />);
    expect(screen.getByText('No data found.')).toBeTruthy();
    expect(screen.queryByRole('button')).toBeNull();
  });
});

describe('AppText text-size scaling', () => {
  it('lets body text follow the largest accessibility size but stops big headings earlier', async () => {
    await render(
      <>
        <AppText variant="title">Big</AppText>
        <AppText variant="heading">Mid</AppText>
        <AppText>Plain body</AppText>
      </>,
    );
    expect(screen.getByText('Big').props.maxFontSizeMultiplier).toBeLessThan(2);
    expect(screen.getByText('Mid').props.maxFontSizeMultiplier).toBeLessThan(2);
    expect(screen.getByText('Plain body').props.maxFontSizeMultiplier).toBeGreaterThanOrEqual(3);
  });

  it('a caller can still override the cap (e.g. text inside a fixed-size round button)', async () => {
    await render(
      <AppText variant="button" maxFontSizeMultiplier={1.2}>
        Go
      </AppText>,
    );
    expect(screen.getByText('Go').props.maxFontSizeMultiplier).toBe(1.2);
  });
});
