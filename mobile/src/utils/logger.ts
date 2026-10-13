/**
 * Redacting logger. Never pass request/response bodies of auth, payslip or
 * document endpoints (docs/13-SECURITY-REQUIREMENTS.md SR-10).
 */
const SENSITIVE_KEY = /pass(word)?|token|authorization|secret|birth|dob|account|otp/i;

export function redact(value: unknown, depth = 0): unknown {
  if (value == null || typeof value !== 'object') return value;
  if (depth > 4) return '[depth]';
  if (Array.isArray(value)) return value.map((v) => redact(v, depth + 1));
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([k, v]) => [
      k,
      SENSITIVE_KEY.test(k) ? '[redacted]' : redact(v, depth + 1),
    ]),
  );
}

type Meta = Record<string, unknown> | undefined;

export const logger = {
  debug(message: string, meta?: Meta) {
    if (__DEV__) console.warn(`[debug] ${message}`, meta ? redact(meta) : '');
  },
  warn(message: string, meta?: Meta) {
    console.warn(`[warn] ${message}`, meta ? redact(meta) : '');
  },
  error(message: string, meta?: Meta) {
    console.error(`[error] ${message}`, meta ? redact(meta) : '');
  },
};
