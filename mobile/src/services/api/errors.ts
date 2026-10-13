import { isAxiosError } from 'axios';

export type ApiErrorKind = 'network' | 'http' | 'parse' | 'unauthorized';

export class ApiError extends Error {
  readonly kind: ApiErrorKind;
  readonly status?: number;

  constructor(kind: ApiErrorKind, message: string, status?: number) {
    super(message);
    this.name = 'ApiError';
    this.kind = kind;
    this.status = status;
  }
}

export const GENERIC_ERROR_MESSAGE =
  'Something went wrong on our end. Please try again, or contact support if it keeps happening.';
export const NETWORK_ERROR_MESSAGE = 'No connection. Check your internet and try again.';

function messageFromBody(data: unknown): string | undefined {
  if (data && typeof data === 'object') {
    const body = data as Record<string, unknown>;
    // Backend uses `message` (400/other) and `error` (login 401).
    for (const key of ['message', 'error'] as const) {
      const v = body[key];
      if (typeof v === 'string' && v.trim() !== '') return v;
    }
  }
  return undefined;
}

/** Normalises anything thrown by the HTTP layer into an ApiError. */
export function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;
  if (isAxiosError(error)) {
    if (!error.response) return new ApiError('network', NETWORK_ERROR_MESSAGE);
    const { status, data } = error.response;
    const message = messageFromBody(data) ?? GENERIC_ERROR_MESSAGE;
    return new ApiError(status === 401 ? 'unauthorized' : 'http', message, status);
  }
  return new ApiError('parse', GENERIC_ERROR_MESSAGE);
}
