import { parseEnv } from '../env';

describe('env', () => {
  it('accepts a valid config', () => {
    expect(
      parseEnv({
        appEnv: 'staging',
        apiBaseUrl: 'https://a.test',
        apiPrefix: '/p',
        privacyUrl: 'https://a.test/x',
        servicesEnabled: true,
      }).appEnv,
    ).toBe('staging');
  });

  it('fails loudly on a bad build profile', () => {
    expect(() => parseEnv({ appEnv: 'prod', apiBaseUrl: 'nope' })).toThrow();
  });

  describe('demo mode (sample data, build-time only)', () => {
    const base = { apiBaseUrl: 'https://a.test', apiPrefix: '/p', privacyUrl: 'https://a.test/x' };

    it('is off unless the build asks for it', () => {
      expect(parseEnv({ ...base, appEnv: 'development' }).demo).toBe(false);
    });

    it('can be on in development and staging builds', () => {
      expect(parseEnv({ ...base, appEnv: 'development', demo: true }).demo).toBe(true);
      expect(parseEnv({ ...base, appEnv: 'staging', demo: true }).demo).toBe(true);
    });

    it('can never be on in a production build, whatever the flag says', () => {
      expect(parseEnv({ ...base, appEnv: 'production', demo: true }).demo).toBe(false);
    });
  });
});
