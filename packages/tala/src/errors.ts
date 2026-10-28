import { TalaError } from './direct/client';
import { TalaProblem } from './direct/problem';

/**
 * Anything thrown by the Tala data source, as one shape the screens and the outbox already understand:
 * `kind: 'network'` for "Tala is not reachable" (the saved copy is used), `code` for what the user can act on.
 */
export type ApiErrorKind = 'network' | 'http' | 'parse' | 'unauthorized';

export class ApiError extends Error {
  constructor(
    readonly kind: ApiErrorKind,
    message: string,
    readonly status?: number,
    readonly code?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export const GENERIC_ERROR_MESSAGE = 'Something went wrong. Please try again.';
export const NETWORK_ERROR_MESSAGE = 'Tala is not reachable right now. Check your connection and try again.';

const MESSAGES: Record<string, string> = {
  relink_required: 'Please sign in to Tala again.',
  link_failed: 'Tala did not accept those credentials.',
  course_code_rejected: 'That course code was not accepted.',
  feature_disabled: 'This is not enabled yet.',
  progress_busy: 'Another update is in progress. Try again.',
};

export function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;
  if (error instanceof TalaProblem) return new ApiError('http', error.message, error.status, error.code);
  if (error instanceof TalaError) {
    switch (error.kind) {
      case 'unavailable':
        return new ApiError('network', NETWORK_ERROR_MESSAGE);
      case 'unauthorized':
        return new ApiError('http', MESSAGES.relink_required!, 409, 'relink_required');
      case 'login_rejected':
        return new ApiError('http', MESSAGES.link_failed!, 422, 'link_failed');
      case 'course_code_rejected':
        return new ApiError('http', MESSAGES.course_code_rejected!, 422, 'course_code_rejected');
    }
  }
  return new ApiError('parse', GENERIC_ERROR_MESSAGE);
}

export function describeError(error: unknown): string {
  const e = toApiError(error);
  return (e.code && MESSAGES[e.code]) || e.message;
}
