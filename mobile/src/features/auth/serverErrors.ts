import type { FieldValues, Path, UseFormSetError } from 'react-hook-form';
import { describeError, toApiError } from '@/services/api/errors';

/**
 * Places server validation errors on their fields; returns the message for the form-level alert when the
 * failure is not field-specific (wrong credentials, throttling, suspended organization, no connection...).
 */
export function applyServerErrors<T extends FieldValues>(
  error: unknown,
  setError: UseFormSetError<T>,
  fields: readonly Path<T>[],
): string | null {
  const e = toApiError(error);
  let placed = false;
  for (const name of fields) {
    const message = e.field(String(name));
    if (message) {
      setError(name, { type: 'server', message });
      placed = true;
    }
  }
  return placed && e.status === 422 ? null : describeError(e);
}
