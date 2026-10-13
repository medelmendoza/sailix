import { redact } from '../logger';

describe('logger redaction', () => {
  it('redacts sensitive keys at any depth', () => {
    expect(
      redact({ username: 'u', password: 'p', nested: { token: 't', accountNumber: '1', ok: 1 } }),
    ).toEqual({
      username: 'u',
      password: '[redacted]',
      nested: { token: '[redacted]', accountNumber: '[redacted]', ok: 1 },
    });
  });
});
