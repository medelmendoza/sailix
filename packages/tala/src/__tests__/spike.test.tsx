import { fireEvent, render, screen } from '@testing-library/react-native';
import { talaModule, type TalaHost } from '../index';

const host = (over: Partial<TalaHost> = {}): TalaHost => ({
  scope: 'org:1:member:2',
  theme: { background: '#fff', text: '#000', primary: '#0a7' },
  config: { talaBaseUrl: 'https://tala.example.test', progressWrites: false },
  onExit: jest.fn(),
  ...over,
});

describe('tala package root', () => {
  it('renders inside a host and hands control back through onExit', async () => {
    const h = host();
    await render(<talaModule.Root host={h} />);
    expect(screen.getByText('Tala package')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Back' }));
    expect(h.onExit).toHaveBeenCalledTimes(1);
  });
});
