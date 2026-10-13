import { fireEvent, render, screen } from '@testing-library/react-native';
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
