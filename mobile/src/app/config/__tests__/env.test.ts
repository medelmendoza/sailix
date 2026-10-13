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
});
