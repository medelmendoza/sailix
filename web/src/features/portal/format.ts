import type { CrewDocument } from '../../services/api/types';

/** A day written out: "Oct 24, 2026". Takes `YYYY-MM-DD` or a full timestamp. */
export function showDay(value: string | null | undefined): string {
  if (!value) return '—';
  const d = value.length === 10 ? new Date(`${value}T00:00:00`) : new Date(value);
  return d.toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' });
}

/** The server's decimal string as money: pesos (₱) or dollars ($). Never recomputed here. */
export function money(amount: string | null | undefined, dollar: boolean): string {
  if (amount === null || amount === undefined || amount === '') return '—';
  const n = Number(amount);
  if (!Number.isFinite(n)) return amount;
  return `${dollar ? '$' : '₱'}${n.toLocaleString('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export type BadgeInfo = { text: string; tone: 'success' | 'warning' | 'danger' };

/** The badge a document shows: its review state while it is not approved, its expiry state once it is (the server decides which). */
export function documentBadge(d: Pick<CrewDocument, 'status' | 'expiry_status'>): BadgeInfo | null {
  if (d.status === 'pending') return { text: 'Waiting for review', tone: 'warning' };
  if (d.status === 'rejected') return { text: 'Sent back', tone: 'danger' };
  if (d.expiry_status === 'expired') return { text: 'Expired', tone: 'danger' };
  if (d.expiry_status === 'expiring') return { text: 'Expiring soon', tone: 'warning' };
  if (d.expiry_status === 'valid') return { text: 'Valid', tone: 'success' };
  return null;
}

/** Whether a to-do's day has passed (a calendar day, compared as text). */
export function isOverdue(due: string | null, done: boolean): boolean {
  return !done && due !== null && due < new Date().toISOString().slice(0, 10);
}
