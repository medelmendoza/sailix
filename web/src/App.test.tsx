import { render, screen } from '@testing-library/react';
import { App } from './App';
import { parseEnv } from './app/config/env';

describe('foundation', () => {
  it('renders the portal shell', () => {
    render(<App />);
    expect(screen.getByRole('heading', { name: 'Sailix Portal' })).toBeInTheDocument();
  });

  it('validates and normalises the API base URL', () => {
    expect(parseEnv({ VITE_API_BASE_URL: 'http://localhost:8000/' }).apiBaseUrl).toBe(
      'http://localhost:8000',
    );
    expect(() => parseEnv({ VITE_API_BASE_URL: 'not-a-url' })).toThrow();
  });
});
