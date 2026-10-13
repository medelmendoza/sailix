import { parseEnv } from './env';

describe('env', () => {
  it('validates and normalises the API base URL', () => {
    expect(parseEnv({ VITE_API_BASE_URL: 'http://localhost:8000/' }).apiBaseUrl).toBe(
      'http://localhost:8000',
    );
    expect(() => parseEnv({ VITE_API_BASE_URL: 'not-a-url' })).toThrow();
  });
});
