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

  describe('shipped builds cannot point at a developer machine', () => {
    const base = { apiPrefix: '/p', privacyUrl: 'https://a.test/x' };
    it.each([
      'https://localhost',
      'https://127.0.0.1:8000',
      'https://10.0.2.2',
      'https://192.168.1.20',
      'https://172.20.0.5',
      'https://sailix-dev.local',
    ])('refuses %s for staging and production', (apiBaseUrl) => {
      for (const appEnv of ['staging', 'production']) {
        expect(() => parseEnv({ ...base, appEnv, apiBaseUrl })).toThrow();
      }
    });

    it('still allows them while developing, and allows a public https address', () => {
      expect(
        parseEnv({ ...base, appEnv: 'development', apiBaseUrl: 'http://localhost:8000' }).appEnv,
      ).toBe('development');
      expect(
        parseEnv({ ...base, appEnv: 'production', apiBaseUrl: 'https://api.sailix.btsolve.com' })
          .appEnv,
      ).toBe('production');
    });
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

    it('the scripted tour is off unless asked for, and only ever runs in demo mode', () => {
      expect(parseEnv({ ...base, appEnv: 'development', demo: true }).demoTour).toBe(false);
      expect(
        parseEnv({ ...base, appEnv: 'development', demo: true, demoTour: true }).demoTour,
      ).toBe(true);
      expect(parseEnv({ ...base, appEnv: 'development', demoTour: true }).demoTour).toBe(false); // no demo, no tour
      expect(parseEnv({ ...base, appEnv: 'production', demo: true, demoTour: true }).demoTour).toBe(
        false,
      );
    });
  });
});
