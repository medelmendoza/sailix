import { isAxiosError } from 'axios';

/** RFC 9457 problem returned by the API (`code` is the stable machine-readable part). */
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly errors: Record<string, string[]> = {},
    public readonly retryAfter?: number,
    public readonly requestId?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }

  is(code: string): boolean {
    return this.code === code;
  }

  /** First message for a field, if the server reported one. */
  field(name: string): string | undefined {
    return this.errors[name]?.[0];
  }
}

interface ProblemBody {
  code?: unknown;
  detail?: unknown;
  errors?: unknown;
  request_id?: unknown;
}

export function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;
  if (isAxiosError(error)) {
    if (!error.response) {
      return new ApiError(
        0,
        'network',
        'Cannot reach the server. Check your connection and try again.',
      );
    }
    const body = (error.response.data ?? {}) as ProblemBody;
    const retryAfter = Number(error.response.headers?.['retry-after']);
    return new ApiError(
      error.response.status,
      typeof body.code === 'string' ? body.code : 'http_error',
      typeof body.detail === 'string' ? body.detail : 'Request failed.',
      isErrorMap(body.errors) ? body.errors : {},
      Number.isFinite(retryAfter) ? retryAfter : undefined,
      typeof body.request_id === 'string' ? body.request_id : undefined,
    );
  }
  return new ApiError(
    0,
    'unknown',
    error instanceof Error ? error.message : 'Something went wrong.',
  );
}

function isErrorMap(value: unknown): value is Record<string, string[]> {
  return (
    typeof value === 'object' &&
    value !== null &&
    Object.values(value).every((v) => Array.isArray(v))
  );
}

const MESSAGES: Record<string, string> = {
  invalid_credentials: 'Incorrect credentials. Check them and try again.',
  membership_pending: 'Your account is waiting for activation by your organization.',
  membership_suspended: 'Your access to this organization is suspended.',
  account_suspended: 'This account is suspended.',
  tenant_suspended: 'Your organization is not active. Contact your platform administrator.',
  web_access_denied: 'This account cannot use the web portal. Use the mobile app instead.',
  no_access: 'This account has no active organization.',
  mfa_not_enrolled: 'Multi-factor authentication is not set up for this account.',
  invalid_ticket: 'The sign-in step expired. Start again.',
  invalid_reset_token: 'This reset link is invalid or has expired. Request a new one.',
  invalid_invitation: 'This invitation is invalid or has expired. Ask for a new one.',
  invalid_current_password: 'The current password is incorrect.',
  invalid_transition: 'That action is not allowed in the current state.',
  no_active_admin: 'Invite an administrator who accepts the invitation before activating.',
  last_admin: 'The last active administrator cannot be removed or suspended.',
  team_already_mapped: 'That team is already mapped to another organization.',
  links_exist: 'The team cannot change while accounts are linked. Unlink them first.',
  module_not_provisioned: 'The platform has not provisioned this module for your organization.',
  already_member: 'This person is already a member.',
  csrf_mismatch: 'Your session expired. Reload the page and try again.',
  tenant_mismatch: 'Organization mismatch. Reload the page.',
  forbidden: 'You are not allowed to do that.',
  not_found: 'That item no longer exists.',
};

/** User-facing text for an error: friendly mapping first, then the server detail. */
export function describeError(error: unknown): string {
  const e = toApiError(error);
  if (e.status === 429 || e.code === 'throttled') {
    return e.retryAfter
      ? `Too many attempts. Try again in ${e.retryAfter} seconds.`
      : 'Too many attempts. Try again shortly.';
  }
  if (e.status >= 500) return 'The server had a problem. Try again in a moment.';
  return (
    MESSAGES[e.code] ?? (e.status === 422 ? 'Please check the highlighted fields.' : e.message)
  );
}
