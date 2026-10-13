import { colors } from '@/constants/theme';
import type { CrewDocument } from '@/services/api/types';

export type Badge = { text: string; color: string; background: string };

/** The server decides expired / expiring / valid; this only decides how it looks (spec BR-20). */
export function expiryBadge(status: CrewDocument['expiry_status']): Badge | null {
  switch (status) {
    case 'expired':
      return { text: 'Expired', color: colors.danger, background: colors.dangerBg };
    case 'expiring':
      return { text: 'Expiring soon', color: colors.warning, background: colors.warningBg };
    case 'valid':
      return { text: 'Valid', color: colors.success, background: colors.successBg };
    default:
      return null; // no expiry date: nothing to warn about
  }
}

/** Where a submitted document stands with the agency (spec BR-21). */
export function reviewBadge(status: CrewDocument['status']): Badge | null {
  switch (status) {
    case 'pending':
      return { text: 'Waiting for review', color: colors.warning, background: colors.warningBg };
    case 'rejected':
      return { text: 'Sent back', color: colors.danger, background: colors.dangerBg };
    default:
      return null;
  }
}

/** The badge a document shows: its review state while it is not approved, its expiry state once it is. */
export function documentBadge(d: Pick<CrewDocument, 'status' | 'expiry_status'>): Badge | null {
  return d.status === 'approved' ? expiryBadge(d.expiry_status) : reviewBadge(d.status);
}
