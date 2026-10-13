import { isAxiosError } from 'axios';

export type ApiErrorKind = 'network' | 'http' | 'parse' | 'unauthorized';

/** RFC 9457 problem returned by the API. `code` is the stable machine-readable part. */
export class ApiError extends Error {
  readonly kind: ApiErrorKind;
  readonly status?: number;
  readonly code?: string;
  readonly fieldErrors: Record<string, string[]>;
  readonly retryAfter?: number;

  constructor(
    kind: ApiErrorKind,
    message: string,
    options: {
      status?: number;
      code?: string;
      fieldErrors?: Record<string, string[]>;
      retryAfter?: number;
    } = {},
  ) {
    super(message);
    this.name = 'ApiError';
    this.kind = kind;
    this.status = options.status;
    this.code = options.code;
    this.fieldErrors = options.fieldErrors ?? {};
    this.retryAfter = options.retryAfter;
  }

  field(name: string): string | undefined {
    return this.fieldErrors[name]?.[0];
  }
}

export const GENERIC_ERROR_MESSAGE =
  'Something went wrong on our end. Please try again, or contact support if it keeps happening.';
export const NETWORK_ERROR_MESSAGE = 'No connection. Check your internet and try again.';

/** HTTP header names are case-insensitive; adapters and servers do not agree on the casing. */
function headerValue(headers: unknown, name: string): unknown {
  if (!headers || typeof headers !== 'object') return undefined;
  const record = headers as Record<string, unknown>;
  const key = Object.keys(record).find((k) => k.toLowerCase() === name);
  return key === undefined ? undefined : record[key];
}

function isErrorMap(value: unknown): value is Record<string, string[]> {
  return (
    typeof value === 'object' &&
    value !== null &&
    Object.values(value).every((v) => Array.isArray(v) && v.every((m) => typeof m === 'string'))
  );
}

/** Normalises anything thrown by the HTTP layer into an ApiError. */
export function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;
  if (isAxiosError(error)) {
    if (!error.response) return new ApiError('network', NETWORK_ERROR_MESSAGE);
    const { status, data, headers } = error.response;
    const body = (data && typeof data === 'object' ? data : {}) as Record<string, unknown>;
    const retry = Number(headerValue(headers, 'retry-after'));
    return new ApiError(
      status === 401 ? 'unauthorized' : 'http',
      typeof body.detail === 'string' ? body.detail : GENERIC_ERROR_MESSAGE,
      {
        status,
        code: typeof body.code === 'string' ? body.code : undefined,
        fieldErrors: isErrorMap(body.errors) ? body.errors : {},
        retryAfter: Number.isFinite(retry) && retry > 0 ? retry : undefined,
      },
    );
  }
  return new ApiError('parse', GENERIC_ERROR_MESSAGE);
}

const MESSAGES: Record<string, string> = {
  invalid_credentials: 'Incorrect username or password.',
  membership_pending: 'Your account is waiting for approval by your organization.',
  membership_suspended: 'Your access to this organization is suspended.',
  account_suspended: 'This account is suspended.',
  tenant_suspended: 'Your organization is not active right now. Contact your administrator.',
  no_access: 'This account has no active organization.',
  invalid_ticket: 'The sign-in step expired. Please sign in again.',
  invalid_agency_code: 'That organization code is not valid.',
  invalid_current_password: 'The current password is incorrect.',
  invalid_reset_token: 'This reset link is invalid or has expired. Request a new one.',
  tenant_mismatch: 'Your organization changed. Please sign in again.',
  module_disabled: 'This service is not available for your organization.',
  module_forbidden: 'Your role cannot use this service.',
  module_unavailable: 'This service is not available yet.',
  forbidden: 'You are not allowed to do that.',
  not_found: 'That item no longer exists.',
};

/** User-facing text for an error: friendly mapping first, never server internals for 5xx. */
export function describeError(error: unknown): string {
  const e = toApiError(error);
  if (e.kind === 'network') return NETWORK_ERROR_MESSAGE;
  if (e.status === 429 || e.code === 'throttled') {
    return e.retryAfter
      ? `Too many attempts. Try again in ${e.retryAfter} seconds.`
      : 'Too many attempts. Try again shortly.';
  }
  if (e.status !== undefined && e.status >= 500) return GENERIC_ERROR_MESSAGE;
  if (e.code && MESSAGES[e.code]) return MESSAGES[e.code]!;
  if (e.status === 422) return 'Please check the highlighted fields.';
  return e.message || GENERIC_ERROR_MESSAGE;
}
